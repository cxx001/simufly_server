/**
 * Date: 2022/5/5
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

handler.getSimulateInfo = function (msg, session, next) {
    session.avatar.simulate.getSimulateInfo(next);
}

handler.assignTask = function (msg, session, next) {
    session.avatar.simulate.assignTask(msg.assignList, next);
}

handler.generateCode = function (msg, session, next) {
    session.avatar.simulate.generateCode(msg, next);
}

handler.deploy = function (msg, session, next) {
    session.avatar.simulate.deploy(next);
}

handler.connectEngine = function (msg, session, next) {
    session.avatar.simulate.connectEngine(msg.simuTime, msg.simuStep, next);
}

handler.disconnectEngine = function (msg, session, next) {
    session.avatar.simulate.disconnectEngine(next);
}

handler.startSimulate = function (msg, session, next) {
    session.avatar.simulate.startSimulate(next);
}

handler.pauseSimulate = function (msg, session, next) {
    session.avatar.simulate.pauseSimulate(next);
}

handler.stopSimulate = function (msg, session, next) {
    session.avatar.simulate.stopSimulate(next);
}

handler.exitSimulate = function (msg, session, next) {
    session.avatar.simulate.exitSimulate(next);
}

handler.updateSignalList = function (msg, session, next) {
    session.avatar.simulate.updateSignalList(msg.signal, next);
}

handler.modifyParameter = function (msg, session, next) {
    session.avatar.simulate.modifyParameter(msg.parameter, next);
}

handler.setTrigger = function (msg, session, next) {
    session.avatar.simulate.setTrigger(msg, next);
}