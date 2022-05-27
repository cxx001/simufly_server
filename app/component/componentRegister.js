/**
 * Date: 2022/3/11
 * Author: admin
 * Description: 负责component注册
 */
'use strict';
let LoggerComponent = require('./entityComponent/loggerComponent');
let AvatarPropertyCtrl = require('./avatarComponent/avatarPropertyCtrl');
let LobbyComponent = require('./avatarComponent/lobbyComponent');
let AssetsModelComponent = require('./avatarComponent/assetsModelComponent');
let AssetsEntityComponent = require('./avatarComponent/assetsEntityComponent');
let AssetsProtocolComponent = require('./avatarComponent/assetsProtocolComponent');
let SimulateComponent = require('./avatarComponent/simulateComponent');

var componentClass = {
	logger: LoggerComponent,
	avatarProp: AvatarPropertyCtrl,
	lobby: LobbyComponent,
	assetsModel: AssetsModelComponent,
	assetsEntity: AssetsEntityComponent,
	assetsProtocol: AssetsProtocolComponent,
	simulate: SimulateComponent,
};

var componentRegister = module.exports;

componentRegister.getComponent = function (name) {
    return componentClass[name];
};
