/**
 * Date: 2022/3/11
 * Author: admin
 * Description:
 */
'use strict';
let pomelo = require('pomelo');
var entityManager = require('../../../services/entityManager');
var logger = require('pomelo-logger').getLogger('cskl', __filename);
var consts = require('../../../common/consts');

module.exports = function(app) {
    return new Remote(app);
};

var Remote = function(app) {
    this.app = app;
};

var pro = Remote.prototype;

// 全服广播入口
pro.onGlobalMessage = function (route, msg, cb) {
    let avatars = entityManager.getEntitiesByClass('Avatar');
    let funcPres = route.split('.');
    // todo: 考虑分段处理
    for (let avatar of avatars) {
        let func = avatar, env = avatar, len = funcPres.length;
        for (let i = 0; i < len; i++) {
            func = func[funcPres[i]];
            if (i !== len - 1) {
                env = func;
            }
        }
        func.call(env, msg);
    }
    cb();
};

// 查询用户
pro.onFindUserInfo = function (avtID, cb) {
    var avatar = entityManager.getEntity(avtID);
    if (avatar) {
        cb(avatar.getUserInfo());
    } else {
        cb(null);
    }
};

pro.onEngineResponse = function (avtID, code, cb) {
    var avatar = entityManager.getEntity(avtID);
    if (avatar) {
        avatar.simulate.onEngineResponse(code);
        cb();
    }
}

pro.onEngineHeart = function (avtID, state, cb) {
    var avatar = entityManager.getEntity(avtID);
    if (avatar) {
        avatar.simulate.onEngineHeart(state);
        cb();
    }
}

pro.onEngineSimuData = function (avtID, data, cb) {
    var avatar = entityManager.getEntity(avtID);
    if (avatar) {
        avatar.simulate.onEngineSimuData(data);
        cb();
    }
}