/**
 * Date: 2022/3/11
 * Author: admin
 * Description: 常量文件
 */
'use strict';

module.exports = {
    // entity state
    ENTITY_STATE_INITED: 1,
    ENTITY_STATE_DESTROYED: 2,

    // 平台
    Platform: {
        WIN: "win",
    },

    INVALID_CHAIR: 65535, 	   //无效用户

    InPrefix: 'in_',
    OutPrefix: 'out_',
    InFlag: 'in',
    OutFlag: 'out',

    Code: {
        OK: 0,
        FAIL: 1,
    },

    Login: {
        OK: 200,  		// 成功
        RELAY: 201,     // 重新登入
        MAINTAIN: 202,  // 维护
        NONSUPPORT: 203, // 不支持平台
        CHECKFAIL: 204, // 账号密码校验失败
        NONACCOUNT: 205, // 账号不存在
        FAIL: 500       // 失败
    },

    CheckInResult: {
        SUCCESS: 0,  		// 成功
        ALREADY_ONLINE: 1,  // 已经在线
	},

    MsgFlowCode: {
        GenCode: 1,  // 生成代码完成
        DeployUpload: 2, // 上传代码完成
        DeployDoShell: 3, // 执行解压、编译脚本完成
        InitEngine: 4, // 初始化引擎完成
        ConnEngine: 5, // 握手绑定完成
        StartSimulation: 6,  // 开始仿真
        StopSimulation: 7,  // 停止仿真
        ExitSimulation: 8,  // 退出仿真
    },

    TipsLevel: {
        info: 1,
        warn: 2,
        error: 3
    },

    MsgTipsCode: {
        NONProjectUUID: {code: 1, msg: '项目UUID不存在'},
        CreateDirFail: {code: 2, msg: '生成代码目录创建失败'},
        GenCodeFail: {code: 3, msg: '生成代码失败'},
        NONDeployPath: {code: 4, msg: '部署上传代码不存在'},
        DeployUploadFail: {code: 5, msg: '部署上传代码失败'},
        DeployDoShellFail: {code: 6, msg: '部署执行脚本失败'},
        InitEngineFail: {code: 7, msg: '初始化引擎失败'},
        UserBindedEngine: {code: 8, msg: '用户已经绑定引擎了'},
        UserNoBindedEngine: {code: 9, msg: '用户没有绑定引擎了'},
        SimulationExitFail: {code: 10, msg: '仿真退出失败'},
        EngineHandleFail: {code: 11, msg: '引擎握手消息失败'},
        StartSimulationFail: {code: 12, msg: '开始仿真失败'},
        StopSimulationFail: {code: 13, msg: '停止仿真失败'},
        ExitSimulationFail: {code: 14, msg: '退出仿真失败'},
    },

    ControlType: {
        Add: 1,
        Delete: 2,
    }
}