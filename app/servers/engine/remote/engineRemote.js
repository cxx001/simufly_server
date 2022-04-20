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

pro.updateUserState = function (uid, sid, cb) {
    this.app.engineStub.updateUserState(uid, sid, cb);
}

pro.generateCode = function (uids, projectUUID, genCodeInfos, cb) {
    this.app.engineStub.generateCode(uids, projectUUID, genCodeInfos, cb);
}

pro.deploy = function (uids, projectUUID, ip, cb) {
    this.app.engineStub.deploy(uids, projectUUID, ip, cb);
}

pro.initSimulation = function (uids, projectUUID, ip, cb) {
    this.app.engineStub.initSimulation(uids, projectUUID, ip, cb);
}

pro.sendControlCmd = function (uids, cmdtype, cb) {
    this.app.engineStub.sendControlCmd(uids, cmdtype, cb);
}

pro.modifyParameter = function (uids, parameter, cb) {
    this.app.engineStub.modifyParameter(uids, parameter, cb);
}

pro.signalManage = function (uids, signal, cb) {
    this.app.engineStub.signalManage(uids, signal, cb);
}