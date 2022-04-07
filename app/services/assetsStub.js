/**
 * Date: 2022/4/1
 * Author: admin
 * Description:
 */
'use strict';
const pomelo = require('pomelo');
const consts = require('../common/consts');
const utils = require('../util/utils')
const logger = require('pomelo-logger').getLogger('cskl', '__filename');
const fs = require('fs');
const messageService = require('../services/messageService');
const EventEmitter = require('events').EventEmitter;
const koa = require('../koa/main');

var instance = null;
module.exports = function (app) {
    if (instance) {
        return instance;
    }
    return instance = new AssetsStub(app);
}

var AssetsStub = function (app) {
    this.app = app;
    let assets = app.get('servers').assets;
    let assetsCfg = utils.find2key('id', app.get('serverId'), assets);
    let httpPort =  assetsCfg.httpPort;
    koa.start(httpPort);
}

var pro = AssetsStub.prototype;