/**
 * Date: 2022/3/25
 * Author: admin
 * Description:
 */
'use strict';
const pomelo = require('pomelo');
const consts = require('../common/consts');
const utils = require('../util/utils')
const logger = require('pomelo-logger').getLogger('cskl', '__filename');
const ssh2 = require('../util/ssh2');
const fs = require('fs');
const messageService = require('../services/messageService');
const child_process = require('child_process');

// 配置
const remotePackagePath = '/home/package/simufly_engine.zip';   // 文件夹目录名要为项目对应的UUID
const server = {
    host: '192.168.10.251',
    port: 22,
    username: 'root',
    password: 'redhat',
}

var instance = null;
module.exports = function (app) {
    if (instance) {
        return instance;
    }
    return instance = new EngineStub(app);
};

var EngineStub = function (app) {
    this.app = app;
    let engines = app.get('servers').engine;
    let engineCfg = utils.find2key('id', app.get('serverId'), engines);
    this.zmqHost = engineCfg.zmqHost;
    this.zmqReqPort = engineCfg.zmqReqPort;
    this.zmqRspPort = engineCfg.zmqRspPort;

    // 创建zmq通信子进程
    this.zmqProcess = null;
    this._createChildProcess();

    // 绑定列表, TODO: 如果引擎已经起来了，服务器重启，如果关联？
    this.uid2engine = {};
    this.uid2sid = {};
};

var pro = EngineStub.prototype;

pro._createChildProcess = function () {
    this.zmqProcess = child_process.spawn('node', ['./app/util/zmq.js'], { stdio: [null, null, null, 'ipc'] });
    this.zmqProcess.stdout.on('data', function (data) {
        logger.info('zmq进程日志: ' + data);
    });

    this.zmqProcess.stderr.on('data', function (data) {
        logger.warn('zmq进程错误: ' + data);
    });

    this.zmqProcess.on('close', function (code) {
        logger.info('zmq进程已退出, 退出码: ' + code);
    });

    this.zmqProcess.on('message', (m) => {
        // onXxxx
        let funcName = 'on' + m.route;
        let fn = pro[funcName];
        if (fn) {
            fn.call(this, m.uid, m.msg);
        }
    });

    let msg = {
        route: 'init',
        msg: { zmqReqPort: this.zmqReqPort, zmqRspPort: this.zmqRspPort }
    }
    this.zmqProcess.send(msg);

    // 模拟向引擎发送
    // setInterval(() => {
    //     this.zmqProcess.send({
    //         uid: "A",
    //         route: 'ModifyParameter',
    //         msg: {
    //             name: "1232343254325",
    //             value: 100
    //         }
    //     });
    // }, 5000);
}

pro.updateUserState = function (uid, sid, cb) {
    utils.invokeCallback(cb);
    this.uid2sid[uid] = sid;
    logger.info('更新用户状态. uid-sid: ', uid, sid);
}

pro.getSidByUid = function (uid) {
    return this.uid2sid[uid];
}

pro.bindEngine = function (uid, opt) {
    if (this.uid2engine[uid]) {
        logger.warn("用户[%s]已经绑定引擎!", uid);
        return;
    }

    this.uid2engine[uid] = opt;
    logger.info("用户[%s]已经和引擎绑定.", uid);
}

pro.unbindEngine = function (uid) {
    delete this.uid2engine[uid];
    logger.info("用户[%s]已经和引擎解绑.", uid);
}

pro.checkIsBind = function (uid) {
    if (this.uid2engine[uid]) {
        return true;
    }
    return false;
}

