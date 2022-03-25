/**
 * Date: 2022/3/25
 * Author: admin
 * Description:
 */
'use strict';
var pomelo = require('pomelo');
var consts = require('../common/consts');
var utils = require('../util/utils')
var logger = require('pomelo-logger').getLogger('cskl', '__filename');
let ssh2 = require('../util/ssh2');
let fs = require('fs');
let messageService = require('../services/messageService');

const remotePackagePath = '/home/package/yyyb1.zip';
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
};

var pro = EngineStub.prototype;

pro.generateCode = function (uids, projectUUID, genCodeInfos) {
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
pro.deploy = function (uids, projectUUID, ip) {
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

pro.initSimulation = function(uids, projectUUID, ip) {
    // 1. 运行(先关闭再运行)
    let pathCmd = "cd /home/" + projectUUID + "/bin/linux/;";
    let startCmd = "./start.sh";
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

        let flag = "port=";
        if(data.indexOf(flag) != -1) {
            let port = Number(data.split(flag)[1]);
            logger.info('engine start port: %d', port);
            // 2. 连接
            // this.client = new SocketClient();
            // this.client.init({ host: server.host, port: port }).then(() => {
            //     this.entity.sendMessage('onFlowMsg', { code: consts.MsgFlowCode.ConnEngine });
            // });

        }
    });
}

pro.startSimulation = function (uids, simuInfo) {
    
}

