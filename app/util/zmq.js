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

function encode(route, msg) {
    let buffer = null;
    if (msg) {
        let message = new basepb[route]();
        for (let key in msg) {
            let value = msg[key];
            let func = getFuncName(key);
            if (message[func]) {
                message[func](value);
            }
        }
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

function decode(buffer) {
    let buffLen = buffer.length;
    let dataLen = buffLen - 1;
    let offset = 0;
    let routeId = buffer[offset++];
    let routeName = null;
    for (const key in basepb.Type.messageType) {
        const value = basepb.Type.messageType[key];
        if (value == routeId) {
            for (const req in basepb) {
                if (key == req.toUpperCase()) {
                    routeName = req;
                    break;
                }
            }
            break;
        }
    }

    if (!routeName) {
        console.warn('路由错误! routeId: ', routeId);
        return;
    }

    if (dataLen > 0) {
        let data = new Buffer.alloc(dataLen);
        for (var i = 0; i < dataLen; i++) {
            data[i] = buffer[offset++];
        }

        try {
            let msg = basepb[routeName].deserializeBinary(data);
            return {
                route: routeName,
                msg: msg.array
            };
        } catch (error) {
            console.error('引擎推送数据格式错误!');
        }
    }

    return null;
}
