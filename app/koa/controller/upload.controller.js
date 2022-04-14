const fs = require('fs');
const path = require('path');
const unzip = require("unzip-stream");
const pomelo = require('pomelo');
const convert = require('xml-js');
const { fileUploadError } = require('../constant/err.type')

const xml2json = function (filepath) {
    let xml = fs.readFileSync(filepath, 'utf-8');
    let result = convert.xml2json(xml, { compact: true, spaces: 4 });
    return JSON.parse(result);
}

const getModelChildId = function (unitArray, id, sysIndex) {
    let index = 0;
    for (let i = 0; i < unitArray.length; i++) {
        const unit = unitArray[i];
        if (unit.SubBlock) {
            index++;
        }

        if (unit._attributes.id == id) {
            if (unit.SubBlock) {
                return index + sysIndex;
            } else {
                return null;
            }
        }
    }
    return null;
}

/**
 * 解析子系统
 * @param {*} sysjson 当前画板json描述
 * @param {*} id  当前画板id, 按main.gra4顺序来, 从1开始
 * @param {*} pid 当前画板关联的父画板
 * @param {*} sysIndex 当前画板id头位置, 从1开始
 */
const splitItem = function (sysjson, id, pid, sysIndex) {
    let item = {};
    item.id = id;
    item.pid = pid;
    item.name = sysjson.Model.Title._text;
    
    // 模块
    item.block = [];
    let unitArray = sysjson.Model.UnitGroup.Unit;
    for (let i = 0; i < unitArray.length; i++) {
        let model = {};
        const unit = unitArray[i];
        model.id = unit._attributes.id;
        model.child = getModelChildId(unitArray, model.id, sysIndex);
        model.name = unit.Title._attributes.name;
        model.nodeType = unit.Looking._attributes.Shape;
        model.position = {"x": Number(unit.Rect._attributes.left), "y": Number(unit.Rect._attributes.top)};
        model.size = { "width": Number(unit.Rect._attributes.width), "height": Number(unit.Rect._attributes.height) };
        model.items = [];
        const lineArray = sysjson.Model.LineGroup.Line;
        for (let n = 0; n < lineArray.length; n++) {
            const line = lineArray[n];
            if (model.id == line.Data._attributes.in || model.id == line.Data._attributes.out) {
                model.items.push({
                    id: (model.id == line.Data._attributes.in) ? 'out_' + line.Data._attributes.inport : 'in_' + line.Data._attributes.export,
                    group: (model.id == line.Data._attributes.in) ? 'out' : 'in'
                });
            }
        }
        item.block.push(model);
    }

    // 连线
    item.line = [];
    const lineArray = sysjson.Model.LineGroup.Line;
    for (let i = 0; i < lineArray.length; i++) {
        const line = lineArray[i];
        item.line.push({
            id: pomelo.app.db.genId(),
            lineType: line.Data._attributes.dim > 1 ? 2 : 1,
            source: {
                "cell": line.Data._attributes.in,
                "port": 'out_' + line.Data._attributes.inport
            },
            target: {
                "cell": line.Data._attributes.out,
                "port": 'in_' + line.Data._attributes.export
            },
            subline: subline
        });
    }

    return item;
}

/**
 * 递归拆子系统
 * @param {*} rootPath 项目根目录
 * @param {*} sysArray 子系统数组容器
 * @param {*} sysJson  子系统json描述
 * @param {*} sysId    子系统ID
 * @param {*} sysPid   子系统父ID
 * @param {*} sysCpid   子系统在其父系统中的ID
 * @param {*} sysIndex 当前层系统头位置(为了定义子系统ID, ID为顺序递增, 所以要记录每层ID的头位置)
 */
const splitChildSys = function (rootPath, sysArray, sysJson, sysId, sysPid, sysCpid, sysIndex) {
    // 当前层系统解析
    let item = splitItem(sysJson, sysId, sysPid, sysIndex);
    // 插入子系统中转器件
    if (sysCpid) {
        
    }
    sysArray.push(item);

    // 记录当前层子系统
    let childSys = [];
    let units = sysJson.Model.UnitGroup.Unit;
    for (let i = 0; i < units.length; i++) {
        const element = units[i];
        if (element.SubBlock) {
            childSys.push(element);
        }
    }

    let curSysId = sysId;
    sysIndex = sysIndex + childSys.length;
    for (let i = 0; i < childSys.length; i++) {
        const item = childSys[i];
        let filepath = rootPath + '\\' + item.SubBlock._attributes.File;
        let childjson = xml2json(filepath);
        let id = ++sysId;
        let pid = curSysId;
        let cpid = item._attributes.id;
        splitChildSys(rootPath, sysArray, childjson, id, pid, cpid, sysIndex);
    }
}

// TODO: 组合线详细信息gra4文件没有描述，进行不下去(需要用户提供中转器的描述)
const splitInOut = function (sysArray, item, sysJson) {
    // 输入、输出模块
    let parentSys = sysArray[item.pid - 1];
    let inCount = 0;
    let outCount = 0;
    for (let i = 0; i < parentSys.line.length; i++) {
        const element = parentSys.line[i];
        if (element.target.cell == sysCpid) {
            inCount++;
        }
        if (element.source.cell == sysCpid) {
            outCount++;
        }
    }

    // 中转器模块
    let inRouteCount = 0;
    let outRouteCount = 0;
    let inRouteID = sysJson.Model.IoportGroup.Ioport[0]._attributes.id;
    let outRouteID = sysJson.Model.IoportGroup.Ioport[1]._attributes.id;
    for (let i = 0; i < item.line.length; i++) {
        const element = item.line[i];
        if (element.source.cell == inRouteID) {
            inRouteCount++;
        }
        if (element.target.cell == outRouteID) {
            outRouteCount++;
        }
    }

    if (inCount > inRouteCount) {
        console.warn('解析gra4格式错误!');
    }

    // 把inRouteCount分成inCount组
    let inputModel = {};
    inputModel.items = [];
    for (let i = 0; i < parentSys.line.length; i++) {
        const element = parentSys.line[i];
        if (element.target.cell == sysCpid) {
            inputModel.items.push({id: "0", group: "in"});
        }
    }


    item.block.push();

    // 连线
}

/**
 * 要求客户gra4格式约定:
 * 1. 文件、文件夹名不能是中文
 * 2. 项目要打包成zip, 压缩包名和解压的文件夹名一致
 * 3. 主gra4要命名为main.gra4
 * @param {*} rootpath 用户上传项目根目录路径
 * @returns 
 */
const parseXml2DB = function (rootpath) {
    let filepath = rootpath + '\\main.gra4';
    let mainjson = xml2json(filepath);
    let data = [];
    splitChildSys(rootpath, data, mainjson, 1, null, null, 1);
    return data;
}

class UploadController {
    async importProject(ctx, next) {
        const { uid } = ctx.request.body;
        const { file } = ctx.request.files   // 上传的文件key
        // let fileTypes = ['image/png', 'image/jpeg']
        if (file && file.size > 0) {
            console.log('[%s]上传文件: %s 路径: %s', uid, file.name, file.path);
            try {
                // 解压
                let dirpath = path.dirname(file.path);
                fs.createReadStream(file.path).pipe(unzip.Extract({ path: dirpath}));

                // 读取解析
                let foldername = path.basename(file.name, '.zip');
                let rootpath = dirpath + '\\' + foldername;
                let data = parseXml2DB(rootpath);
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
                await ctx.app.assetsStub.callAvatarRemote(uid, sid, 1, proinfo);

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
}

module.exports = new UploadController()