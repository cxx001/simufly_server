/**
 * Date: 2022/3/25
 * Author: admin
 * Description:
 */
'use strict';
const pomelo = require('pomelo');
const consts = require('../common/consts');
const utils = require('../util/utils')
const logger = require('pomelo-logger').getLogger('cskl', '__filename');
const ssh2 = require('../util/ssh2');
const fs = require('fs');
const messageService = require('../services/messageService');
const child_process = require('child_process');

// 配置
const remotePackagePath = '/home/package/simufly_engine.zip';   // 文件夹目录名要为项目对应的UUID
const server = {
    host: '192.168.10.251',
    port: 22,
    username: 'root',
    password: 'redhat',
}

var instance = null;
module.exports = function (app) {
    if (instance) {
        return instance;
    }
    return instance = new EngineStub(app);
};

var EngineStub = function (app) {
    this.app = app;
    let engines = app.get('servers').engine;
    let engineCfg = utils.find2key('id', app.get('serverId'), engines);
    this.zmqHost = engineCfg.zmqHost;
    this.zmqReqPort = engineCfg.zmqReqPort;
    this.zmqRspPort = engineCfg.zmqRspPort;

    // 创建zmq通信子进程
    this.zmqProcess = null;
    this._createChildProcess();
    this.uid2sid = {};
};

var pro = EngineStub.prototype;

pro._createChildProcess = function () {
    this.zmqProcess = child_process.spawn('node', ['./app/util/zmq.js'], { stdio: [null, null, null, 'ipc'] });
    this.zmqProcess.stdout.on('data', function (data) {
        logger.info('zmq进程日志: ' + data);
    });

    this.zmqProcess.stderr.on('data', function (data) {
        logger.warn('zmq进程错误: ' + data);
    });

    this.zmqProcess.on('close', function (code) {
        logger.info('zmq进程已退出, 退出码: ' + code);
    });

    this.zmqProcess.on('message', (m) => {
        // onXxxx
        let funcName = 'on' + m.route;
        let fn = pro[funcName];
        if (fn) {
            fn.call(this, m.uid, m.msg);
        }
    });

    let msg = {
        route: 'init',
        msg: { zmqReqPort: this.zmqReqPort, zmqRspPort: this.zmqRspPort }
    }
    this.zmqProcess.send(msg);

    // 模拟向引擎发送
    // setInterval(() => {
    //     this.zmqProcess.send({
    //         uid: "A",
    //         route: 'ModifyParameter',
    //         msg: {
    //             name: "1232343254325",
    //             value: 100
    //         }
    //     });
    // }, 5000);
}

pro.updateUserState = function (uid, sid, cb) {
    utils.invokeCallback(cb);
    this.uid2sid[uid] = sid;
    logger.info('更新用户状态. uid-sid: ', uid, sid);
}

pro.getSidByUid = function (uid) {
    return this.uid2sid[uid];
}

pro.generateCode = function (uids, projectUUID, genCodeInfo, cb) {
    utils.invokeCallback(cb);
    /* // 执行bat
    child_process.execFile('exec.bat', null, {cwd: 'E:/simufly_engine-main/code_gen/bin'}, function(error, stdout, stderr) {  
        if(error){
            console.log("exec error"+error)
        } else {
            console.log("成功")
        }
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);
    });*/

    // 执行sh
    let count = 0;
    let packageName = `${uids.uid}_${projectUUID}`;
    child_process.exec(`code_gen ${packageName}`, (error, stdout, stderr) => {
        if(error) {
            logger.warn(error);
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.GenCodeFail, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.GenCodeFail,
                des: '生成代码失败!'
            });
        } else {
            count++;
            if (count == 1) {
                pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.GenCodeing, null);
            }
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.GenCoding,
                des: stdout
            });

            if (stdout.indexOf('Code generation success') >= 0) {
                pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.GenCodeSus, null);
                messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                    code: consts.MsgFlowCode.GenCoded,
                    des: '生成代码完成.'
                });
            } else if(stdout.indexOf('Code generation failed') >= 0) {
                pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.GenCodeFail, null);
                messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                    code: consts.MsgFlowCode.GenCodeFail,
                    des: '生成代码失败!'
                });
            }
        }
    })
}

