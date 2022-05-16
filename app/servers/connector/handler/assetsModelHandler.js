/**
 * Date: 2022/5/16
 * Author: admin
 * Description: 
 */
'use strict';
module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
};

var handler = Handler.prototype;

// 数字模型查看 -- model是数字模型导入
handler.getModelInfo = function (msg, session, next) {
	session.avatar.assetsModel.getModelInfo(msg.modelId, next);
}

handler.modifyModelInfo = function (msg, session, next) {
	session.avatar.assetsModel.modifyModelInfo(msg.modelId, msg.modifyInfo, next);
}