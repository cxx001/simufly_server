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

const SAVE_DB_TIME = 60 * 1000 * 5;

let AssetsEntityComponent = function (entity) {
    Component.call(this, entity);
};

util.inherits(AssetsEntityComponent, Component);
module.exports = AssetsEntityComponent;

let pro = AssetsEntityComponent.prototype;

pro.init = function (opts) {
    this.db = pomelo.app.db.getModel('Entity');
    this.waitToUpdateDB = new Set();
    this.entityById = {};
    this.saveDBTimer = setInterval(this._onSaveToDB.bind(this), SAVE_DB_TIME);
}

pro._onSaveToDB = function () {
    if (this.waitToUpdateDB.size === 0)
        return;
    let entry;
    for (let id of this.waitToUpdateDB) {
        entry = this.entityById[id];
        this.db.update({ _id: id }, entry, { upsert: true }, (err, raw) => {
            if (err) {
                this.entity.logger.error(id + " save db error: " + err);
            }
        })
    }
    this.waitToUpdateDB.clear();
};

// 获取、新建、修改模型
pro.getEntry = function (id, data) {
    let self = this;
    return new Promise(function (resolve, reject) {
        let entry = null;
        if (data) {
            // 新建、修改
            entry = data;
            self.entityById[id] = entry;
            self.waitToUpdateDB.add(id);
            self.entity.logger.info('修改/新建实物[%s].', id);
            resolve(entry);
        } else {
            entry = self.entityById[id];
            if (entry) {
                resolve(entry);
            } else {
                self.db.findById(id, function (err, doc) {
                    if (err) {
                        self.entity.logger.error("db find entity info error: " + err);
                        return;
                    }
                    // 新项目
                    if (!doc) {
                        self.entity.logger.warn('实物[%s]不存在!', id);
                    } else {
                        entry = doc;
                        self.entityById[id] = entry;
                    }
                    resolve(entry);
                })
            }
        }
    })
}

pro.getEntityInfo = async function (entityId, next) {
    let entry = await this.getEntry(entityId);
    if (!entry) {
        this.entity.logger.warn('get entry [%s] not exist!', entityId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let mapInpullList = [];
    let mapOutpullList = [];
    for (let i = 0; i < entry.nodeList.length; i++) {
        const item = entry.nodeList[i];
        let protocolId = item.protocolId;
        let protocolInfo = await this.entity.assetsProtocol.getEntry(protocolId);
        if (!protocolInfo) {
            this.entity.logger.warn('协议[%s]不存在!', protocolId);
            continue;
        }

        if (protocolInfo.portType == consts.ProtocolPortType.Input) {
            for (let j = 0; j < protocolInfo.datas.length; j++) {
                const field = protocolInfo.datas[j];
                mapInpullList.push({
                    protocolId: protocolId,
                    protocolName: protocolInfo.name,
                    fieldIndex: j,
                    fieldName: field.name
                });
            }
        } else {
            for (let j = 0; j < protocolInfo.datas.length; j++) {
                const field = protocolInfo.datas[j];
                mapOutpullList.push({
                    protocolId: protocolId,
                    protocolName: protocolInfo.name,
                    fieldIndex: j,
                    fieldName: field.name
                });
            }
        }
    }

    next(null, {
        code: consts.Code.OK,
        name: entry.name,
        modelId: entry.modelId,
        iconUrl: "",
        des: entry.des,
        nodeList: entry.nodeList,
        mapping: entry.mapping,
        mapDownList: {
            input: mapInpullList,
            output: mapOutpullList,
        }
    });
}

pro.setEntityInfo = async function (entityId, modifyInfo, next) {
    if (!entityId) {
        // 添加实物
        entityId = pomelo.app.db.genId();
        this.getEntry(entityId, modifyInfo);
        next(null, { code: consts.Code.OK });
    } else {
        // 修改实物
        let entry = await this.getEntry(entityId);
        if (!entry) {
            this.entity.logger.warn('get entry [%s] not exist!', entityId);
            next(null, { code: consts.Code.FAIL });
            return;
        }

        for (const key in modifyInfo) {
            let value = modifyInfo[key];
            entry[key] = value;
        }
        this.entityById[entityId] = entry;
        this.waitToUpdateDB.add(entityId);
        next(null, { code: consts.Code.OK });
    }

    this.entity.setEntityGroup({
        id: entityId,
        name: modifyInfo.name,
        modelId: modifyInfo.modelId,
    });
}
