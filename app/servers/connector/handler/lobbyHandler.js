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

handler.getProjectList = function (msg, session, next) {
	session.avatar.lobby.getProjectList(next);
}

handler.enterProject = function (msg, session, next) {
	session.avatar.lobby.enterProject(msg.id, next);
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

// 画板模型查看 -- block是画板模型
handler.getBlockInfo = function (msg, session, next) {
	session.avatar.lobby.getBlockInfo(msg.panelId, msg.blockId, msg.modelId, next);
}

handler.modifyBlockInfo = function (msg, session, next) {
	session.avatar.lobby.modifyBlockInfo(msg.panelId, msg.blockId, msg.modifyInfo, next);
}