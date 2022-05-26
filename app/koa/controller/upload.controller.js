const fs = require('fs');
const path = require('path');
const pomelo = require('pomelo');
const entityManager = require('../../services/entityManager');
const convert = require('xml-js');
const AdmZip = require("adm-zip");
const child_process = require('child_process');
const { fileUploadError } = require('../constant/err.type');
const consts = require('../../common/consts');
const gra4formatdb = require('../util/gra4formatdb');

const splitPortInfo = function (inputData, outData) {
    let ports = [];
    for (let i = 0; i < inputData.length; i++) {
        const element = inputData[i];
        ports.push({
            id: consts.InPrefix + i,
            name: element.Name,
            type: element.Type,
            value: element.Default,
            group: consts.InFlag
        });
    }

    for (let i = 0; i < outData.length; i++) {
        const element = outData[i];
        ports.push({
            id: consts.OutPrefix + i,
            name: element.Name,
            type: element.Type,
            value: element.Default,
            group: consts.OutFlag
        });
    }
    return ports;
}

const extractZipInfo = function (fileName) {
    let projectList = {};
    let mainPanel = null;
    let mainCount = 0;
    const zip = new AdmZip(fileName);
    const zipEntries = zip.getEntries();
    zipEntries.forEach(function (zipEntry) {
        const extname = path.extname(zipEntry.name);
        if (extname == '.gra4') {
            let entryData = zipEntry.getData().toString("utf8");
            let toJsonData = convert.xml2json(entryData, { compact: true, spaces: 4 });
            toJsonData = JSON.parse(toJsonData);
            projectList[path.normalize(zipEntry.entryName)] = toJsonData;
            if (toJsonData.Model.IoportGroup._attributes.Count == 0) {
                mainCount++;
                if (mainCount > 1) {
                    console.warn('导入工程存在多个入口gra4文件!');
                } else {
                    mainPanel = toJsonData;
                }
            }
        }
    });

    return [mainPanel, projectList];
}

const execImportCmd = (fileName) => {
    let cmd = `buildfly_block_gen ${fileName}`
    return new Promise((resolve, reject) => {
        child_process.exec(cmd, (error, stdout, stderr) => {
            if(error) {
                resolve(false);
            } else {
                if (stdout.indexOf('Import success') >= 0) {
                    resolve(true);
                } else if(stdout.indexOf('Import failed') >= 0) {
                    resolve(false);
                }
            }
        })
    })
}

/**
 * * 要求客户gra4格式约定:
 * 1. 文件格式不能是gb2312, 要转为utf-8
 * 2. 一个项目所有gra4打包成一个zip包
 */
class UploadController {
    async importProject(ctx, next) {
        const { uid } = ctx.request.body;
        const { file } = ctx.request.files   // 上传的文件key
        // let fileTypes = ['image/png', 'image/jpeg']
        if (file && file.size > 0) {
            console.log('[%s]上传文件: %s 路径: %s', uid, file.name, file.path);
            try {
                // 读取压缩包数据
                let extract = extractZipInfo(file.path);
                let mainPanel = extract[0];
                let projectList = extract[1];
                if (!mainPanel) {
                    console.warn('入口gra4文件不存在!');
                    return;
                }

                let data = [];
                gra4formatdb.splitChildSys(uid, projectList, data, null, mainPanel, pomelo.app.db.genId(), null, null);

                // 存数据库
                let db = {
                    uid: uid,
                    data: data
                }
                let id = pomelo.app.db.genId();
                let avatar = entityManager.getEntity(uid);
                await avatar.lobby.getEntry(id, db);

                // 同步用户表, 前面已经判断用户一定在线
                let proinfo = {
                    id: id,
                    name: data[0].name
                }
                avatar.modifyProList(consts.ControlType.Add, proinfo);

                // 回给前端数据
                ctx.body = {
                    code: 200,
                    message: '项目导入成功',
                    result: {
                        proinfo: proinfo
                    }
                }
            } catch (e) {
                console.log('error', e)
                ctx.app.emit('error', fileUploadError, ctx)
                return
            }
        } else {
            ctx.app.emit('error', fileUploadError, ctx)
            return
        }

        await next()
    }

    async importModel(ctx, next) {
        const { uid, groupName } = ctx.request.body;
        const { file } = ctx.request.files   // 上传的文件key
        if (file && file.size > 0) {
            console.log('[%s]上传文件: %s 路径: %s', uid, file.name, file.path);
            try {
                // zip移动
                fs.renameSync(file.path, `${consts.EngineBasePath}${file.name}`);

                // 解析zip包
                let fileName = path.basename(file.name, '.zip');
                let result = await execImportCmd(fileName);
                if (!result) {
                    ctx.app.emit('error', fileUploadError, ctx);
                    return;
                }

                // 读取生成的相关json信息
                let importResult = JSON.parse(fs.readFileSync(`${consts.EngineBasePath}result.json`));
                for (let i = 0; i < importResult.length; i++) {
                    const item = importResult[i];
                    const data = JSON.parse(fs.readFileSync(`${item.Path}`));
                    let key = item.Path.split('/');
                    key = `${key[key.length-2]}_${key[key.length-1]}`;
                    let id = uid + '_' + path.basename(key, '.json');

                    // 获取/设置组, 同步用户表
                    let sid = ctx.userdata.sid;
                    let modelInfo = {
                        id: id,
                        name: data.Name,
                        width: 80,            // TODO: width, height, nodeType信息需要用户解答, 当前数字模型源代码中好像提取不出这些信息.
                        height: 60,
                        nodeType: 1,
                        ports: splitPortInfo(data.U_Input.Datas, data.Y_Output.Datas)
                    }

                    let avatar = entityManager.getEntity(uid);
                    let groupId = avatar.setModelGroup(groupName, modelInfo);

                    // 存数据库
                    let db = {
                        uid: uid,
                        groupId: groupId,
                        data: data
                    }
                    await avatar.assetsModel.getEntry(id, db);

                    // 回给前端数据
                    modelInfo.groupId = groupId;
                    ctx.body = {
                        code: 200,
                        message: '模型导入成功',
                        result: {
                            modelInfo: modelInfo
                        }
                    }
                }
            } catch (e) {
                console.log('error', e)
                ctx.app.emit('error', fileUploadError, ctx)
                return
            }
        } else {
            ctx.app.emit('error', fileUploadError, ctx)
            return
        }

        await next()
    }
}

module.exports = new UploadController()