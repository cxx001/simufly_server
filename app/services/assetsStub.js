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
const koa = require('../koa/main');

const SAVE_DB_TIME = 60 * 1000 * 5;

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
    this.assetsCfg = utils.find2key('id', app.get('serverId'), assets);
    koa.start(this);

    this.db = pomelo.app.db.getModel('Project');
    this.waitToUpdateDB = new Set();
    this.projectsById = {};
    this.saveDBTimer = setInterval(this._onSaveToDB.bind(this), SAVE_DB_TIME);
}

var pro = AssetsStub.prototype;

pro._onSaveToDB = function () {
    if (this.waitToUpdateDB.size === 0)
        return;
    let entry;
    for (let id of this.waitToUpdateDB) {
        entry = this.projectsById[id];
        this.db.update({_id: id}, entry, {upsert: true}, function (err, raw) {
            if (err) {
                logger.error(id + " save db error: " + err);
            }
        })
    }
    this.waitToUpdateDB.clear();
};

// 获取、新建项目
pro.getEntry = function (id, createData) {
	let self = this;
    return new Promise(function (resolve, reject) {
		let entry = self.projectsById[id];
        if (entry) {
            if (createData) {
                logger.warn('创建的新项目[%s]已经存在!', id);
            }
            resolve(entry);
        }
        else {
            self.db.findById(id, function (err, doc) {
                if (err) {
                    logger.error("db find project info error: " + err);
                    return;
                }
                // 新项目
                let entry = null;
                if (!doc && createData) {
                    entry = createData;
                    self.projectsById[id] = entry;
                    self.waitToUpdateDB.add(id);
                }
                else if (doc){
                    if (createData) {
                        logger.warn('创建的新项目[%s]已经存在!', id);
                    }
                    entry = doc;
                    self.projectsById[id] = entry;
                }
                resolve(entry);
            })
        }
    })
}

/**
 * 
 * @param {*} uid 用户id
 * @param {*} sid 用户所在服务器id
 * @param {*} optype 操作类型 1 新增  2 删除
 * @param {*} proinfo 项目基础信息
 * @returns 
 */
pro.callAvatarRemote = function (uid, sid, optype, proinfo) {
    return new Promise((resolve, reject) => {
        pomelo.app.rpc.connector.entryRemote.onModifyProjectList.toServer(sid, uid, optype, proinfo, () => {
            resolve()
        });
    })
}

pro.getProject = async function (id, cb) {
    let project = await this.getEntry(id);
    if (!project) {
        logger.warn('get project [%s] not exist!', id);
        cb({code: consts.Code.FAIL});
        return;
    }

    // dbjson -> vuejson
    let sysList = this._formatDB2Vue(project);
    cb({
        code: consts.Code.OK,
        sysList: sysList
    });
}

pro._getBlockShapeType = function (nodeType) {
    let shape = "my-rect"
    if (nodeType == 6) {
        // 子系统
        shape = "my-rect"
    } else if (nodeType == 0) {
        // 最小模型
        shape = "my-rect"
    } else if (nodeType == 2) {
        // 加法器, 圆形
        shape = "my-circle"
    }
    return shape;
}

pro._getLineShapeType = function (lineType) {
    let shape = "dag-edge";
    if (lineType == 1) {
        shape = "dag-edge";
    } else if (lineType == 2) {
        shape = "double-edge";
    }
    return shape;
}

pro._formatDB2Vue = function (dbjson) {
    let sysList = [];
    for (let i = 0; i < dbjson.data.length; i++) {
        const itemSys = dbjson.data[i];
        let item = {};
        item.pid = itemSys.pid;
        item.id = itemSys.id;
        item.label = itemSys.name;
        item.data = {};
        item.data.cells = [];
        // 模块
        for (let j = 0; j < itemSys.block.length; j++) {
            const unit = itemSys.block[j];
            let model = {};
            model.position = unit.position;
            model.size = unit.size;
            model.attrs = { text: { text: unit.name} };
            model.shape = this._getBlockShapeType(unit.nodeType);
            model.ports = {};
            model.ports.items = unit.items;
            model.id = unit.id;
            model.child = unit.child;
            model.name = unit.name;
            model.nodeType = unit.nodeType;
            model.zIndex = j;
            item.data.cells.push(model);
        }

        // 连线
        for (let j = 0; j < itemSys.line.length; j++) {
            const unit = itemSys.line[j];
            let line = {};
            line.id = unit.id;
            line.shape = this._getLineShapeType(unit.lineType);
            line.source = unit.source;
            line.target = unit.target;
            line.zIndex = j + itemSys.block.length;
            item.data.cells.push(line);
        }
        
        sysList.push(item);
    }
    return sysList;
}