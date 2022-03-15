/**
 * Date: 2022/3/11
 * Author: admin
 * Description:
 */
'use strict';
module.exports = function (app) {
    return new Remote(app);
}

var Remote = function (app) {
    this.app = app;
}

var pro  = Remote.prototype

// 登录
pro.checkin = function (openid, uid, sid, cb) {
    this.app.get('rollStub').checkin(openid, uid, sid, cb);
};

// 覆盖登入
pro.globalCheckin = function (openid, uid, sid, cb) {
	this.app.get('rollStub').globalCheckin(openid, uid, sid, cb);
};

// 重新登录
pro.relayCheckin = function (openid, uid, sid, cb) {
    this.app.get('rollStub').relayCheckin(openid, uid, sid, cb);
};

// 登出
pro.checkout = function (openid, uid, cb) {
    this.app.get('rollStub').checkout(openid, uid, cb);
};

// 获取用户sid
pro.getUid2Sid = function (uid, cb) {
    this.app.get('rollStub').getUid2Sid(uid, cb);
};

pro.callOnlineAvtsMethod = function (...args) {
    this.app.get('rollStub').callOnlineAvtsMethod(...args);
};
