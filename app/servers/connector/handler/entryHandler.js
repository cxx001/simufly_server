'use strict';
var pomelo = require('pomelo');
var fly = require('flyio');
var lodash = require('lodash');
var logger = require('pomelo-logger').getLogger('cskl', __filename);
var entityManager = require('../../../services/entityManager');
var entityFactory = require('../../../entity/entityFactory');
var consts = require('../../../common/consts');
var path = require('path');
var fs = require('fs');

module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
};

var handler = Handler.prototype;

/**
 * New client entry chat server.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next stemp callback
 * @return {Void}
 */
handler.enter = function (msg, session, next) {
    // 维护中，禁止登录
    if (!this.app.get('canLogin')) {
        next(null, {code: consts.Login.MAINTAIN});
        return;
	}
	
    let code = msg.code, userInfo = msg.userInfo, platform = msg.platform || consts.Platform.WIN;
    // code预留字段, 当前没含义
    if (!code) {
        next(null, {code: consts.Login.FAIL});
        return;
	}
	
    if (platform === consts.Platform.WIN) {
        // 当前约定code就是account, code作为openid
        doLogin(this.app, session, next, code, "", userInfo);
    } else {
        next(null, {code: consts.Login.NONSUPPORT});
        return;
    }
};

var doLogin = function (app, session, next, openid, session_key, userInfo) {
    let account = userInfo.account;
    let password = userInfo.password;
    if (account == "undefined" || password == "undefined") {
        next(null, {code: consts.Login.CHECKFAIL});
        return;
    }

    // 查db
    app.db.find("Avatar", {"openid": openid}, ["_id", "account", "password"], null, function (err, docs) {
        if (err) {
            logger.error("db find avatar error" + err);
            next(null, {code: consts.Login.FAIL});
            return;
		}

        // 当前不考虑注册, 账号内置
        if (docs.length == 0) {
            logger.warn("db find avatar[%s] not exist!", account);
            next(null, {code: consts.Login.NONACCOUNT});
            return;
        }

        // 账号校验暂时没做加密处理
        let srcAccount = docs[0]["account"];
        let srcPassword = docs[0]["password"];
        if (account != srcAccount || password != srcPassword) {
            logger.warn("account or password check fail! account:%s, password:%s.", account, password);
            next(null, {code: consts.Login.CHECKFAIL});
            return;
        }

        let uid = docs[0]["_id"];
        app.rpc.auth.authRemote.checkin.toServer('auth-server-1', openid, uid, app.get('serverId'),
			function (result, formerSid, formerUid) {
			// 已经登录，走顶号流程
			if (result == consts.CheckInResult.ALREADY_ONLINE) {
				if (formerUid !== uid) {
					// 事件大了！！！
					logger.error("same account with different uid, openid[%s] formerUid[%s] newUid[%s]", openid, formerUid, uid);
					next(null, {code: consts.Login.FAIL});
					return;
				}
				if (formerSid == app.get('serverId')) {
					var avatar = entityManager.getEntity(formerUid);
					if (!avatar) {
						readyLogin(app, session, uid, openid, session_key, userInfo, next, false);
					}
					else {
						// 刷新session_key和userInfo
						avatar.session_key = session_key;
						avatar.updateUserInfo(userInfo);
						avatar.reconnect();  // 重连上了
						app.get('sessionService').kick(formerUid, "relay");
						session.bind(avatar.id);
						session.on('closed', onAvatarLeave.bind(null, app));
						// 重新设置session setting
						avatar.importSessionSetting();
						next(null, {
							code: consts.Login.OK,
							info: avatar.clientLoginInfo()
						});
						avatar.emit("EventReconnect", avatar);
					}
				}
				else {
					// 不在同一个进程，告诉客户端重连
					var server = null;
					var servers = app.getServersByType('connector');
                    console.warn('connector servers info: ', servers);
					for (var i in servers) {
						if (servers[i].id === formerSid) {
                            server = servers[i];
                            break;
                        }
                    }

                    if (!server) {
                        logger.warn('user not same prossise. curServerID:[%s], userServerID:[%s]', app.get('serverId'), formerSid);
                        next(null, {code: consts.Login.FAIL});
                    } else {
                        // TODO: 临时写死上位机地址, 因为pkg打包这里要可配
                        let pkgTest = path.join(process.cwd(), '/config/pkg_test.json');
                        pkgTest = JSON.parse(fs.readFileSync(pkgTest));

                        next(null, {
                            code: consts.Login.RELAY,
                            host: pkgTest.zmqHost,
                            port: server.clientPort
                        });
                    }
				}
			}
			else {
				readyLogin(app, session, uid, openid, session_key, userInfo, next, false);
			}
		});
    });
};

var readyLogin = function (app, session, uid, openid, session_key, userInfo, next, bRelay) {
    // 查db
    app.db.find("Avatar", {"_id": uid}, null, null, function (err, docs) {
        if (err) {
            logger.error("db find avatar error" + err);
            next(null, {code: consts.Login.FAIL});
            return;
        }
        if (docs.length == 0) {
            // 新建号
            var avatar = entityFactory.createEntity("Avatar", uid, {
                openid: openid,
				session_key: session_key,
            })
            
            avatar.save();  // 主动存盘一次
            logger.info("create new avatar id: " + avatar.id);
        } else {
            // 登录成功
            docs[0].openid = openid;
            docs[0].session_key = session_key;
            var avatar = entityFactory.createEntity("Avatar", null, docs[0]);
            logger.info("avatar login success. id: " + avatar.id);
        }
		avatar.updateUserInfo(userInfo, true);
        var sessionService = app.get('sessionService');
        sessionService.kick(avatar.id, 'relay');
        session.bind(avatar.id);
		session.on('closed', onAvatarLeave.bind(null, app));
		next(null, {
            code: consts.Login.OK,
            info: avatar.clientLoginInfo()
        });
        if (bRelay) {
            app.rpc.auth.authRemote.relayCheckin.toServer('auth-server-1', openid, uid, app.get('serverId'), null);
        }
    })
};

/**
 * User log out handler
 *
 * @param {Object} app current application
 * @param {Object} session current session object
 *
 */
var onAvatarLeave = function (app, session, reason) {
    if (!session || !session.uid) {
        return;
    }
    if (reason == "relay") {
        // 顶号
        console.warn("xxxxxxxxxxxxxxx", "onAvatarLeave relay")
        return;
    }
    var avtID = session.uid;
    var avatar = entityManager.getEntity(avtID);
    console.log("avatarLeave: " + session.uid);
    avatar.disconnect();
};