pro.deploy = async function (uids, projectUUID, cb) {
    utils.invokeCallback(cb);

    // 路径
    projectUUID = 'simufly_engine';
    let localPath = `./assets/${uids.uid}/${projectUUID}.zip`;
    let remoteDir = `/home/cxx/${uids.uid}/`;
    let remotePath = `${remoteDir}${projectUUID}.zip`;

    if (!fs.existsSync(localPath)) {
        logger.warn("deploy local path[%s] not exist!", localPath);
        pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.DeployFail, null);
        messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
            code: consts.MsgFlowCode.DeployFail,
            des: '部署失败!'
        });
        return;
    }

    // 1. 创建远程目录
    let mkdir = `mkdir ${remoteDir}\r\nexit\r\n`;
    await ssh2.Shell(server, mkdir, (err, data) => {
        if (err) {
            logger.warn('ssh shell commond fail! err: %o', err);
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.DeployFail, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.DeployFail,
                des: '部署失败!'
            });
            return;
        }
        logger.info(data);
    })

    messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
        code: consts.MsgFlowCode.Deploying,
        des: '代码上传中...'
    });

    // 2. 上传
    ssh2.UploadFile(server, localPath, remotePath, (err, result) => {
        if (err) {
            logger.warn('ssh upload deploy file fail! err: %o', err);
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.DeployFail, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.DeployFail,
                des: '部署失败!'
            });
            return;
        }
        messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
            code: consts.MsgFlowCode.Deploying,
            des: '代码上传完成.'
        });

        // 3. 解压、编译
        let triggerCount = 0;
        let pathCmd1 = `cd ${remoteDir};`;
        let unzipCmd = `unzip -o ./${projectUUID}.zip;`;
        let pathCmd2 = `cd ./${projectUUID}/demo2/;`;
        let compileCmd = `./compile.sh;`;
        let cmd = `${pathCmd1}${unzipCmd}${pathCmd2}${compileCmd}\r\nexit\r\n`;
        ssh2.Shell(server, cmd, (err, data) => {
            if (err) {
                logger.warn('ssh shell commond fail! err: %o', err);
                pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.DeployFail, null);
                messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                    code: consts.MsgFlowCode.DeployFail,
                    des: '部署失败!'
                });
                return;
            }

            // 执行解压、编译中
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.Deploying,
                des: data
            });

            // 完成
            if (data.indexOf('logout') >= 0) {
                triggerCount++;
                if (triggerCount <= 1) {
                    pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.DeploySus, null);
                    messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                        code: consts.MsgFlowCode.Deployed,
                        des: '部署完成.'
                    });
                } else {
                    logger.warn('logout执行标志有多次匹配!');
                }
            }
        });
    });
}

pro.initSimulation = function (uids, projectUUID, simuTime, simuStep, cb) {
    utils.invokeCallback(cb);

    // 路径
    projectUUID = 'simufly_engine';
    let pathCmd = `cd /home/cxx/${uids.uid}/${projectUUID}/demo2/;`;
    let startCmd = `./start.sh ${this.zmqHost} ${this.zmqReqPort} ${this.zmqRspPort} ${uids.uid} ${simuTime} ${simuStep} &`;
    let cmd = `${pathCmd}${startCmd}\r\nexit\r\n`;
    ssh2.Shell(server, cmd, (err, data) => {
        if (err) {
            logger.warn('ssh shell commond fail! err: %o', err);
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.ConnectFail, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.ConnectFail,
                des: '连接引擎失败!'
            });
            return;
        }
    });
}

pro.sendControlCmd = function (uids, cmdtype, cb) {
    utils.invokeCallback(cb);

    // 向引擎发命令
    this.zmqProcess.send({
        uid: uids.uid,
        route: 'ControlCmd',
        msg: {
            cmd_type: cmdtype,
        }
    });
}

pro.modifyParameter = function (uids, parameter, cb) {
    utils.invokeCallback(cb);

    if (!parameter) {
        return;
    }

    for (let i = 0; i < parameter.length; i++) {
        let item = parameter[i];
        item._type = 'Parameter';
    }

    this.zmqProcess.send({
        uid: uids.uid,
        route: 'ModifyParameter',
        msg: {
            parameter: parameter,
        }
    });
}

