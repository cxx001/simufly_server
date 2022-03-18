/**
 * Date: 2022/3/17
 * Author: admin
 * Description:
 */
'use strict';
let pomelo = require('pomelo');
let util = require('util');
let Component = require('../component');
let consts = require('../../common/consts');
let messageService = require('../../services/messageService');
let dispatcher = require('../../util/dispatcher');
let utils = require('../../util/utils');

let LobbyComponent = function (entity) {
    Component.call(this, entity);
};

util.inherits(LobbyComponent, Component);
module.exports = LobbyComponent;

let pro = LobbyComponent.prototype;

pro.init = function (opts) {
   
};

pro.generateCode = async function (ip, genCodeInfos, next) {
    next(null, {code: consts.Code.OK});
};

pro.deploy = async function (ip, next) {
    // 1.ssh登录 2.上传 3.解压 4.编译 5.运行
    

    next(null, {code: consts.Code.OK});
};

pro.connect = async function (ip, port, next) {
    next(null, {code: consts.Code.OK});
};

pro.start = async function (simuInfo, next) {
    next(null, {code: consts.Code.OK});
};