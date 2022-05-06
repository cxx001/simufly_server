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
const { cursorTo } = require('readline');

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
                        uid: this.entity.id,
                        state: 0,
                        simuTime: 0,
                        simuStep: 0,
                        assignTask: [],
                        signalSet: [],
                        triggerSet: {},
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
    } else if(code == consts.EngineRspType.TerminateSus) {
        entry.state = consts.SimulateState.CfgEnd;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
    } else if(code == consts.EngineRspType.StartSus) {
        entry.state = consts.SimulateState.Start;
        this.simulateById[projectId] = entry;
        this.waitToUpdateDB.add(projectId);
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
}

pro.getSimulateInfo = async function (next) {
    let projectId = this.entity.lobby.projectUUID;
    let entry = await this.getEntry(projectId);
    if (!entry) {
        this.entity.logger.warn('get simulate [%s] not exist!', projectId);
        next(null, { code: consts.Code.FAIL });
        return;
    }

    next(null, entry);
}

pro.assignTask = async function (assignList, next) {
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

    entry.state = consts.SimulateState.GenCode;

    // TODO: 对分配节点做检测(如: 是否都是子系统、是否所有节点都分配了等)
    entry.assignTask = assignList;
    this.simulateById[projectId] = entry;
    this.waitToUpdateDB.add(projectId);
    next(null, { code: consts.Code.OK });
}

pro.genCode = async function (genCodeInfo, next) {
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
    entry.state = consts.SimulateState.GenCoding;
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

    this._callEngineRemote('initSimulation', projectId, simuTime, simuStep, (code) => {
        if (code == consts.EngineRspType.ConnectSus) {
            entry.state = consts.SimulateState.Connected;
            entry.simuTime = simuTime;
            entry.simuStep = simuStep;
            this.simulateById[projectId] = entry;
            this.waitToUpdateDB.add(projectId);
        }
    });
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
            if (newItem.block_id == oldItem.block_id && newItem.port_index == oldItem.port_index) {
                isNew = false;
                if (newItem.cancel) {
                    // 删除
                    oldItem.splice(j, 1);
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
            signalSet.push({
                monitor: newItem.monitor,
                record: newItem.record,
                block_id: newItem.block_id,
                port_index: newItem.port_index
            });
        }
    }

    this.simulateById[projectId] = entry;
    this.waitToUpdateDB.add(projectId);
    next(null, { code: consts.Code.OK });
    this._callEngineRemote('signalManage', signal, null);
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