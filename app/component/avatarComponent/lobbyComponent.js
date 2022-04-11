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

let LobbyComponent = function (entity) {
    Component.call(this, entity);
};

util.inherits(LobbyComponent, Component);
module.exports = LobbyComponent;

let pro = LobbyComponent.prototype;

pro.init = function (opts) {
    this.projectUUID = 'yyyb_test';
    this._bindEvent();
}

pro._bindEvent = function () {
    this.entity.safeBindEvent("EventLogin", this._onLogin.bind(this));
    this.entity.safeBindEvent("EventDisconnect", this._onDisconnect.bind(this));
    this.entity.safeBindEvent("EventReconnect", this._onReconnect.bind(this));
};

pro._onLogin = function (entity) {
    const engines = pomelo.app.getServersByType('engine');
    for (let i = 0; i < engines.length; i++) {
        const res = engines[i];
        pomelo.app.rpc.engine.engineRemote.updateUserState.toServer(res.id, entity.id, entity.serverId, null);
    }
};

pro._onDisconnect = function (entity) {
	const engines = pomelo.app.getServersByType('engine');
    for (let i = 0; i < engines.length; i++) {
        const res = engines[i];
        pomelo.app.rpc.engine.engineRemote.updateUserState.toServer(res.id, entity.id, null, null);
    }
};

pro._onReconnect = function (entity) {
	const engines = pomelo.app.getServersByType('engine');
    for (let i = 0; i < engines.length; i++) {
        const res = engines[i];
        pomelo.app.rpc.engine.engineRemote.updateUserState.toServer(res.id, entity.id, entity.serverId, null);
    }
};

pro.getHttpSrvInfo = function (next) {
    let assets = pomelo.app.getServersByType('assets');
	let res = dispatcher.dispatch(this.entity.id, assets);
	next(null, {
        code: consts.Code.OK,
        host: res.httpHost,
        port: res.httpPort
    });
}

pro.enterProject = function (id, next) {
    this.projectUUID = id;
    this.entity.logger.info('projectUUID: ', id);

    pomelo.app.rpc.assets.assetsRemote.getProject(null, id, (rsp) => {
        next(null, rsp);
    });
}

// 远程调用引擎服务接口
pro._callRemote = function (funcName, ...args) {
	let engines = pomelo.app.getServersByType('engine');
	let res = dispatcher.dispatch(this.entity.id, engines);
    let uids = {uid: this.entity.id, sid: this.entity.serverId};
	pomelo.app.rpc.engine.engineRemote[funcName].toServer(res.id, uids, ...args);
}

// 生成代码暂时没做，当前是假设代码已经在远端，这里模拟把代码下载下来的过程。
// 生成代码名字必须是：projectUUID
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

    this._callRemote('generateCode', this.projectUUID, genCodeInfos, null);
}

pro.deploy = async function (ip, next) {
    next(null, { code: consts.Code.OK });

    if (!this.projectUUID) {
        this.entity.logger.warn("projectUUID is null!");
        this.entity.sendMessage('onMsgTips', {
            level: consts.TipsLevel.error,
            tip: consts.MsgTipsCode.NONProjectUUID
        });
        return;
    }

    this._callRemote('deploy', this.projectUUID, ip, null);
}

pro.initSimulation = async function (ip, next) {
    next(null, { code: consts.Code.OK });

    if (!this.projectUUID) {
        this.entity.logger.warn("projectUUID is null!");
        this.entity.sendMessage('onMsgTips', {
            level: consts.TipsLevel.error,
            tip: consts.MsgTipsCode.NONProjectUUID
        });
        return;
    }

    this._callRemote('initSimulation', this.projectUUID, ip, null);
}

pro.sendControlCmd = async function (cmdtype, next) {
    next(null, { code: consts.Code.OK });
    
    this._callRemote('sendControlCmd', cmdtype, null);
}