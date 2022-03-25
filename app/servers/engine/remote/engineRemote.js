/**
 * Date: 2022/3/25
 * Author: admin
 * Description:
 */
'use strict';
module.exports = function (app) {
    return new Remote(app);
};

var Remote = function (app) {
    this.app = app;
};

var pro = Remote.prototype;

pro.generateCode = function (uids, projectUUID, genCodeInfos, cb) {
    this.app.engineStub.generateCode(uids, projectUUID, genCodeInfos, cb);
}

pro.deploy = function (uids, projectUUID, ip, cb) {
    this.app.engineStub.deploy(uids, projectUUID, ip, cb);
}

pro.initSimulation = function (uids, projectUUID, ip, cb) {
    this.app.engineStub.initSimulation(uids, projectUUID, ip, cb);
}

pro.startSimulation = function (uids, simuInfo, cb) {
    this.app.engineStub.startSimulation(uids, simuInfo, cb);
}