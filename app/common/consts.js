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

    Code: {
        OK: 0,
        FAIL: 1,
    },

    Login: {
        OK: 200,  		// 成功
        RELAY: 201,     // 重新登入
        MAINTAIN: 202,  // 维护
        NONSUPPORT: 203, // 不支持平台
        FAIL: 500       // 失败
    },

    CheckInResult: {
        SUCCESS: 0,  		// 成功
        ALREADY_ONLINE: 1,  // 已经在线
	},
}