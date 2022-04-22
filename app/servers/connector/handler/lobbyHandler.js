/**
 * Date: 2022/3/11
 * Author: admin
 * Description: 
 */
'use strict';
module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;

handler.getHttpSrvInfo = function (msg, session, next) {
	session.avatar.lobby.getHttpSrvInfo(next);
}

handler.enterProject = function (msg, session, next) {
	session.avatar.lobby.enterProject(msg.id, next);
}

handler.generateCode = function (msg, session, next) {
	session.avatar.lobby.generateCode(msg.genCodeInfos, next);
}

handler.deploy = function (msg, session, next) {
	session.avatar.lobby.deploy(msg.ip, next);
}

handler.initSimulation = function (msg, session, next) {
	session.avatar.lobby.initSimulation(msg.ip, next);
}

handler.sendControlCmd = function (msg, session, next) {
	session.avatar.lobby.sendControlCmd(msg.cmdtype, next);
}

handler.modifyParameter = function (msg, session, next) {
	session.avatar.lobby.modifyParameter(msg.parameter, next);
}

handler.signalManage = function (msg, session, next) {
	session.avatar.lobby.signalManage(msg.signal, next);
}

// 保存和新建
handler.savePanel = function (msg, session, next) {
	session.avatar.lobby.savePanel(msg.projectId, msg.panelDatas, next);
}

handler.deletePanel = function (msg, session, next) {
	session.avatar.lobby.deletePanel(msg.projectId, msg.panelId, next);
}

handler.deleteProject = function (msg, session, next) {
	session.avatar.lobby.deleteProject(msg.projectId, next);
}

handler.getModelList = function (msg, session, next) {
	session.avatar.lobby.getModelList(next);
}

handler.getModelInfo = function (msg, session, next) {
	session.avatar.lobby.getModelInfo(msg.modelId, next);
}

handler.modifyModelInfo = function (msg, session, next) {
	session.avatar.lobby.modifyModelInfo(msg.modelId, msg.modifyInfo, next);
}