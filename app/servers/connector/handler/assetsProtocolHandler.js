/**
 * Date: 2022/5/27
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

handler.setEntityProtocol = function (msg, session, next) {
    session.avatar.assetsProtocol.setEntityProtocol(msg.protocolId, msg.protocolInfo, next);
}

handler.deleteEntityProtocol = function (msg, session, next) {
    session.avatar.assetsProtocol.deleteEntityProtocol(msg.protocolId, next);
}