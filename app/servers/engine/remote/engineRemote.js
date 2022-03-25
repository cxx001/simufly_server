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

pro.generateCode = function (uids, projectUUID, genCodeInfos) {
    this.app.engineStub.generateCode(uids, projectUUID, genCodeInfos);
}

pro.deploy = function (uids, projectUUID, ip) {
    this.app.engineStub.deploy(uids, projectUUID, ip);
}

pro.initSimulation = function (uids, projectUUID, ip) {
    this.app.engineStub.initSimulation(uids, projectUUID, ip);
}

pro.startSimulation = function (uids, simuInfo) {
    this.app.engineStub.startSimulation(uids, simuInfo);
}