pro.signalManage = function (uids, signal, cb) {
    utils.invokeCallback(cb);

    if (!signal || signal.length < 1) {
        return;
    }

    let engineSignal = [];
    for (let i = 0; i < signal.length; i++) {
        let item = signal[i];
        let tmp = {};
        tmp._type = 'Signal';
        tmp.cancel = item.cancel ? true : false;
        tmp.monitor = item.monitor ? true : false;
        tmp.record = item.record ? true : false;
        tmp.block_id = item.block_id;
        tmp.port_index = item.port_index;
        engineSignal.push(tmp);
    }

    this.zmqProcess.send({
        uid: uids.uid,
        route: 'SignalManage',
        msg: {
            signal: engineSignal,
        }
    });
}

pro.triggerSetting = function (uids, triggerInfo, cb) {
    utils.invokeCallback(cb);

    this.zmqProcess.send({
        uid: uids.uid,
        route: 'TriggerSetting',
        msg: {
            status: triggerInfo.status ? true : false,
            source: triggerInfo.source,
            mode: triggerInfo.mode,
            collect_factor: triggerInfo.collect_factor,
            collect_count: triggerInfo.collect_count,
            block_id: triggerInfo.block_id,
            port_index: triggerInfo.port_index,
            direction: triggerInfo.direction,
            value: triggerInfo.value
        }
    });
}

/****************************************引擎推送数据********************************************** */
pro.onStateResponse = function (uid, msg) {
    let state_type = msg[0];
    let ret = msg[1];

    let sid = this.getSidByUid(uid);
    if (!sid) {
        logger.warn('用户[%s]不在线!', uid);
        return;
    }

    let uids = { uid: uid, sid: sid };
    if (state_type == consts.EngineRspState.kConnectRep) {
        // connectRep
        if (ret == consts.EngineRspErrorCode.kOk) {
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.ConnectSus, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.Connected,
                des: '连接引擎成功.'
            });
        } else {
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.ConnectFail, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.ConnectFail,
                des: '连接引擎失败!'
            });
        }
    } else if (state_type == consts.EngineRspState.kStartRep) {
        // startRep
        if (ret == consts.EngineRspErrorCode.kOk) {
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.StartSus, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.Started,
                des: '仿真开始...'
            });
        } else {
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.SimulateCmdFail, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.StartFail,
                des: '仿真开始失败!'
            });
        }
    } else if (state_type == consts.EngineRspState.kPause) {
        // pause
        if (ret == consts.EngineRspErrorCode.kOk) {
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.PauseSus, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.Paused,
                des: '仿真暂停.'
            });
        } else {
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.SimulateCmdFail, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.PauseFail,
                des: '仿真暂停失败!'
            });
        }

    } else if (state_type == consts.EngineRspState.kStopRep) {
        // stopRep
        if (ret == consts.EngineRspErrorCode.kOk) {
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.StopSus, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.Stoped,
                des: '仿真停止.'
            });
        } else {
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.SimulateCmdFail, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.StopFail,
                des: '仿真停止失败!'
            });
        }
    } else if (state_type == consts.EngineRspState.kTerminateRep) {
        // terminateRep
        if (ret == consts.EngineRspErrorCode.kOk) {
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.TerminateSus, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.Terminated,
                des: '仿真程序退出.'
            });
        } else {
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.SimulateCmdFail, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.TerminateFail,
                des: '仿真程序退出失败!'
            });
        }
    }
}

// 引擎推送监控数据
pro.onSimuData = function (uid, msg) {
    // 结果推送给前端
    let sid = this.getSidByUid(uid);
    if (sid) {
        let uids = { uid: uid, sid: sid }
        pomelo.app.rpc.connector.entryRemote.onEngineSimuData.toServer(uids.sid, uids.uid, msg, null);
    }
}

// 心跳
pro.onHeartBeat = function (uid, msg) {
    let current_state = msg[0];
    let sid = this.getSidByUid(uid);
    if (sid) {
        pomelo.app.rpc.connector.entryRemote.onEngineHeart.toServer(sid, uid, current_state, null);
    }
}