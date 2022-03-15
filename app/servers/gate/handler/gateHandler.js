'use strict';
var consts = require('../../../common/consts');
var dispatcher = require('../../../util/dispatcher');

module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
};

var handler = Handler.prototype;

/**
 * Gate handler that dispatch user to connectors.
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param {Function} next next stemp callback
 *
 */
handler.queryEntry = function (msg, session, next) {
    // 维护中，禁止登录
    if (!this.app.get('canLogin')) {
        next(null, {code: consts.Login.MAINTAIN});
        return;
    }

    var uid = msg.uid;
	if(!uid) {
		next(null, {code: consts.Login.FAIL});
		return;
	}
	// get all connectors
	var connectors = this.app.getServersByType('connector');
	if(!connectors || connectors.length === 0) {
		next(null, {code: consts.Login.FAIL});
		return;
	}
	// select connector
	var res = dispatcher.dispatch(uid, connectors);
	next(null, {
		code: consts.Login.OK,
		host: res.clientHost,
		port: res.clientPort
	});
};
