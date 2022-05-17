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
        GenCoding: 1, // 生成代码中
        GenCoded: 2,  // 生成代码完成
        GenCodeFail: 3, // 生成代码失败
        Deploying: 4, // 部署中
        Deployed: 5,  // 部署完成
        DeployFail: 6, // 部署失败 
        Connected: 7, // 连接引擎完成
        ConnectFail: 8, // 连接引擎失败
        Started: 9, // 开始仿真
        StartFail: 10, // 开始仿真失败
        Paused: 11, // 暂停仿真
        PauseFail: 12, // 暂停失败
        Stoped: 13, // 停止仿真
        StopFail: 14, // 停止仿真失败
        Terminated: 15, // 中断仿真程序
        TerminateFail: 16, // 仿真程序中断失败
    },

    ControlType: {
        Add: 1,
        Delete: 2,
    },

    ShapeType: {
        Block: 0,
        Add: 2,
        SubSys: 6,
        Input: 10,
        Output: 11,
        MoreOne: 12,
        OneMore: 13,
    },

    SimulateState: {
        AssignTask: 0,  // 分配任务
        GenCode: 1,     // 生成代码
        GenCoding: 2,   // 生成代码中
        Deploy: 3,      // 部署
        Deploying: 4,   // 部署中
        CfgEnd: 5,      // 配置完成
        Connected: 6,   // 连接成功
        Start: 7,       // 开始仿真
        Pause: 8,        // 暂停仿真
    },

    EngineRspType: {
        GenCodeSus: 1,  // 生成代码成功
        GenCodeFail: 2, // 生成代码失败
        DeploySus: 3, // 部署成功
        DeployFail: 4, // 部署失败
        ConnectSus: 5,  // 连接成功
        ConnectFail: 6, // 连接失败
        StartSus: 7,    // 开始仿真成功
        PauseSus: 8,   // 暂停仿真成功
        StopSus: 9,   // 停止仿真成功
        TerminateSus: 10,  // 退出仿真成功
        SimulateCmdFail: 11, // 仿真命令操作失败
    },

    EngineRspState: {
        kConnectRep: 0,
        kStartRep: 1,
        kPause: 2,
        kStopRep: 3,
        kTerminateRep: 4
    },

    EngineRspErrorCode: {
        kOk: 0,
        KBadValue: 1,
    }
}