/**
 * Date: 2022/5/17
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

let AssetsEntityComponent = function (entity) {
    Component.call(this, entity);
};

util.inherits(AssetsEntityComponent, Component);
module.exports = AssetsEntityComponent;

let pro = AssetsEntityComponent.prototype;

pro.init = function (opts) {
    
}

pro.getEntityList = function (next) {
    next(null, {
        code: consts.Code.OK,
        groupList: this.entity.groupList,
        entityList: this.entity.entityList
    });
}