pro.generateCode = function (uids, projectUUID, genCodeInfos, cb) {
    projectUUID = 'simufly_engine'
    utils.invokeCallback(cb);

    if (this.checkIsBind(uids.uid)) {
        logger.warn("用户[%s]已经绑定引擎了!", uids.uid);
        messageService.pushMessageToPlayer(uids, 'onMsgTips', {
            level: consts.TipsLevel.warn,
            tip: consts.MsgTipsCode.UserBindedEngine
        });
        return;
    }

    let userDir = './assets/' + uids.uid;
    if (!fs.existsSync(userDir)) {
        if (fs.mkdirSync(userDir)) {
            logger.warn("create path[%s] dir fail!", userDir);
            messageService.pushMessageToPlayer(uids, 'onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.CreateDirFail
            });
            return;
        }
    }

    let localPath = userDir + '/' + projectUUID + '.zip';
    ssh2.DownloadFile(server, remotePackagePath, localPath, (err, data) => {
        if (err) {
            logger.warn('ssh download GenCode file fail! err: %o', err);
            messageService.pushMessageToPlayer(uids, 'onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.GenCodeFail
            });
            return;
        }
        messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
            code: consts.MsgFlowCode.GenCode
        });
    })
}

// TODO: ip: 正式场景会去后台数据库中根据ip查找机器账号密码信息
pro.deploy = function (uids, projectUUID, ip, cb) {
    projectUUID = 'simufly_engine'
    utils.invokeCallback(cb);

    if (this.checkIsBind(uids.uid)) {
        logger.warn("用户[%s]已经绑定引擎了!", uids.uid);
        messageService.pushMessageToPlayer(uids, 'onMsgTips', {
            level: consts.TipsLevel.warn,
            tip: consts.MsgTipsCode.UserBindedEngine
        });
        return;
    }

    // 1.ssh登录 2.上传 3.解压 4.编译
    let localPath = './assets/' + uids.uid + '/' + projectUUID + '.zip';
    if (!fs.existsSync(localPath)) {
        logger.warn("deploy path[%s] not exist!", localPath);
        messageService.pushMessageToPlayer(uids, 'onMsgTips', {
            level: consts.TipsLevel.error,
            tip: consts.MsgTipsCode.NONDeployPath
        });
        return;
    }

    let remotePath = '/home/cxx/' + projectUUID + '.zip'
    ssh2.UploadFile(server, localPath, remotePath, (err, result) => {
        if (err) {
            logger.warn('ssh upload deploy file fail! err: %o', err);
            messageService.pushMessageToPlayer(uids, 'onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.DeployUploadFail
            });
            return;
        }
        messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
            code: consts.MsgFlowCode.DeployUpload
        });

        let pathCmd1 = "cd /home/cxx/;"
        let unzipCmd = "unzip -o ./" + projectUUID + ".zip;"
        let pathCmd2 = "cd ./" + projectUUID + "/demo2/;";
        let compileCmd = "./compile.sh";
        let cmd = pathCmd1 + unzipCmd + pathCmd2 + compileCmd + "\r\nexit\r\n";
        ssh2.Shell(server, cmd, (err, data) => {
            if (err) {
                logger.warn('ssh shell commond fail! err: %o', err);
                messageService.pushMessageToPlayer(uids, 'onMsgTips', {
                    level: consts.TipsLevel.error,
                    tip: consts.MsgTipsCode.DeployDoShellFail
                });
                return;
            }

            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.DeployDoShell,
                des: data
            });
        });
    });
}

// 1. 启动引擎
pro.initSimulation = function (uids, projectUUID, ip, cb) {
    projectUUID = 'simufly_engine'
    utils.invokeCallback(cb);

    if (this.checkIsBind(uids.uid)) {
        logger.warn("用户[%s]已经绑定引擎了!", uids.uid);
        messageService.pushMessageToPlayer(uids, 'onMsgTips', {
            level: consts.TipsLevel.warn,
            tip: consts.MsgTipsCode.UserBindedEngine
        });
        return;
    }

    // 1. 运行(先关闭再运行)
    let pathCmd = "cd /home/cxx/" + projectUUID + "/demo2/;";
    let startCmd = "./demo " + this.zmqHost + " " + this.zmqReqPort + " " + this.zmqRspPort + " " + uids.uid;
    let cmd = pathCmd + startCmd + "\r\nexit\r\n";     // 引擎起来后所有的日志都会在这里触发, 直至引擎程序kill。
    ssh2.Shell(server, cmd, (err, data) => {
        if (err) {
            logger.warn('ssh shell commond fail! err: %o', err);
            messageService.pushMessageToPlayer(uids, 'onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.InitEngineFail
            });
            return;
        }

        messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
            code: consts.MsgFlowCode.InitEngine,
            des: data
        });
    });
}

