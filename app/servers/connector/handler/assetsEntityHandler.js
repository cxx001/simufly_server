/**
 * Date: 2022/5/17
 * Author: admin
 * Description: 
 */
'use strict';
module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
};

var handler = Handler.prototype;

handler.getEntityInfo = function (msg, session, next) {
	session.avatar.assetsEntity.getEntityInfo(msg.entityId, next);
}

handler.setEntityInfo = function (msg, session, next) {
	session.avatar.assetsEntity.setEntityInfo(msg.entityId, msg.modifyInfo, next);
}