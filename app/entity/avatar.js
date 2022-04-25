/**
 * Date: 2022/3/11
 * Author: admin
 * Description: 
 */
'use strict';
var pomelo = require('pomelo');
var util = require('util');
var Entity = require('./entity');
var messageService = require('../services/messageService');
var consts = require('../common/consts');

var AUTO_SAVE_TICK = 1000 * 60 * 3  // 自动存盘时间

var Avatar = function (opts) {
    opts = opts || {};
    // avatar组件
    opts.components = ['avatarProp', 'lobby'];
    Entity.call(this, opts);

    this.logoutTimer = null;
    this.serverId = pomelo.app.get('serverId');

	this.session_key = opts.session_key ? opts.session_key : "";
	this.createTime = opts.createTime ? opts.createTime : Date.now();
    this.sessionSetting = {}  // session设置

    this.initDBModel();  // 初始化存盘的Model
    this.dbTimer = setInterval(function () {
        this.save();
    }.bind(this), AUTO_SAVE_TICK);  // 自动存盘

    pomelo.app.rpc.auth.authRemote.checkin.toServer('auth-server-1', this.openid, this.id, pomelo.app.getServerId(), null);
};

util.inherits(Avatar, Entity);
module.exports = Avatar;

let pro = Avatar.prototype;

pro.initDBModel = function () {
    this.db = pomelo.app.db.getModel("Avatar");
};

pro.updateUserInfo = function (userInfo, bLogin) {
    this.name = userInfo.name;
    this.password = userInfo.password;

    if (bLogin) {
        this.emit("EventLogin", this);
    }
};

pro.modifyProList = function (optype, pro_info) {
    if (optype == consts.ControlType.Add) {
        // 新增
        this.projectList.push(pro_info);
    } else if(optype == consts.ControlType.Delete) {
        // 删除
        for (let i = 0; i < this.projectList.length; i++) {
            let item = this.projectList[i];
            if (pro_info.id == item.id) {
                this.projectList.splice(i, 1);
                break;
            }
        }
    }
}

/**
 * 
 * @param {*} groupName 
 * @param {*} modelInfo 
 * modelInfo = {
    id: string,
    name: string,
    groupId: int,
    width: int,
    height: int,
    nodeType: int,
    ports: object
  }
 * @returns 
 */
pro.setModelGroup = function (groupName, modelInfo) {
    // 添加分组信息
    let groupId = null;
    for (let i = 0; i < this.groupList.length; i++) {
        const item = this.groupList[i];
        if (item == groupName) {
            groupId = i;
        }
    }
    if (!groupId && groupId != 0) {
        this.groupList.push(groupName);
        groupId = this.groupList.length - 1;
    }
    
    // 添加模型信息
    let isModify = false;
    modelInfo.groupId = groupId;
    for (let i = 0; i < this.modelList.length; i++) {
        let item = this.modelList[i];
        if (item.id == modelInfo.id) {
            if (modelInfo.name) {
                // 覆盖修改
                this.modelList[i] = modelInfo;
            } else {
                // 如果modelInfo只传了id, 则只是修改分组信息
                item.groupId = groupId;
                this.modelList[i] = item;
            }
            isModify = true;
            break;
        }
    }
    if (!isModify) {
        this.modelList.push(modelInfo);
    }
    return groupId;
}

pro.modifyModelGroup = function (modelId, groupId) {
    for (let i = 0; i < this.modelList.length; i++) {
        let item = this.modelList[i];
        if (item.id == modelId) {
            item.groupId = groupId;
        }
    }
}

// 存盘信息更新
pro.getDBProp = function () {
    let props = this.avatarProp.getPersistProp();
    props['_id'] = this.id;
    return props;
};

