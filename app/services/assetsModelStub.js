/**
 * Date: 2022/4/21
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

const SAVE_DB_TIME = 60 * 1000 * 5;

var instance = null;
module.exports = function (app) {
    if (instance) {
        return instance;
    }
    return instance = new AssetsModelStub(app);
}

var AssetsModelStub = function (app) {
    this.app = app;
    this.db = pomelo.app.db.getModel('Model');
    this.waitToUpdateDB = new Set();
    this.modelsById = {};
    this.saveDBTimer = setInterval(this._onSaveToDB.bind(this), SAVE_DB_TIME);
}

var pro = AssetsModelStub.prototype;

pro._onSaveToDB = function () {
    if (this.waitToUpdateDB.size === 0)
        return;
    let entry;
    for (let id of this.waitToUpdateDB) {
        entry = this.modelsById[id];
        this.db.update({ _id: id }, entry, { upsert: true }, function (err, raw) {
            if (err) {
                logger.error(id + " save db error: " + err);
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
            self.modelsById[id] = entry;
            self.waitToUpdateDB.add(id);
            logger.info('修改/新建模型[%s].', id);
            resolve(entry);
        } else {
            entry = self.modelsById[id];
            if (entry) {
                resolve(entry);
            } else {
                self.db.findById(id, function (err, doc) {
                    if (err) {
                        logger.error("db find project info error: " + err);
                        return;
                    }
                    // 新项目
                    if (!doc) {
                        logger.warn('模型[%s]不存在!', id);
                    } else {
                        entry = doc;
                        self.modelsById[id] = entry;
                    }
                    resolve(entry);
                })
            }
        }
    })
}

pro.callAvatarGroupInfo = function (uid, sid, groupName, modelInfo) {
    return new Promise((resolve, reject) => {
        pomelo.app.rpc.connector.entryRemote.onSetModelGroup.toServer(sid, uid, groupName, modelInfo, (rsp) => {
            resolve(rsp)
        });
    })
}

pro.getModelInfo = async function (id, cb) {
    let model = await this.getEntry(id);
    if (!model) {
        logger.warn('get model [%s] not exist!', id);
        cb({ code: consts.Code.FAIL });
        return;
    }

    cb({
        code: consts.Code.OK,
        Name: model.data.Name,
        groupId: model.groupId,
        iconUrl: '',
        Description: model.data.Description,
        Parameters: model.data.Parameters.Datas,
        X_State: model.data.X_State.Datas,
        Y_Output: model.data.Y_Output.Datas,
        U_Input: model.data.U_Input.Datas,
    });
}

pro.modifyModelInfo = async function (modelId, modifyInfo, cb) {
    let model = await this.getEntry(modelId);
    if (!model) {
        logger.warn('get model [%s] not exist!', id);
        cb({ code: consts.Code.FAIL });
        return;
    }

    for (const key in modifyInfo) {
        let value = modifyInfo[key];
        if (key == 'Name') {
            model.data.Name = value;
        } else if(key == 'groupId') {
            model.groupId = value;
        } else if(key == 'Description') {
            model.data.Description = value;
        } else if(key == 'Parameters') {
            this._modifyModelData(model, value, 'Parameters');
        } else if(key == 'X_State') {
            this._modifyModelData(model, value, 'X_State');
        } else if(key == 'Y_Output') {
            this._modifyModelData(model, value, 'Y_Output');
        } else if(key == 'U_Input') {
            this._modifyModelData(model, value, 'U_Input');
        } else {
            logger.warn('修改模型信息未处理字段: ', key, value);
        }
    }
    await this.getEntry(modelId, model);
    cb({ code: consts.Code.OK });
}

pro._modifyModelData = function (dbdata, values, fieldName) {
    for (let i = 0; i < values.length; i++) {
        const element = values[i];
        if (element.name) {
            dbdata.data[fieldName].Datas[element.index]['Name'] = element.Name;
        } else if(element.type) {
            dbdata.data[fieldName].Datas[element.index]['Type'] = element.Type;
        } else if(element.default) {
            dbdata.data[fieldName].Datas[element.index]['Default'] = element.Default;
        }
    }
}




