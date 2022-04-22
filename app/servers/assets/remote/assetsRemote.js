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

pro.getProject = function (id, cb) {
    this.app.assetsStub.getProject(id, cb);
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

pro.getModelInfo = function (modelId, cb) {
    this.app.assetsModelStub.getModelInfo(modelId, cb);
}

pro.modifyModelInfo = function (modelId, modifyInfo, cb) {
    this.app.assetsModelStub.modifyModelInfo(modelId, modifyInfo, cb);
}