/**
 * Date:  2022/3/11
 * Author: admin
 * Description: avatar属性定义
 */
'use strict';
let persistProperties = {
    openid: "",  // openid
    account: "",  // 账号
    password: "",  // 密码
	createTime: 0, //创建时间
	lastOfflineTime: 0,  //上次下线时间
    projectList: [],  // 项目列表
    groupList: [],     // 数字模型分组列表
    modelList: [],     // 数字模型列表
    entityList: [],    // 实物模型列表
    protocolList: [],  // 协议列表
};

module.exports = {
    persistProperties: persistProperties
};
