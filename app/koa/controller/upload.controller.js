const fs = require('fs');
const path = require('path');
const pomelo = require('pomelo');
const convert = require('xml-js');
const AdmZip = require("adm-zip");
const utils = require('../../util/utils');
const { fileUploadError } = require('../constant/err.type');
const consts = require('../../common/consts');
const gra4formatdb = require('../util/gra4formatdb');

const splitPortInfo = function (inputData, outData) {
    let ports = [];
    for (let i = 0; i < inputData.length; i++) {
        const element = inputData[i];
        ports.push({
            id: 'in_' + i,
            name: element.Name,
            type: element.Type,
            value: element.Default,
            group: 'in'
        });
    }

    for (let i = 0; i < outData.length; i++) {
        const element = outData[i];
        ports.push({
            id: 'out_' + i,
            name: element.Name,
            type: element.Type,
            value: element.Default,
            group: 'out'
        });
    }
    return ports;
}

/**
 * * 要求客户gra4格式约定:
 * 1. 文件、文件夹名不能是中文
 * 2. 项目要打包成zip, 压缩包名和解压的文件夹名一致
 * 3. 主gra4要命名为main.gra4
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
                let foldername = path.basename(file.name, '.zip');
                let zip = new AdmZip(file.path);
                let xmlData = zip.readAsText(foldername + "/" + 'main.gra4');
                let xmlJson = convert.xml2json(xmlData, { compact: true, spaces: 4 });
                xmlJson = JSON.parse(xmlJson);
                let data = [];
                gra4formatdb.splitChildSys(uid, zip, foldername, data, xmlJson, 1, null, null, 1);

                // 存数据库
                let db = {
                    uid: uid,
                    data: data
                }
                let id = pomelo.app.db.genId();
                await ctx.app.assetsStub.getEntry(id, db);

                // 同步用户表, 前面已经判断用户一定在线
                let sid = ctx.userdata.sid;
                let proinfo = {
                    id: id,
                    name: data[0].name
                }
                await ctx.app.assetsStub.callAvatarRemote(uid, sid, consts.ControlType.Add, proinfo);

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
                // 解析zip json
                let foldername = path.basename(file.name, '.zip');
                let zip = new AdmZip(file.path);
                let data = zip.readAsText(foldername + "/" + foldername + '.json');
                data = JSON.parse(data.trim());
                let id = uid + '_' + foldername;

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
                let groupId = await ctx.app.assetsModelStub.callAvatarGroupInfo(uid, sid, groupName, modelInfo);

                // 存数据库
                let db = {
                    uid: uid,
                    groupId: groupId,
                    data: data
                }
                await ctx.app.assetsModelStub.getEntry(id, db);

                // zip移动
                let destPath = path.join(__dirname, '../../../assets/' + uid + '/model/');
                utils.mkdirsSync(destPath);
                destPath = destPath + foldername + '.zip';
                fs.rename(file.path, destPath, function (err) {
                    if (err) throw err;
                    fs.stat(destPath, function (err, stats) {
                        if (err) throw err;
                        console.log('stats: ' + JSON.stringify(stats));
                    });
                });

                // 回给前端数据
                modelInfo.groupId = groupId;
                ctx.body = {
                    code: 200,
                    message: '模型导入成功',
                    result: {
                        modelInfo: modelInfo
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