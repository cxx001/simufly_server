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
const path = require('path');
const messageService = require('../services/messageService');
const child_process = require('child_process');
const {zmqInit, zmqSend} = require('../util/zmq');

var instance = null;
module.exports = function (app) {
    if (instance) {
        return instance;
    }
    return instance = new EngineStub(app);
};

var EngineStub = function (app) {
    // let engines = app.get('servers').engine;
    // let engineCfg = utils.find2key('id', app.get('serverId'), engines);
    /**
     * TODO: 为了兼容pkg打包config有些pomelo框架内默认配置不能提外边, 临时加个配置提到外边
     */
    let pkgTest = path.join(process.cwd(), '/config/pkg_test.json');
    pkgTest = JSON.parse(fs.readFileSync(pkgTest));
    pkgTest = pkgTest[app.get('env')];
    this.zmqHost = pkgTest.upperHost;
    this.zmqReqPort = pkgTest.zmqReqPort;
    this.zmqRspPort = pkgTest.zmqRspPort;
    this.uid2sid = {};
    zmqInit({app: this, zmqReqPort: this.zmqReqPort, zmqRspPort: this.zmqRspPort });
};

var pro = EngineStub.prototype;

pro.onZmqMsg = function (m) {
    let funcName = 'on' + m.route;
    let fn = pro[funcName];
    if (fn) {
        fn.call(this, m.uid, m.msg);
    }
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
    child_process.exec(`model_gen ${packageName}`, (error, stdout, stderr) => {
        if(error) {
            logger.warn(error);
            pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.GenCodeFail, null);
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.GenCodeFail,
                des: error
            });
            messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                code: consts.MsgFlowCode.GenCodeFail,
                des: '生成代码失败!'
            });
        } else {
            count++;
            if (count == 1) {
                pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.GenCodeing, null);
                messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                    code: consts.MsgFlowCode.GenCoding,
                    des: '代码生成中...'
                });
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

pro.deploy = async function (uids, projectUUID, underIP, cb) {
    utils.invokeCallback(cb);

    // 路径
    let packageName = `${uids.uid}_${projectUUID}`; 
    let localPath = `${consts.EngineBasePath}auto_gen/${packageName}.tar.gz`;
    let remoteDir = `/home/${uids.uid}/`;
    let remotePath = `${remoteDir}${packageName}.tar.gz`;

    if (!fs.existsSync(localPath)) {
        logger.warn("deploy local path[%s] not exist!", localPath);
        pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.DeployFail, null);
        messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
            code: consts.MsgFlowCode.DeployFail,
            des: '部署失败!'
        });
        return;
    }

    // 配置中查找下位机
    let server = null;
    let underMachine = pomelo.app.get('underMachine');
    for (let i = 0; i < underMachine.length; i++) {
        const item = underMachine[i];
        if (underIP == item.host) {
            server = item;
            break;
        }
    }
    if (!server) {
        logger.warn("deploy underMachine[%s] not exist!", underIP);
        pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.DeployFail, null);
        messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
            code: consts.MsgFlowCode.DeployFail,
            des: '部署失败!'
        });
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

        // 3. 解压、编译、删除engine目录
        let pathCmd1 = `cd ${remoteDir};`;
        let tarCmd = `tar -zxvf ${packageName}.tar.gz;`;
        let pathCmd2 = `cd ./${packageName};`;
        let decryCmd = `dd if=engine.des3 |openssl des3 -d -k keliang2022 | tar xzf -;`;
        let compileCmd = './compile.sh;';
        let rmEngine = 'rm -rf engine;';
        let cmd = `${pathCmd1}${tarCmd}${pathCmd2}${decryCmd}${compileCmd}${rmEngine}\r\nexit\r\n`;
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
            if (data.indexOf('Compile success') >= 0) {
                pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.DeploySus, null);
                messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                    code: consts.MsgFlowCode.Deployed,
                    des: '部署完成.'
                });
            } else if (data.indexOf('Compile failed') >= 0) {
                pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.DeployFail, null);
                messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
                    code: consts.MsgFlowCode.DeployFail,
                    des: '部署失败!'
                });
            }
        });
    });
}

pro.initSimulation = function (uids, projectUUID, simuTime, simuStep, underIP, cb) {
    utils.invokeCallback(cb);

    // 配置中查找下位机
    let server = null;
    let underMachine = pomelo.app.get('underMachine');
    for (let i = 0; i < underMachine.length; i++) {
        const item = underMachine[i];
        if (underIP == item.host) {
            server = item;
            break;
        }
    }
    if (!server) {
        logger.warn('initSimulation underMachine[%s] not exist!', underIP);
        pomelo.app.rpc.connector.entryRemote.onEngineResponse.toServer(uids.sid, uids.uid, consts.EngineRspType.ConnectFail, null);
        messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
            code: consts.MsgFlowCode.ConnectFail,
            des: '连接引擎失败!'
        });
        return;
    }

    // 路径
    let packageName = `${uids.uid}_${projectUUID}`; 
    let pathCmd = `cd /home/${uids.uid}/${packageName}/bin;`;
    let startCmd = `./engine ${this.zmqHost} ${this.zmqReqPort} ${this.zmqRspPort} ${uids.uid} ${simuTime} ${simuStep}`;
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

        messageService.pushMessageToPlayer(uids, 'onFlowMsg', {
            code: consts.MsgFlowCode.Connected,
            des: data
        });
    });
}

pro.sendControlCmd = function (uids, cmdtype, cb) {
    utils.invokeCallback(cb);

    // 向引擎发命令
    zmqSend({
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

    let msg = [];
    for (let i = 0; i < parameter.length; i++) {
        const item = parameter[i];
        let unit = {};
        unit._type = 'Parameter';
        unit.block_id = item.engineBlockId;
        unit.port_index = item.port_index;
        unit.value = item.value;
        msg.push(unit);
    }

    zmqSend({
        uid: uids.uid,
        route: 'ModifyParameter',
        msg: {
            parameter: msg,
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

    zmqSend({
        uid: uids.uid,
        route: 'SignalManage',
        msg: {
            signal: engineSignal,
        }
    });
}

pro.triggerSetting = function (uids, triggerInfo, cb) {
    utils.invokeCallback(cb);

    let comtext = {};
    comtext.status = triggerInfo.status ? true : false;
    comtext.source = triggerInfo.source;
    comtext.mode = triggerInfo.mode;
    comtext.collect_factor = triggerInfo.collect_factor;
    comtext.collect_count = triggerInfo.collect_count;
    // protobuf要求optional没有传递的值就不能创建,赋null也不行
    if (triggerInfo.block_id || triggerInfo.block_id == 0) {
        comtext.block_id = triggerInfo.block_id;
    }
    if (triggerInfo.port_index || triggerInfo.port_index == 0) {
        comtext.port_index = triggerInfo.port_index;
    }
    if (triggerInfo.direction || triggerInfo.direction == 0) {
        comtext.direction = triggerInfo.direction;
    }
    if (triggerInfo.value || triggerInfo.value == 0) {
        comtext.value = triggerInfo.value;
    }

    zmqSend({
        uid: uids.uid,
        route: 'TriggerSetting',
        msg: comtext
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