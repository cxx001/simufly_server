const zmq = require("zeromq")
const basepb = require('../../proto/simufly_pb');

let zmqReqSock = null;

process.on('message', (m) => {
    if (m.route == 'init') {
        init(m.msg);
    } else {
        let uid = m.uid;
        let route = m.route;
        let msg = m.msg;
        if (!(uid && route)) {
            console.warn('协议格式错误! ', m);
            return;
        }
        send(uid, route, msg);
    }
});

async function init(params) {
    // 绑定发送端口
    const zmqReqPort = params.zmqReqPort;
    zmqReqSock = new zmq.Publisher;
    await zmqReqSock.bind("tcp://0.0.0.0:" + zmqReqPort);
    console.log("bind zmq req port " + zmqReqPort);

    // 绑定接收端口
    const zmqRspPort = params.zmqRspPort;
    const zmqRspSock = new zmq.Pull;
    await zmqRspSock.bind("tcp://0.0.0.0:" + zmqRspPort);
    console.log("bind zmq rsp port " + zmqRspPort);
    for await (const [msg] of zmqRspSock) {
        let message = decode(msg);
        console.log('收到引擎消息: ', message);
        if (message) {
            process.send(message);
        } else {
            console.warn('decode fail!');
        }
    }
}

async function send(uid, route, msg) {
    if (!zmqReqSock) {
        console.warn('zmq req sock null!');
        return;
    }
    let buffer = encode(route, msg);
    console.log('向引擎发送消息: ', uid, route, msg);
    await zmqReqSock.send([uid, buffer]);
}

function recursiveEncode(struct, msg) {
    let message = new struct();
    for (let key in msg) {
        if (key == '_type') {
            continue;
        }

        let value = msg[key];
        // 是否是数组
        if (value.constructor === Array) {
            if (value[0].constructor === Object) {
                // 嵌套对象
                let array = [];
                for (let i = 0; i < value.length; i++) {
                    const item = value[i];
                    let _type = item._type;
                    if (!_type) {
                        console.error('格式错误, 没有带嵌套消息类型!');
                        return null;
                    }
                    let obj = recursiveEncode(struct[_type], item);
                    array.push(obj);
                }
                let func = getFuncName(key);
                func = func + 'List';
                if (message[func]) {
                    message[func](array);
                }
            } else {
                // 简单类型元素
                let func = getFuncName(key);
                func = func + 'List';
                if (message[func]) {
                    message[func](value);
                }
            }
        } else {
            // 是否嵌套自定义结构
            if (value.constructor === Object) {
                let _type = value._type;
                if (!_type) {
                    console.error('格式错误, 没有带嵌套消息类型!');
                    return null;
                }
                recursiveEncode(struct[_type], item);

            } else {
                let func = getFuncName(key);
                if (message[func]) {
                    message[func](value);
                }
            }
        }
    }

    return message;
}

function encode(route, msg) {
    let buffer = null;
    if (msg) {
        let message = recursiveEncode(basepb[route], msg);
        buffer = message.serializeBinary();
    }

    let buffLen = buffer ? buffer.length : 0;
    let data = new Buffer.alloc(buffLen + 1);
    let offset = 0;
    data[offset++] = basepb.Type.messageType[route.toUpperCase()]; // 消息头
    for (var i = 0; i < buffLen; i++) {
        data[offset++] = buffer[i];
    }
    return data;
}

function getFuncName(field, type) {
    field = field.toLowerCase();
    field = field.split(/_|-/);
    let sub = type || 'set';
    for (let i = 0; i < field.length; i++) {
        let element = field[i];
        element = element.replace(element[0], element[0].toUpperCase());
        sub = sub + element;
    }
    return sub;
}

/**
 * 
 * @param {*} buffer 用户名 + 消息类型 + proto内容
 * @returns 
 */
function decode(buffer) {
    let buffLen = buffer.length;
    let uidLen = 24;
    let dataLen = buffLen - uidLen - 1;
    if (dataLen < 0) {
        console.warn('收到消息格式异常!', buffLen, dataLen);
        return;
    }
    
    // 用户名
    let offset = 0;
    let uidBuffer = new Buffer.alloc(uidLen);
    for (var i = 0; i < uidLen; i++) {
        uidBuffer[offset++] = buffer[i];
    }
    let uid = uidBuffer.toString();
    let routeId = buffer[offset++];
    let routeName = null;
    for (const key in basepb.Type.messageType) {
        const value = basepb.Type.messageType[key];
        if (value == routeId) {
            for (const req in basepb) {
                // 这里没有匹配说明定义了消息类型但是没有定义对应消息的结构
                if (key == req.toUpperCase()) {
                    routeName = req;
                    break;
                }
            }
            break;
        }
    }

    if (!routeName) {
        console.warn('路由错误! uid: %s routeId: %d ', uid, routeId);
        return;
    }

    let msg = {}
    msg.route = routeName;
    msg.uid = uid;
    if (dataLen > 0) {
        let data = new Buffer.alloc(dataLen);
        for (var i = 0; i < dataLen; i++) {
            data[i] = buffer[offset++];
        }

        try {
            let probuf = basepb[routeName].deserializeBinary(data);
            msg.msg = probuf.array;
        } catch (error) {
            console.error('引擎推送数据格式错误!');
        }
    }

    return msg;
}
