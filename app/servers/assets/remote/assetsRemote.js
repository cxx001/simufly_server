/**
 * Date: 2022/4/1
 * Author: admin
 * Description:
 */
'use strict';
module.exports = function (app) {
    return new Remote(app);
}

var Remote = function (app) {
    this.app = app;
}

var pro = Remote.prototype;

pro.getProject = function (uid, projectId, cb) {
    this.app.assetsStub.getProject(uid, projectId, cb);
}

pro.getDBProject = function (projectId, cb) {
    this.app.assetsStub.getDBProject(projectId, cb);
}

pro.savePanel = function (projectId, panelDatas, cb) {
    this.app.assetsStub.savePanel(projectId, panelDatas, cb);
}

pro.deletePanel = function (projectId, panelId, cb) {
    this.app.assetsStub.deletePanel(projectId, panelId, cb);
}

pro.deleteProject = function (projectId, cb) {
    this.app.assetsStub.deleteProject(projectId, cb);
}

pro.modifyBlockInfo = function (projectId, panelId, blockId, modifyInfo, cb) {
    this.app.assetsStub.modifyBlockInfo(projectId, panelId, blockId, modifyInfo, cb);
}

//*********************************************************************************** */

pro.getModelInfo = function (modelId, cb) {
    this.app.assetsModelStub.getModelInfo(modelId, cb);
}

pro.modifyModelInfo = function (modelId, modifyInfo, cb) {
    this.app.assetsModelStub.modifyModelInfo(modelId, modifyInfo, cb);
}