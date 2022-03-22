/**
 * Date: 2022/3/17
 * Author: admin
 * Description:
 */
'use strict';
let pomelo = require('pomelo');
let util = require('util');
let Component = require('../component');
let consts = require('../../common/consts');
let messageService = require('../../services/messageService');
let dispatcher = require('../../util/dispatcher');
let utils = require('../../util/utils');
let ssh2 = require('../../util/ssh2');
let fs = require('fs');
let SocketClient = require('../../util/websocket-client');

const server = {
    host: '1.15.46.131',
    port: 22,
    username: 'root',
    password: 'cfgame123',
}

let LobbyComponent = function (entity) {
    Component.call(this, entity);
};

util.inherits(LobbyComponent, Component);
module.exports = LobbyComponent;

let pro = LobbyComponent.prototype;

pro.init = function (opts) {
    this.projectUUID = null;
    if (this.client) {
        this.client.disconnect();
        this.client = null;
    }
}

pro.enterProject = function (id, next) {
    this.projectUUID = id;
    next(null, { 
        code: consts.Code.OK,
        draw: {
            nodes: [],
            edges: [],
        }
    });
}

// 生成代码暂时没做，当前是假设代码已经在远端，这里模拟把代码下载下来的过程。
pro.generateCode = async function (genCodeInfos, next) {
    next(null, { code: consts.Code.OK });

    if (!this.projectUUID) {
        this.entity.logger.warn("projectUUID is null!");
        this.entity.sendMessage('onMsgTips', {
            level: consts.TipsLevel.error,
            tip: consts.MsgTipsCode.NONProjectUUID
        });
        return;
    }

    let userDir = './assets/' + this.entity.id;
    if (!fs.existsSync(userDir)) {
        if(fs.mkdirSync(userDir)) {
            this.entity.logger.warn("create path[%s] dir fail!", userDir);
            this.entity.sendMessage('onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.CreateDirFail
            });
            return;
        }
    }

    let remotePath = '/home/demo.zip'
    let localPath = userDir + '/' + this.projectUUID + '.zip'
    ssh2.DownloadFile(server, remotePath, localPath, (err, data) => {
        if (err) {
            this.entity.logger.warn('ssh download GenCode file fail! err: %o', err);
            this.entity.sendMessage('onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.GenCodeFail
            });
            return;
        }
        this.entity.sendMessage('onFlowMsg', {code: consts.MsgFlowCode.GenCode});
    })
}

pro.deploy = async function (ip, next) {
    next(null, { code: consts.Code.OK });

    // 1.ssh登录 2.上传 3.解压 4.编译 5.运行
    let localPath = './assets/' + this.entity.id + '/' + this.projectUUID + '.zip';
    if (!fs.existsSync(localPath)) {
        this.entity.logger.warn("deploy path[%s] not exist!", localPath);
        this.entity.sendMessage('onMsgTips', {
            level: consts.TipsLevel.error,
            tip: consts.MsgTipsCode.NONDeployPath
        });
        return;
    }

    let remotePath = '/home/' + this.projectUUID + '.zip'
    ssh2.UploadFile(server, localPath, remotePath , (err, result) => {
        if (err) {
            this.entity.logger.warn('ssh upload deploy file fail! err: %o', err);
            this.entity.sendMessage('onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.DeployUploadFail
            });
            return;
        }
        this.entity.sendMessage('onFlowMsg', {code: consts.MsgFlowCode.DeployUpload});

        let cmd = "find /home/test -type d" + "\r\nexit\r\n";
        ssh2.Shell(server, cmd, (err, data) => {
            if (err) {
                this.entity.logger.warn('ssh shell commond fail! err: %o', err);
                this.entity.sendMessage('onMsgTips', {
                    level: consts.TipsLevel.error,
                    tip: consts.MsgTipsCode.DeployDoShellFail
                });
                return;
            }

            this.entity.sendMessage('onFlowMsg', {
                code: consts.MsgFlowCode.DeployDoShell,
                data: data
            });
        });
    });
}

pro.initSimulation = async function (ip, next) {
    next(null, { code: consts.Code.OK });

    // 1. 运行(先关闭再运行)
    let cmd = "find /home/test -type d" + "\r\nexit\r\n";
    await ssh2.Shell(server, cmd, (err, data) => {
        if (err) {
            this.entity.logger.warn('ssh shell commond fail! err: %o', err);
            this.entity.sendMessage('onMsgTips', {
                level: consts.TipsLevel.error,
                tip: consts.MsgTipsCode.InitEngineFail
            });
            return;
        }

        this.entity.sendMessage('onFlowMsg', {
            code: consts.MsgFlowCode.InitEngine,
            data: data
        });
    });

    // 2. 连接
    // this.client = new SocketClient();
    // this.client.init({host: server.host, port: 0}).then( () => {
        this.entity.sendMessage('onFlowMsg', {code: consts.MsgFlowCode.ConnEngine});
    // });
}

pro.startSimulation = async function (simuInfo, next) {
    next(null, { code: consts.Code.OK });
    // this.client.request('start', {simuInfo: simuInfo}). then((data) => {
        // this.entity.sendMessage('onFlowMsg', {
        //     code: consts.MsgFlowCode.StartSimulation
        // });
    // });
    let index = 0;
    this.startSchedule(1000, () => {
        this.entity.sendMessage('onFlowMsg', {
            code: consts.MsgFlowCode.StartSimulation,
            data: '开始仿真 ' + index++
        });
    });
}