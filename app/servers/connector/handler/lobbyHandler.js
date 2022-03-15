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

handler.findUserInfo = function (msg, session, next) {
	session.avatar.lobby.findUserInfo(msg.targetId, next);
};