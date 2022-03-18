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

handler.generateCode = function (msg, session, next) {
	session.avatar.lobby.generateCode(msg.ip, msg.genCodeInfos, next);
};

handler.deploy = function (msg, session, next) {
	session.avatar.lobby.deploy(msg.ip, next);
};

handler.connect = function (msg, session, next) {
	session.avatar.lobby.connect(msg.ip, msg.port, next);
};

handler.start = function (msg, session, next) {
	session.avatar.lobby.start(msg.simuInfo, next);
};