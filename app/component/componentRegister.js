/**
 * Date: 2022/3/11
 * Author: admin
 * Description: 负责component注册
 */
'use strict';
let LoggerComponent = require('./entityComponent/loggerComponent');
let AvatarPropertyCtrl = require('./avatarComponent/avatarPropertyCtrl');

var componentClass = {
	logger: LoggerComponent,
	avatarProp: AvatarPropertyCtrl,
};

var componentRegister = module.exports;

componentRegister.getComponent = function (name) {
    return componentClass[name];
};
