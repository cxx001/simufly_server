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
}

pro._onLogin = function (entity) {
    const engines = pomelo.app.getServersByType('engine');
    for (let i = 0; i < engines.length; i++) {
        const res = engines[i];
        pomelo.app.rpc.engine.engineRemote.updateUserState.toServer(res.id, entity.id, entity.serverId, null);
    }
}

pro._onDisconnect = function (entity) {
	const engines = pomelo.app.getServersByType('engine');
    for (let i = 0; i < engines.length; i++) {
        const res = engines[i];
        pomelo.app.rpc.engine.engineRemote.updateUserState.toServer(res.id, entity.id, null, null);
    }
}

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
    this.entity.logger.info('进入项目=> ', id);

    pomelo.app.rpc.assets.assetsRemote.getProject(null, id, (rsp) => {
        next(null, rsp);
    });
}

pro.savePanel = function (projectId, panelDatas, next) {
    this.entity.logger.info('保存项目=> ', projectId);

    pomelo.app.rpc.assets.assetsRemote.savePanel(null, projectId, panelDatas, (rsp) => {
        next(null, rsp);
    });
}

pro.deletePanel = function (projectId, panelId, next) {
    this.entity.logger.info('删除面板=> ', projectId, panelId);

    pomelo.app.rpc.assets.assetsRemote.deletePanel(null, projectId, panelId, (rsp) => {
        next(null, rsp);
    });
}

pro.deleteProject = function (projectId, next) {
    this.entity.logger.info('删除项目=> ', projectId);

    this.entity.modifyProList(consts.ControlType.Delete, {id: projectId});
    pomelo.app.rpc.assets.assetsRemote.deleteProject(null, projectId, (rsp) => {
        next(null, rsp);
    });
}

pro.getModelList = function (next) {
    next(null, {
        code: consts.Code.OK,
        groupList: this.entity.groupList,
        modelList: this.entity.modelList
    });
}

pro.getModelInfo = function (modelId, next) {
    pomelo.app.rpc.assets.assetsRemote.getModelInfo(null, modelId, (rsp) => {
        next(null, rsp);
    });
}

pro.modifyModelInfo = function (modelId, modifyInfo, next) {
    let groupId = modifyInfo.groupId;
    if (groupId) {
        this.entity.modifyModelGroup(modelId, groupId);
    }
    pomelo.app.rpc.assets.assetsRemote.modifyModelInfo(null, modelId, modifyInfo, (rsp) => {
        next(null, rsp);
    });
}

pro.getBlockInfo = function (panelId, blockId, modelId, next) {
    if (!this.projectUUID) {
        this.entity.logger.warn("项目ID不存在!");
        next(null, {code: consts.Code.FAIL});
        return;
    }

    // 1. 先project表中找修改字段
    pomelo.app.rpc.assets.assetsRemote.getDBProject(null, this.projectUUID, (resp) => {
        if (resp.code == consts.Code.OK) {
            let project = resp.project;
            let modifyAttr = {};
            for (let i = 0; i < project.data.length; i++) {
                const item = project.data[i];
                if (item.id == panelId) {
                    for (let j = 0; j < item.block.length; j++) {
                        const element = item.block[j];
                        if (element.id == blockId) {
                            modifyAttr = element.modifyAttr || {};
                            break;
                        }
                    }
                    break;
                }
            }

            // 2. 如果没有再去model表中取默认字段
            pomelo.app.rpc.assets.assetsRemote.getModelInfo(null, modelId, (rsp) => {
                if (rsp.code == consts.Code.OK) {
                    next(null, {
                        code: consts.Code.OK,
                        modelId: modelId,
                        Name: modifyAttr.Name ? modifyAttr.Name : rsp.Name,
                        Description: modifyAttr.Description ? modifyAttr.Description : rsp.Description,
                        Parameters: this._splitBlockParameters(rsp.Parameters, modifyAttr.Parameters),
                        X_State: this._splitBlockParameters(rsp.X_State, modifyAttr.X_State),
                        Y_Output: this._splitBlockParameters(rsp.Y_Output, modifyAttr.Y_Output),
                        U_Input: this._splitBlockParameters(rsp.U_Input, modifyAttr.U_Input),
                    });
                } else {
                    this.entity.logger.warn('获取模块[%s]信息失败!', modelId);
                    next(null, {code: rsp.code});
                }
            });

        } else {
            this.entity.logger.warn('获取项目[%s]信息失败!', this.projectUUID);
            next(null, {code: resp.code});
        }
    });
}

pro._splitBlockParameters = function(srcParams, modifyParams) {
    modifyParams = modifyParams || [];
    for (let i = 0; i < modifyParams.length; i++) {
        const item = modifyParams[i];
        srcParams[item.index].Default = item.Default;
    }
    return srcParams;
}

pro.modifyBlockInfo = function (panelId, blockId, modifyInfo, next) {
    if (!this.projectUUID) {
        this.entity.logger.warn("项目ID不存在!");
        next(null, {code: consts.Code.FAIL});
        return;
    }

    pomelo.app.rpc.assets.assetsRemote.modifyBlockInfo(null, this.projectUUID, panelId, blockId, modifyInfo, (rsp) => {
        next(null, rsp);
    });
}