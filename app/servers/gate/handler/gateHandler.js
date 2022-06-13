'use strict';
var consts = require('../../../common/consts');
var dispatcher = require('../../../util/dispatcher');
var path = require('path');
var fs = require('fs');

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

    var code = msg.code;
	if(!code) {
		next(null, {code: consts.Login.FAIL});
		return;
	}
	// get all connectors
	var connectors = this.app.getServersByType('connector');
	if(!connectors || connectors.length === 0) {
		next(null, {code: consts.Login.FAIL});
		return;
	}

	// TODO: 临时写死上位机地址, 因为pkg打包这里要可配
	let pkgTest = path.join(process.cwd(), '/config/pkg_test.json');
    pkgTest = JSON.parse(fs.readFileSync(pkgTest));

	// select connector
	var res = dispatcher.dispatch(code, connectors);
	next(null, {
		code: consts.Login.OK,
		host: pkgTest.zmqHost,
		port: res.clientPort
	});
};
