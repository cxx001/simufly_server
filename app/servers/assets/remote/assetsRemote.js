/**
 * Date: 2022/4/1
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

var pro = Remote.prototype;

pro.generateCode = function (uids, projectUUID, genCodeInfos, cb) {
    this.app.engineStub.generateCode(uids, projectUUID, genCodeInfos, cb);
}
