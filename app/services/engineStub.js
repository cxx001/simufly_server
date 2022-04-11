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
const remotePackagePath = '/home/package/yyyb1.zip';   // 文件夹目录名要为项目对应的UUID
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
    this.zmqHost =  engineCfg.zmqHost;
    this.zmqReqPort = engineCfg.zmqReqPort;
    this.zmqRspPort = engineCfg.zmqRspPort;

    // 创建zmq通信子进程
    this._createChildProcess();

    // 绑定列表
    this.uid2engine = {};
    this.uid2sid = {};
};

var pro = EngineStub.prototype;

pro._createChildProcess = function () {
    let process = child_process.spawn('node', ['./app/util/zmq.js'], {stdio: [null, null, null, 'ipc']});
    process.stdout.on('data', function (data) {
        logger.info('zmq进程日志: ' + data);
    });
    
    process.stderr.on('data', function (data) {
        logger.warn('zmq进程错误: ' + data);
    });
    
    process.on('close', function (code) {
        logger.info('zmq进程已退出, 退出码: '+ code);
    });
    
    process.on('message', (m) => {
        // onXxxx
        let func = 'on' + m.route;
        if (this[func]) {
            this[func](m.msg);
        }
    });

    let msg = {
        route: 'init',
        msg:  {zmqReqPort: this.zmqReqPort, zmqRspPort: this.zmqRspPort}
    }
    process.send(msg);

    // 模拟向引擎发送
    // setInterval(() => {
    //     process.send({
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

pro.bindEngine = (uid, opt) => {
    if (this.uid2engine[uid]) {
        logger.warn("用户[%s]已经绑定引擎!", uid);
        return;
    }

    this.uid2engine[uid] = opt;
    logger.info("用户[%s]已经和引擎绑定.", uid);
}

pro.unbindEngine = (uid) => {
    delete this.uid2engine[uid];
    logger.info("用户[%s]已经和引擎解绑.", uid);
}

pro.checkIsBind = (uid) => {
    if (this.uid2engine[uid]) {
        return true;
    }
    return false;
}

pro.generateCode = function (uids, projectUUID, genCodeInfos, cb) {
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

    let remotePath = '/home/' + projectUUID + '.zip'
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

        let pathCmd1 = "cd /home/;"
        let unzipCmd = "unzip -o ./" + projectUUID + ".zip;"
        let pathCmd2 = "cd ./" + projectUUID + "/bin/linux/;";
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
                data: data
            });
        });
    });
}

// 1. 启动引擎
pro.initSimulation = function(uids, projectUUID, ip, cb) {
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
    let pathCmd = "cd /home/" + projectUUID + "/bin/linux/;";
    let startCmd = "./start.sh";   // uid reqport rspport
    let cmd = pathCmd + startCmd + "\r\nexit\r\n";
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
            data: data
        });
    });
}

/**
 * 2. 引擎发送一条握手消息确定已经绑定启动成功
 * @param {*} msg 内容要包含 uid reqport rspport
 */
pro.onEngineHandler = (msg) => {
    logger.info(msg);
    let uid = msg[0];
    this.bindEngine(uid, true);

    // 结果推送给前端

}

pro.sendControlCmd = function (uids, cmdtype, cb) {
    utils.invokeCallback(cb);
    
    // 向引擎发命令

}

// 引擎运行推送
pro.onEngineCmd = (msg) => {
    logger.info(msg);
    let uid = msg[0];

}

