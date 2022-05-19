/**
 * Date: 2022/5/5
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
let dbformatengine = require('../../util/dbformatengine');

const SAVE_DB_TIME = 60 * 1000 * 5;

let SimulateComponent = function (entity) {
    Component.call(this, entity);
};

util.inherits(SimulateComponent, Component);
module.exports = SimulateComponent;

let pro = SimulateComponent.prototype;

pro.init = function (opts) {
    this.db = pomelo.app.db.getModel('Simulate');
    this.waitToUpdateDB = new Set();
    this.simulateById = {};
    this.saveDBTimer = setInterval(this._onSaveToDB.bind(this), SAVE_DB_TIME);

    this.heartbeatInterval = 3000;
    this.heartbeatTimeout = this.heartbeatInterval * 2;
    this.nextHeartbeatTimeout = 0;
    this.gapThreshold = 100; // heartbeat gap threshold
    this.heartbeatId = null;
    this.heartbeatTimeoutId = null;
}

pro._onSaveToDB = function () {
    if (this.waitToUpdateDB.size === 0)
        return;
    let entry;
    for (let id of this.waitToUpdateDB) {
        entry = this.simulateById[id];
        this.db.update({ _id: id }, entry, { upsert: true }, function (err, raw) {
            if (err) {
                logger.error(id + " save db error: " + err);
            }
        })
    }
    this.waitToUpdateDB.clear();
};

pro.getEntry = function (id) {
    let self = this;
    return new Promise(function (resolve, reject) {
        let entry = self.simulateById[id];
        if (entry) {
            resolve(entry);
        } else {
            self.db.findById(id, function (err, doc) {
                if (err) {
                    logger.error("db find simulate info error: " + err);
                    return;
                }
                // 新项目
                if (!doc) {
                    // 默认值
                    entry = {
                        _id: id,
                        uid: self.entity.id,
                        state: 0,
                        simuTime: 0,
                        simuStep: 0,
                        assignTask: [],
                        signalSet: [],
                        triggerSet: {
                            status: 1,
                            source: 0,
                            mode: 0,
                            collect_factor: 1,
                            collect_count: 1000,
                        },
                    }
                    self.simulateById[id] = entry;
                } else {
                    entry = doc;
                    self.simulateById[id] = entry;
                }
                resolve(entry);
            })
        }
    })
}

// 远程调用引擎服务接口
pro._callEngineRemote = function (funcName, ...args) {
	let engines = pomelo.app.getServersByType('engine');
	let res = dispatcher.dispatch(this.entity.id, engines);
    let uids = {uid: this.entity.id, sid: this.entity.serverId};
	pomelo.app.rpc.engine.engineRemote[funcName].toServer(res.id, uids, ...args);
}

pro.formatEntryData = function (entry) {
    let formatdata = {
        _id: entry.id,
        uid: this.entity.id,
        state: entry.state,
        simuTime: entry.simuTime,
        simuStep: entry.simuStep,
        assignTask: entry.assignTask,
        signalSet: entry.signalSet,
        triggerSet: entry.triggerSet,
    }
    return formatdata;
}

pro.getSimulateInfo = async function (next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let formatdata = this.formatEntryData(entry);
    next(null, formatdata);
}

pro.assignTask = async function (assignInfos, next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let curState = entry.state;
    if (curState >= consts.SimulateState.Connected) {
        this.entity.logger.warn('仿真引擎已经启动了! state: ', curState);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    // TODO: 对分配节点做检测(如: 是否都是子系统、是否所有节点都分配了等)
    let project = await this.entity.lobby.getEntry(projectId);
    let mappingtbl = dbformatengine.formatDb2Engine(assignInfos, project.data);
    await this.entity.lobby.setMappingTbl(projectId, mappingtbl);
    entry.state = consts.SimulateState.GenCode;
    entry.assignTask = assignInfos;
    this.simulateById[projectId] = entry;
    this.waitToUpdateDB.add(projectId);
    next(null, { code: consts.Code.OK });
}

pro.generateCode = async function (genCodeInfo, next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let curState = entry.state;
    if (curState >= consts.SimulateState.Connected || curState < consts.SimulateState.GenCode || curState == consts.SimulateState.GenCoding) {
        this.entity.logger.warn('生成代码状态错误! state: ', curState);
        next(null, { code: consts.Code.FAIL });
        return;
    }
    next(null, { code: consts.Code.OK });

    // rpc engine server
    // entry.state = consts.SimulateState.GenCoding;
    this._callEngineRemote('generateCode', projectId, genCodeInfo, null);
}

pro.deploy = async function (next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let curState = entry.state;
    if (curState >= consts.SimulateState.Connected || curState < consts.SimulateState.Deploy || curState == consts.SimulateState.Deploying) {
        this.entity.logger.warn('部署状态错误! state: ', curState);
        next(null, { code: consts.Code.FAIL });
        return;
    }
    next(null, { code: consts.Code.OK });

    entry.state = consts.SimulateState.Deploying;
    this._callEngineRemote('deploy', projectId, null);
}

pro.connectEngine = async function(simuTime, simuStep, next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let curState = entry.state;
    if (curState != consts.SimulateState.CfgEnd) {
        this.entity.logger.warn('连接状态错误! state: ', curState);
        next(null, { code: consts.Code.FAIL });
        return;
    }
    next(null, { code: consts.Code.OK });

    entry.simuTime = simuTime;
    entry.simuStep = simuStep;
    this._callEngineRemote('initSimulation', projectId, simuTime, simuStep, null);
}

pro.disconnectEngine = async function (next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let curState = entry.state;
    if (curState < consts.SimulateState.Connected) {
        this.entity.logger.warn('断开连接状态错误! state: ', curState);
        next(null, { code: consts.Code.FAIL });
        return;
    }
    next(null, { code: consts.Code.OK });
    this._callEngineRemote('sendControlCmd', 3, null);
}

pro.startSimulate = async function(next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let curState = entry.state;
    if (curState != consts.SimulateState.Connected && curState != consts.SimulateState.Pause) {
        this.entity.logger.warn('开始仿真状态错误! state: ', curState);
        next(null, { code: consts.Code.FAIL });
        return;
    }
    next(null, { code: consts.Code.OK });
    this._callEngineRemote('sendControlCmd', 0, null);
}

pro.pauseSimulate = async function(next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let curState = entry.state;
    if (curState != consts.SimulateState.Start) {
        this.entity.logger.warn('暂停仿真状态错误! state: ', curState);
        next(null, { code: consts.Code.FAIL });
        return;
    }
    next(null, { code: consts.Code.OK });
    this._callEngineRemote('sendControlCmd', 1, null);
}

pro.stopSimulate = async function(next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let curState = entry.state;
    if (curState <= consts.SimulateState.Connected) {
        this.entity.logger.warn('停止仿真状态错误! state: ', curState);
        next(null, { code: consts.Code.FAIL });
        return;
    }
    next(null, { code: consts.Code.OK });
    this._callEngineRemote('sendControlCmd', 2, null);
}

pro.exitSimulate = async function (next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let curState = entry.state;
    if (curState < consts.SimulateState.Connected) {
        this.entity.logger.warn('退出仿真状态错误! state: ', curState);
        next(null, { code: consts.Code.FAIL });
        return;
    }
    next(null, { code: consts.Code.OK });
    this._callEngineRemote('sendControlCmd', 3, null);
}

pro.updateSignalList = async function (signal, next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    let signalSet = entry.signalSet;
    for (let i = 0; i < signal.length; i++) {
        const newItem = signal[i];
        let isNew = true;
        for (let j = 0; j < signalSet.length; j++) {
            let oldItem = signalSet[j];
            if (newItem.block_id == oldItem.block_id && 
                newItem.port_index == oldItem.port_index &&
                newItem.panel_id == oldItem.panel_id) {
                isNew = false;
                if (newItem.cancel) {
                    // 删除
                    signalSet.splice(j, 1);
                } else {
                    // 修改
                    oldItem.monitor = newItem.monitor;
                    oldItem.record = newItem.record;
                }
                break;
            }
        }

        if (isNew) {
            // 新插入
            signalSet.push(newItem);
        }
    }

    this.simulateById[projectId] = entry;
    this.waitToUpdateDB.add(projectId);
    next(null, { code: consts.Code.OK });

    // blockId转换为引擎下标id
    let project = await this.entity.lobby.getEntry(projectId);
    let mappingtbl = project.mappingtbl;
    for (let i = 0; i < signal.length; i++) {
        let item = signal[i];
        let engineBlockId = mappingtbl[item.panel_id + '_' + item.block_id];
        if (engineBlockId == 0 || engineBlockId) {
            item.block_id = engineBlockId;
        } else {
            this.entity.logger.warn('前端/引擎模块ID映射不存在!');
        }
    }
    this._callEngineRemote('signalManage', signal, null);
}

pro.onEngineSimuData = async function (msg) {
    let block_id = msg[0];
    let port_index = msg[1];
    let step = msg[2];
    let factor = msg[3];
    let value = msg[4];

    let projectId = this.entity.lobby.projectUUID;
    let project = await this.entity.lobby.getEntry(projectId);
    let mappingtbl = project.mappingtbl;
    let panelId = null;
    let blockId = null;
    for (const key in mappingtbl) {
        const value = mappingtbl[key];
        if (value == block_id) {
            let keys = key.split('_');
            panelId = keys[0];
            blockId = keys[1];
            break;
        }
    }

    if (panelId && blockId) {
        this.entity.sendMessage('onSimuData', {
            panel_id: panelId,
            block_id: blockId,
            port_index: port_index,
            step: step,
            factor: factor,
            value: value
        });
    } else {
        this.entity.logger.warn('找不到映射关系!');
    }
}

pro.modifyParameter = function (parameter, next) {
    next(null, { code: consts.Code.OK });
    this._callEngineRemote('modifyParameter', parameter, null);
}

pro.setTrigger = async function (triggerInfo, next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    entry.triggerSet = triggerInfo;
    this.simulateById[projectId] = entry;
    this.waitToUpdateDB.add(projectId);
    next(null, { code: consts.Code.OK });
    this._callEngineRemote('triggerSetting', triggerInfo, null);
}

pro.onEngineResponse = async function (code) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        return;
    }
    if (code == consts.EngineRspType.GenCodeSus) {
        entry.state = consts.SimulateState.Deploy;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
    } else if(code == consts.EngineRspType.GenCodeFail) {
        entry.state = consts.SimulateState.GenCode;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
    } else if(code == consts.EngineRspType.DeploySus) {
        entry.state = consts.SimulateState.CfgEnd;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
    } else if(code == consts.EngineRspType.DeployFail) {
        entry.state = consts.SimulateState.Deploy;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
    } else if(code == consts.EngineRspType.ConnectSus) {
        entry.state = consts.SimulateState.Connected;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
    } else if(code == consts.EngineRspType.ConnectFail) {
        entry.state = consts.SimulateState.CfgEnd;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
    } else if(code == consts.EngineRspType.TerminateSus) {
        entry.state = consts.SimulateState.CfgEnd;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
        this._disHeartbeat();
    } else if(code == consts.EngineRspType.StartSus) {
        entry.state = consts.SimulateState.Start;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
        // 发送触发器配置
        let triggerInfo = entry.triggerSet
        this._callEngineRemote('triggerSetting', triggerInfo, null);
        // 发送历史监控数据
        let signal = entry.signalSet;
        this._callEngineRemote('signalManage', signal, null);

    } else if(code == consts.EngineRspType.PauseSus) {
        entry.state = consts.SimulateState.Pause;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
    } else if(code == consts.EngineRspType.StopSus) {
        entry.state = consts.SimulateState.Connected;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
    } else if(code == consts.EngineRspType.SimulateCmdFail) {
    }
    
    this.entity.sendMessage('onRefreshSimulateState', {state: entry.state});
}

pro.onEngineHeart = async function (state) {
    let projectId = this.entity.lobby.projectUUID;
    if (!projectId) {
        return;
    }
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate db [%s] not exist!', projectId);
        return;
    }

    this._heartbeat();
    let asyncState = state + 6;
    if (entry.state != asyncState) {
        entry.state = asyncState;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
        // 通知前端刷新
        let formatdata = this.formatEntryData(entry);
        this.entity.sendMessage('onRefreshSimulateInfo', formatdata);
    }
}

pro._heartbeat = function () {
    if (this.heartbeatTimeoutId) {
        clearTimeout(this.heartbeatTimeoutId);
        this.heartbeatTimeoutId = null;
    }

    if (this.heartbeatId) {
        return;
    }
    this.heartbeatId = setTimeout(() => {
        this.heartbeatId = null;
        this.nextHeartbeatTimeout = Date.now() + this.heartbeatTimeout;
        this.heartbeatTimeoutId = setTimeout(this._heartbeatTimeoutCb.bind(this), this.heartbeatTimeout);
    }, this.heartbeatInterval);
}

pro._heartbeatTimeoutCb = async function() {
    var gap = this.nextHeartbeatTimeout - Date.now();
    if (gap > this.gapThreshold) {
        this.heartbeatTimeoutId = setTimeout(this._heartbeatTimeoutCb.bind(this), gap);
    } else {
        this.entity.logger.warn('engine heartbeat timeout!');
        let projectId = this.entity.lobby.projectUUID;
        let entry = await this.getEntry(projectId);
        entry.state = consts.SimulateState.CfgEnd;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
        // 通知前端刷新
        let formatdata = this.formatEntryData(entry);
        this.entity.sendMessage('onRefreshSimulateInfo', formatdata);
    }
}

// 正常退出引擎程序
pro._disHeartbeat = function () {
    if (this.heartbeatTimeoutId) {
        clearTimeout(this.heartbeatTimeoutId);
        this.heartbeatTimeoutId = null;
    }

    if (this.heartbeatId) {
        clearTimeout(this.heartbeatId);
        this.heartbeatId = null;
    }
}