// 存盘
pro.save = function (cb) {
    var self = this;
    var prop = self.getDBProp();
    var options = {upsert: true};
    self.db.update({_id: self.id}, prop, options, function (err, product) {
        if (err) {
            self.logger.info(" save db error: " + err);
            if (cb) {
                cb(false);
            }
            return;
        }
        self.logger.info(" save db success.");
        if (cb) {
            cb(true);
        }
    });
};

// 登录时发给客户端
pro.clientLoginInfo = function () {
	return {
        uid: this.id,
		projectList: this.projectList,
        groupList: this.groupList,
        modelList: this.modelList,
	}
};

// 增加session setting
pro.setSessionSetting = function (key, value) {
    this.sessionSetting[key] = value;
};

pro._getCurSession = function () {
    var sessionService = pomelo.app.get('sessionService');
    var sessions = sessionService.getByUid(this.id);
    if (!sessions || sessions.length === 0) {
        this.logger.error("get current session failed.");
        return null;
    }
    return sessions[0];
};

pro.removeSessionSetting = function (key, bSync) {
    delete this.sessionSetting[key];
    if (bSync) {
        var session = this._getCurSession();
        if (session) {
            // session.remove(key);
            session.set(key, undefined);
        }
    }
};

pro.importSessionSetting = function (cb) {
    var session = this._getCurSession();
    if (session) {
        session.set(this.sessionSetting);
        if (cb)
            cb(consts.Code.OK);
    }
    else {
        if (cb)
            cb(consts.Code.FAIL);
    }
    // var self = this;
    // sessionService.importAll(session.id, this.sessionSetting, function(err) {
    //     if (err) {
    //         self.logger.error('import session setting failed! error is : %j', err.stack);
    //         if (cb)
    //             cb(consts.Code.FAIL);
    //         return;
    //     }
    //     if (cb)
    //         cb(consts.Code.OK);
    // })
};

// 发信息给客户端
pro.sendMessage = function (route, msg, flush=false) {
    let opts = undefined;
    if (flush)
        opts = {flush: true};
    messageService.pushMessageToPlayer({
        uid: this.id,
        sid: this.serverId
    }, route, msg, opts);
};

// 通过avatarID，尝试调用对用avatar的方法
pro.callAvatar = function (avatarID, funcName, ...args) {
    pomelo.app.rpc.auth.authRemote.callOnlineAvtMethod.toServer('auth-server-1', avatarID, funcName, ...args);
};

// 连接断开
pro.disconnect = function () {
    this.logger.info("Avatar disconnect.");
    this.logoutTimer = setTimeout(function () {
        this.destroy();
    }.bind(this), 1000 * 60 * 5);  // 离线缓冲
	this.emit("EventDisconnect", this);
	this.lastOfflineTime = Date.now();
};

// 重新连接
pro.reconnect = function () {
    this.logger.info("Avatar reconnect.");
    if (this.logoutTimer) {
        clearTimeout(this.logoutTimer);
        this.logoutTimer = null;
    }
    else {
        // 给客户端提示顶号
        // this.sendMessage('onBeRelay', {}, true);
	}
};

// 踢下线
pro.kickOffline = function (reason, rightNow) {
    let sessionService = pomelo.app.get('sessionService');
    sessionService.kick(this.id, reason, function () {
        if (rightNow) {
            this.destroy();
            this.lastOfflineTime = Date.now();
        }
    })
};

// 销毁
pro.destroy = function (cb) {
    // todo: 先放这里，后续可能会有其他登出流程
    this.emit("EventLogout", this);
    var self = this;
    self.emit('EventDestory', this);
    pomelo.app.rpc.auth.authRemote.checkout.toServer('auth-server-1', self.openid, self.uid, null);
    // 存盘
    clearInterval(self.dbTimer);
    self.dbTimer = null;
    if (self.logoutTimer) {
        clearTimeout(self.logoutTimer);
        self.logoutTimer = null;
    }

    self.save(function (r) {
        if (cb)
            cb();
        self.logger.info("Avatar Destroyed.");
        Entity.prototype.destroy.call(self);
    });
};
