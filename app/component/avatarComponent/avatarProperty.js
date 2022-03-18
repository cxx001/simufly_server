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
};

module.exports = {
    persistProperties: persistProperties
};
