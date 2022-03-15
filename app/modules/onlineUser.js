
'use strict';
var async = require('async');
var entityManager = require('../services/entityManager');

module.exports = function (opts) {
    return new Module(opts);
};

module.exports.moduleId = 'onlineUser';

var Module = function (opts) {
    opts = opts || {};
    this.app = opts.app;
};

Module.prototype.monitorHandler = function (agent, msg, cb) {
    var app = this.app;

    var connection = app.components.__connection__;
    if (!connection) {
        cb({
            serverId: agent.id,
            body: 'error'
        });
        return;
    }

    var connectionService = this.app.components.__connection__;
    if (!connectionService) {
        // logger.error('not support connection: %j', agent.id);
        return;
    }
    var info = connectionService.getStatisticsInfo();
    // 插入用户名字
    var loginedList = info.loginedList
    for (const key in loginedList) {
        let user = loginedList[key];
        let avatar = entityManager.getEntity(user.uid);
        if (avatar) {
            loginedList[key].username = avatar.name;
        } else {
            console.warn('avatar entity no exist!', user);
        }
    }
    console.log('serverId: ', agent.id, ' onlineCount: ', loginedList.length);

    cb(null, {
        serverId: agent.id,
        body: info,
    });
};

Module.prototype.clientHandler = function (agent, msg, cb) {
    var app = this.app;
    var servers = app.getServersByType('connector');
    var onLineUser = {};
    if (servers) {
        async.mapSeries(servers, function (server, callback) {
            agent.request(server.id, module.exports.moduleId, msg, function (err, resp) {
                if (err) {
                    cb(null, { body: 'err' });
                    return;
                }
                onLineUser[server.id] = resp;
                callback();
            });
        }, function (err, res) {
            cb(null, {
                body: onLineUser
            });
        });
    } else {
        cb(null, { body: onLineUser });
    }
};