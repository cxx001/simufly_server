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

pro.getProject = async function (projectId, cb) {
    let project = await this.getEntry(projectId);
    if (!project) {
        logger.warn('get project [%s] not exist!', projectId);
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

pro.getDBProject = async function (projectId, cb) {
    let project = await this.getEntry(projectId);
    if (!project) {
        logger.warn('get project [%s] not exist!', projectId);
        cb({code: consts.Code.FAIL});
        return;
    }

    cb({
        code: consts.Code.OK,
        project: project
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
            // 注意不能直接改unit, 不然会改变数据库内容, 是引用
            let portInfo = [];
            for (let k = 0; k < unit.items.length; k++) {
                let item = unit.items[k];
                portInfo.push({
                    id: item.group + '_' + item.id,
                    group: item.group
                });
            }
            model.ports.items = portInfo;
            model.id = unit.id;
            model.child = unit.child;
            model.modelId = unit.modelId ? unit.modelId : null;
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
            // 同上不能改unit
            line.source = {cell: unit.source.cell, port: 'out_' + unit.target.port}
            line.target = {cell: unit.target.cell, port: 'in_' + unit.target.port};
            line.zIndex = j + itemSys.block.length;
            item.data.cells.push(line);
        }
        
        sysList.push(item);
    }
    return sysList;
}

pro.insertCustomField = function (newPanelData, dbPanelData) {
    for (let i = 0; i < newPanelData.block.length; i++) {
        let item = newPanelData.block[i];
        for (let j = 0; j < dbPanelData.block.length; j++) {
            const element = dbPanelData.block[j];
            if (element.id == item.id) {
                item.modifyAttr = element.modifyAttr;
                for (let z = 0; z < item.items.length; z++) {
                    let port = item.items[z];
                    port.id = port.id.split('_')[1];
                }
                break;
            }
        }
    }

    for (let i = 0; i < newPanelData.line.length; i++) {
        let item = newPanelData.line[i];
        for (let j = 0; j < dbPanelData.line.length; j++) {
            const element = dbPanelData.line[j];
            if (element.id == item.id) {
                item.subLine = element.subLine;
                item.source.port = item.source.port.split('_')[1];
                item.target.port = item.target.port.split('_')[1];
                break;
            }
        }
    }
}

pro.savePanel = async function (projectId, panelDatas, cb) {
    let project = await this.getEntry(projectId);
    if (!project) {
        logger.warn('get project [%s] not exist!', projectId);
        cb({code: consts.Code.FAIL});
        return;
    }

    // 只有新建、修改，删除另提供接口
    logger.info('用户修改: ', panelDatas);
    for (let i = 0; i < panelDatas.length; i++) {
        let item = panelDatas[i];
        let isCreate = true;
        for (let j = 0; j < project.data.length; j++) {
            const dbitem = project.data[j];
            if (item.id == dbitem.id) {
                // 插入客户端没有传的自定义字段
                this.insertCustomField(item, dbitem);
                project.data[j] = item;
                isCreate = false;
                break;
            }
        }
        if (isCreate) {
            project.data.push(item);
            logger.warn('save panel for new control!');
        }
    }

    this.projectsById[projectId] = project;
    this.waitToUpdateDB.add(projectId);
    cb({code: consts.Code.OK});
}

pro.deletePanel = async function (projectId, panelId, cb) {
    let project = await this.getEntry(projectId);
    if (!project) {
        logger.warn('get project [%s] not exist!', projectId);
        cb({code: consts.Code.FAIL});
        return;
    }

    for (let i = 0; i < project.data.length; i++) {
        let item = project.data[i];
        if (item.id == panelId) {
            project.data.splice(i, 1);
            break;
        }
    }

    this.projectsById[projectId] = project;
    this.waitToUpdateDB.add(projectId);
    cb({code: consts.Code.OK});
}

pro.deleteProject = async function(projectId, cb) {
    if (this.projectsById[projectId]) {
        delete this.projectsById[projectId]
    }
    this.waitToUpdateDB.delete(projectId);
    this.db.remove({_id: projectId});
    cb({code: consts.Code.OK});
}

pro.modifyBlockInfo = async function (projectId, panelId, blockId, modifyInfo, cb) {
    let project = await this.getEntry(projectId);
    if (!project) {
        logger.warn('get project [%s] not exist!', projectId);
        cb({code: consts.Code.FAIL});
        return;
    }

    logger.info('修改画板模型属性: ', panelId, blockId, modifyInfo);
    for (let i = 0; i < project.data.length; i++) {
        let item = project.data[i];
        if (item.id == panelId) {
            for (let j = 0; j < item.block.length; j++) {
                let element = item.block[j];
                if (element.id == blockId) {
                    // 覆盖替换
                    item.block[j].modifyAttr = item.block[j].modifyAttr || {};
                    if (modifyInfo.Name) {
                        item.block[j].modifyAttr.Name = modifyInfo.Name;
                    } else if(modifyInfo.Description) {
                        item.block[j].modifyAttr.Description = modifyInfo.Description;
                    } else if(modifyInfo.Parameters && modifyInfo.Parameters.length > 0) {
                        item.block[j].modifyAttr.Parameters = item.block[j].modifyAttr.Parameters || [];
                        this._modifyBlockParameter(item.block[j].modifyAttr.Parameters, modifyInfo.Parameters);
                    } else if(modifyInfo.X_State && modifyInfo.X_State.length > 0) {
                        item.block[j].modifyAttr.X_State = item.block[j].modifyAttr.X_State || [];
                        this._modifyBlockParameter(item.block[j].modifyAttr.X_State, modifyInfo.X_State);
                    } else if(modifyInfo.Y_Output && modifyInfo.Y_Output.length > 0) {
                        item.block[j].modifyAttr.Y_Output = item.block[j].modifyAttr.Y_Output || [];
                        this._modifyBlockParameter(item.block[j].modifyAttr.Y_Output, modifyInfo.Y_Output);
                    } else if(modifyInfo.U_Input && modifyInfo.U_Input.length > 0) {
                        item.block[j].modifyAttr.U_Input = item.block[j].modifyAttr.U_Input || [];
                        this._modifyBlockParameter(item.block[j].modifyAttr.U_Input, modifyInfo.U_Input);
                    }
                    break;
                }
            }
        }
    }

    this.projectsById[projectId] = project;
    this.waitToUpdateDB.add(projectId);
    cb({code: consts.Code.OK});
}

pro._modifyBlockParameter = function (db_params, modify_params) {
    for (let i = 0; i < modify_params.length; i++) {
        let modify_item = modify_params[i];
        let isCreate = true;
        for (let j = 0; j < db_params.length; j++) {
            let db_item = db_params[j];
            if (db_item.index == modify_item.index) {
                db_item.Default = modify_item.Default;
                isCreate = false;
                break;
            }
        }
        if (isCreate) {
            db_params.push(modify_item);
        }
    }
}