/**
 * 2. 引擎发送一条握手消息确定已经绑定启动成功
 * @param {*} msg
 */
pro.onStateResponse = function (uid, msg) {
    let state_type = msg[0];
    let ret = msg[1];

    let sid = this.getSidByUid(uid);
    if (!sid) {
        logger.warn('用户[%s]不在线!', uid);
        return;
    }

    let uids = { uid: uid, sid: sid };
    if (state_type == 0) {
        // connectRep
        if (ret == true) {
            this.bindEngine(uid, true);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.ConnEngine
            });
        } else {
            messageService.pushMessageToPlayer(uids, 'onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.EngineHandleFail
            });
        }
    } else if(state_type == 1) {
        // startRep
        if (ret == true) {
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.StartSimulation,
            });
        } else {
            messageService.pushMessageToPlayer(uids, 'onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.StartSimulationFail
            });
        }
    } else if(state_type == 2) {
        // stopRep
        if (ret == true) {
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.StopSimulation,
            });
        } else {
            messageService.pushMessageToPlayer(uids, 'onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.StopSimulationFail
            });
        }
    } else if(state_type == 3) {
        // terminateRep
        if (ret == true) {
            this.unbindEngine(uid);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.ExitSimulation,
            });
        } else {
            messageService.pushMessageToPlayer(uids, 'onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.ExitSimulationFail
            });
        }
    }
}

pro.sendControlCmd = function (uids, cmdtype, cb) {
    utils.invokeCallback(cb);

    if (!this.checkIsBind(uids.uid)) {
        logger.warn("用户[%s]没有绑定引擎!", uids.uid);
        messageService.pushMessageToPlayer(uids, 'onMsgTips', {
            level: consts.TipsLevel.warn,
            tip: consts.MsgTipsCode.UserNoBindedEngine
        });
        return;
    }

    // 向引擎发命令
    this.zmqProcess.send({
        uid: uids.uid,
        route: 'ControlCmd',
        msg: {
            cmd_type: cmdtype,
        }
    });
}

// 引擎推送监控数据
pro.onSimuData = function (uid, msg) {
    // 结果推送给前端
    let sid = this.getSidByUid(uid);
    if (sid) {
        let uids = { uid: uid, sid: sid }
        messageService.pushMessageToPlayer(uids, 'onSimuData', {
            modelId: msg[0],
            portId: msg[1],
            value: msg[2][0]
        });
    }
}

pro.modifyParameter = function(uids, parameter, cb) {
    utils.invokeCallback(cb);

    if (!this.checkIsBind(uids.uid)) {
        logger.warn("用户[%s]没有绑定引擎!", uids.uid);
        messageService.pushMessageToPlayer(uids, 'onMsgTips', {
            level: consts.TipsLevel.warn,
            tip: consts.MsgTipsCode.UserNoBindedEngine
        });
        return;
    }

    for (let i = 0; i < parameter.length; i++) {
        let item = parameter[i];
        item._type = 'Parameter';
    }

    this.zmqProcess.send({
        uid: uids.uid,
        route: 'ModifyParameter',
        msg: {
            parameter: parameter,
        }
    });
}

pro.signalManage = function (uids, signal, cb) {
    utils.invokeCallback(cb);

    if (!this.checkIsBind(uids.uid)) {
        logger.warn("用户[%s]没有绑定引擎!", uids.uid);
        messageService.pushMessageToPlayer(uids, 'onMsgTips', {
            level: consts.TipsLevel.warn,
            tip: consts.MsgTipsCode.UserNoBindedEngine
        });
        return;
    }

    for (let i = 0; i < signal.length; i++) {
        let item = signal[i];
        item._type = 'Signal';
        item.monitor = item.monitor ? true : false;
        item.record = item.record ? true : false;
    }

    this.zmqProcess.send({
        uid: uids.uid,
        route: 'SignalManage',
        msg: {
            signal: signal,
        }
    });
}