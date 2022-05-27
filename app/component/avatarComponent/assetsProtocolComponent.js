/**
 * Date: 2022/5/27
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

const SAVE_DB_TIME = 60 * 1000 * 5;

let AssetsEntityComponent = function (entity) {
    Component.call(this, entity);
};

util.inherits(AssetsEntityComponent, Component);
module.exports = AssetsEntityComponent;

let pro = AssetsEntityComponent.prototype;

pro.init = function (opts) {
    this.db = pomelo.app.db.getModel('Protocol');
    this.waitToUpdateDB = new Set();
    this.protocolById = {};
    this.saveDBTimer = setInterval(this._onSaveToDB.bind(this), SAVE_DB_TIME);
}

pro._onSaveToDB = function () {
    if (this.waitToUpdateDB.size === 0)
        return;
    let entry;
    for (let id of this.waitToUpdateDB) {
        entry = this.protocolById[id];
        this.db.update({ _id: id }, entry, { upsert: true }, (err, raw) => {
            if (err) {
                this.entity.logger.error(id + " save db error: " + err);
            }
        })
    }
    this.waitToUpdateDB.clear();
}

pro.getEntry = function (id, data) {
    let self = this;
    return new Promise(function (resolve, reject) {
        let entry = null;
        if (data) {
            // 修改、新建
            id = id || pomelo.app.db.genId();
            entry = {
                _id: id,
                uid: self.entity.id,
                name: data.name,
                des: data.des,
                portType: data.portType,
                interfaceType: data.interfaceType,
                interfaceList: data.interfaceList,
                dataList: data.dataList,
            }

            self.protocolById[id] = entry;
            self.waitToUpdateDB.add(id);
            resolve(entry);
        } else {
            // 获取信息
            entry = self.protocolById[id];
            if (entry) {
                resolve(entry);
            } else {
                self.db.findById(id, function (err, doc) {
                    if (err) {
                        self.entity.logger.error("db find protocol info error: " + err);
                        return;
                    }

                    if (!doc) {
                        self.entity.logger.warn('协议[%s]不存在!', id);
                    } else {
                        entry = doc;
                        self.protocolById[id] = entry;
                    }
                    resolve(entry);
                })
            }
        }
    })
}

// 新建/修改协议
pro.setEntityProtocol = async function (protocolId, protocolInfo, next) {
    let entry = await this.getEntry(protocolId, protocolInfo);
    let info = {
        id: entry._id,
        name: entry.name
    }
    this.entity.setProtocolList(info);
    next(null, { code: consts.Code.OK });
}

pro.deleteEntityProtocol = function (protocolId, next) {
    
}