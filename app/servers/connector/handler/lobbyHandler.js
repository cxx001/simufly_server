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

handler.enterProject = function (msg, session, next) {
	session.avatar.lobby.enterProject(msg.id, next);
};

handler.generateCode = function (msg, session, next) {
	session.avatar.lobby.generateCode(msg.genCodeInfos, next);
};

handler.deploy = function (msg, session, next) {
	session.avatar.lobby.deploy(msg.ip, next);
};

handler.initSimulation = function (msg, session, next) {
	session.avatar.lobby.initSimulation(msg.ip, next);
};

handler.startSimulation = function (msg, session, next) {
	session.avatar.lobby.startSimulation(msg.simuInfo, next);
};