/**
 * Date: 2022/3/17
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
const response = require('koa/lib/response');

const SAVE_DB_TIME = 60 * 1000 * 5;

let LobbyComponent = function (entity) {
    Component.call(this, entity);
};

util.inherits(LobbyComponent, Component);
module.exports = LobbyComponent;

let pro = LobbyComponent.prototype;

pro.init = function (opts) {
    this.projectUUID = '62861ff3ff4b0f6846abefba';
    this._bindEvent();

    this.db = pomelo.app.db.getModel('Project');
    this.waitToUpdateDB = new Set();
    this.projectsById = {};
    this.saveDBTimer = setInterval(this._onSaveToDB.bind(this), SAVE_DB_TIME);
}

pro._bindEvent = function () {
    this.entity.safeBindEvent("EventLogin", this._onLogin.bind(this));
    this.entity.safeBindEvent("EventDisconnect", this._onDisconnect.bind(this));
    this.entity.safeBindEvent("EventReconnect", this._onReconnect.bind(this));
}

pro._onLogin = function (entity) {
    const engines = pomelo.app.getServersByType('engine');
    for (let i = 0; i < engines.length; i++) {
        const res = engines[i];
        pomelo.app.rpc.engine.engineRemote.updateUserState.toServer(res.id, entity.id, entity.serverId, null);
    }
}

pro._onDisconnect = function (entity) {
	const engines = pomelo.app.getServersByType('engine');
    for (let i = 0; i < engines.length; i++) {
        const res = engines[i];
        pomelo.app.rpc.engine.engineRemote.updateUserState.toServer(res.id, entity.id, null, null);
    }
}

pro._onReconnect = function (entity) {
	const engines = pomelo.app.getServersByType('engine');
    for (let i = 0; i < engines.length; i++) {
        const res = engines[i];
        pomelo.app.rpc.engine.engineRemote.updateUserState.toServer(res.id, entity.id, entity.serverId, null);
    }
};

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

pro.getHttpSrvInfo = function (next) {
    let connectors = pomelo.app.get('servers').connector;
	let serverCfg = utils.find2key('id', pomelo.app.get('serverId'), connectors);
	next(null, {
        code: consts.Code.OK,
        host: serverCfg.httpHost,
        port: serverCfg.httpPort
    });
}

pro.getProjectList = function (next) {
    next(null, {
        code: consts.Code.OK,
        projectList: this.entity.projectList
    });
}

pro.enterProject = async function (id, next) {
    this.entity.logger.info('进入项目=> ', id);
    this.projectUUID = id;
    let project = await this.getEntry(id);
    if (!project) {
        this.entity.logger.warn('get project [%s] not exist!', id);
        next(null, {code: consts.Code.FAIL});
        return;
    }

    // 检测仿真引擎状态与实际不合, 启动心跳检测
    let simulateDb = await this.entity.simulate.getEntry(this.projectUUID);
    if (simulateDb.state >= consts.SimulateState.Connected) {
        this.entity.simulate._heartbeat();
    }

    // dbjson -> vuejson
    let sysList = this._formatDB2Vue(project);
    next(null, {
        code: consts.Code.OK,
        sysList: sysList
    });
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
            model.modelId = unit.modelId ? unit.modelId : null;
            model.name = unit.name;
            model.nodeType = unit.nodeType;
            model.entity = unit.entity ? unit.entity : null;
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

pro._getBlockShapeType = function (nodeType) {
    let shape = "my-rect"
    if (nodeType == consts.ShapeType.SubSys) {
        // 子系统
        shape = "my-rect"
    } else if (nodeType == consts.ShapeType.Block) {
        // 最小模型
        shape = "my-rect"
    } else if (nodeType == consts.ShapeType.Add) {
        // 加法器, 圆形
        shape = "my-circle"
    } else if (nodeType == consts.ShapeType.Input || nodeType == consts.ShapeType.Output) {
        // 输入、输出
        shape = "my-rect"
    } else if(nodeType == consts.ShapeType.MoreOne) {
        // 多对一
        shape = "my-rect"
    } else if(nodeType == consts.ShapeType.OneMore) {
        // 一对多
        shape = "my-rect"
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

pro.setMappingTbl = async function (projectId, mappingtbl) {
    let project = await this.getEntry(projectId);
    if (!project) {
        this.entity.logger.warn('get project [%s] not exist!', projectId);
        return;
    }
    project.mappingtbl = mappingtbl;
    this.projectsById[projectId] = project;
    this.waitToUpdateDB.add(projectId);
}

pro.savePanel = async function (projectId, panelDatas, next) {
    this.entity.logger.info('保存项目=> ', projectId);
    let project = await this.getEntry(projectId);
    if (!project) {
        this.entity.logger.warn('get project [%s] not exist!', projectId);
        next(null, {code: consts.Code.FAIL});
        return;
    }
    
    // 删除子系统模型, 对应子系统面板也要移除
    let delPanelList = this.getDelPanelList(panelDatas, project);
    for (let i = 0; i < delPanelList.length; i++) {
        const panelID = delPanelList[i];
        for (let j = 0; j < project.data.length; j++) {
            let panel = project.data[j];
            if (panel.id == panelID) {
                project.data.splice(j, 1);
                break;
            }
        }
    }

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
        }
    }

    this.projectsById[projectId] = project;
    this.waitToUpdateDB.add(projectId);
    next(null, {code: consts.Code.OK});
}

pro.insertCustomField = function (newPanelData, dbPanelData) {
    newPanelData.block = newPanelData.block || [];
    for (let i = 0; i < newPanelData.block.length; i++) {
        let item = newPanelData.block[i];
        // 保留有的属性modifyAttr字段、实物切换属性
        for (let j = 0; j < dbPanelData.block.length; j++) {
            const element = dbPanelData.block[j];
            if (element.id == item.id) {
                item.modifyAttr = element.modifyAttr;
                item.entity = element.entity;
                break;
            }
        }
    }
}

pro.getDelPanelList = function (modifyPanels, dbProject) {
    let delPanelList = [];
    for (let i = 0; i < modifyPanels.length; i++) {
        const modifyPanel = modifyPanels[i];
        for (let j = 0; j < dbProject.data.length; j++) {
            const dbPanel = dbProject.data[j];
            if (modifyPanel.id == dbPanel.id) {
                // 子画板
                modifyPanel.block = modifyPanel.block || [];
                for (let m = 0; m < dbPanel.block.length; m++) {
                    const dbItem = dbPanel.block[m];
                    let isDel = true;
                    for (let n = 0; n < modifyPanel.block.length; n++) {
                        const newItem = modifyPanel.block[n];
                        if (dbItem.id == newItem.id) {
                            isDel = false;
                            break;
                        }
                    }
                    if (isDel && dbItem.child) {
                        delPanelList.push(dbItem.child);
                    }
                }
                break;
            }
        }
    }

    this.entity.logger.info("待删除的画板列表: ", delPanelList);
    return delPanelList;
}

pro.deletePanel = async function (projectId, panelId, next) {
    this.entity.logger.info('删除面板=> ', projectId, panelId);
    let project = await this.getEntry(projectId);
    if (!project) {
        this.entity.logger.warn('get project [%s] not exist!', projectId);
        next(null, {code: consts.Code.FAIL});
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
    next(null, {code: consts.Code.OK});
}

pro.deleteProject = function (projectId, next) {
    this.entity.logger.info('删除项目=> ', projectId);
    this.entity.modifyProList(consts.ControlType.Delete, {id: projectId});
    if (this.projectsById[projectId]) {
        delete this.projectsById[projectId]
    }
    this.waitToUpdateDB.delete(projectId);
    this.db.remove({_id: projectId});
    next(null, {code: consts.Code.OK});
}

pro.getModelList = function (next) {
    next(null, {
        code: consts.Code.OK,
        groupList: this.entity.groupList,
        modelList: this.entity.modelList
    });
}

pro.getEntityList = function(next) {
    next(null, {
        code: consts.Code.OK,
        groupList: this.entity.groupList,
        entityList: this.entity.entityList
    });
}

pro.getProtocolList = function(next) {
    next(null, {
        code: consts.Code.OK,
        protocolList: this.entity.protocolList
    });
}

pro.getBlockInfo = async function (panelId, blockId, modelId, next) {
    if (!this.projectUUID) {
        this.entity.logger.warn("项目ID不存在!");
        next(null, {code: consts.Code.FAIL});
        return;
    }

    // 1. 先project表中找修改字段
    let project = await this.getEntry(this.projectUUID);
    if (!project) {
        this.entity.logger.warn('get project [%s] not exist!', this.projectUUID);
        next(null, {code: consts.Code.FAIL});
        return;
    }

    let modifyAttr = {};
    for (let i = 0; i < project.data.length; i++) {
        const item = project.data[i];
        if (item.id == panelId) {
            for (let j = 0; j < item.block.length; j++) {
                const element = item.block[j];
                if (element.id == blockId) {
                    modifyAttr = element.modifyAttr || {};
                    break;
                }
            }
            break;
        }
    }

    // 2. 如果没有再去model表中取默认字段
    let model = await this.entity.assetsModel.getEntry(modelId);
    if (!model) {
        this.entity.logger.warn('get model [%s] not exist!', modelId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    next(null, {
        code: consts.Code.OK,
        modelId: modelId,
        Name: modifyAttr.Name ? modifyAttr.Name : model.data.Name,
        Description: modifyAttr.Description ? modifyAttr.Description : model.data.Description,
        Parameters: this._splitBlockParameters(model.data.Parameters.Datas, modifyAttr.Parameters),
        X_State: this._splitBlockParameters(model.data.X_State.Datas, modifyAttr.X_State),
        Y_Output: this._splitBlockParameters(model.data.Y_Output.Datas, modifyAttr.Y_Output),
        U_Input: this._splitBlockParameters(model.data.U_Input.Datas, modifyAttr.U_Input),
    });
}

pro._splitBlockParameters = function(srcParams, modifyParams) {
    modifyParams = modifyParams || [];
    for (let i = 0; i < modifyParams.length; i++) {
        const item = modifyParams[i];
        srcParams[item.index].Default = item.Default;
    }
    return srcParams;
}

pro.modifyBlockInfo = async function (panelId, blockId, modifyInfo, next) {
    if (!this.projectUUID) {
        this.entity.logger.warn("项目ID不存在!");
        next(null, {code: consts.Code.FAIL});
        return;
    }

    let project = await this.getEntry(this.projectUUID);
    if (!project) {
        this.entity.logger.warn('get project [%s] not exist!', this.projectUUID);
        next(null, {code: consts.Code.FAIL});
        return;
    }

    this.entity.logger.info('修改画板模型属性: ', panelId, blockId, modifyInfo);
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

    this.projectsById[this.projectUUID] = project;
    this.waitToUpdateDB.add(this.projectUUID);
    next(null, {code: consts.Code.OK});
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

pro.setBlockEntity = async function (panelId, blockId, entityId, next) {
    if (!this.projectUUID) {
        this.entity.logger.warn("项目ID不存在!");
        next(null, {code: consts.Code.FAIL});
        return;
    }

    let project = await this.getEntry(this.projectUUID);
    if (!project) {
        this.entity.logger.warn('get project [%s] not exist!', this.projectUUID);
        next(null, {code: consts.Code.FAIL});
        return;
    }

    for (let i = 0; i < project.data.length; i++) {
        let panelItem = project.data[i];
        if (panelItem.id == panelId) {
            for (let j = 0; j < panelItem.block.length; j++) {
                let blockItem = panelItem.block[j];
                if (blockItem.id == blockId) {
                    blockItem.entity = entityId;
                    break;
                }
            }
            break;
        }
    }

    this.projectsById[this.projectUUID] = project;
    this.waitToUpdateDB.add(this.projectUUID);
    next(null, {code: consts.Code.OK});
}