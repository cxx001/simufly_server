const pomelo = require('pomelo');
const path = require('path');
const convert = require('xml-js');
const consts = require('../../common/consts');

var pro = module.exports;

/**
 * 获取子系统模型的子画板ID
 * TODO: 如果嵌套层级很复杂关系是否能对应正确还没测试! 如果有问题, 可以直接改成生成唯一字符串key, 手动一个个指定, 这样比顺序递增逻辑更清晰.
 * @param {*} unitArray 当前面板所有模型数组(gra4对象)
 * @param {*} id 模型ID
 * @param {*} sysIndex 当前画板ID (画板ID从1开始, 按gra4文件读取顺序依次+1)
 * @returns 
 */
pro.getModelChildId = function (unitArray, id, sysIndex) {
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
 * 线是否连有子系统.
 * 当前逻辑规则如果粗线都是连的最小模型，那么把粗线连接关系都在当前模型展开，
 * 如果连有子系统，那么当前还是显示粗线，详情在子系统面板体现 TODO: 这种逻辑是否有问题？
 * @param {*} unitArray 当前面板所有模型数组(gra4对象)
 * @param {*} sid 线头模型ID
 * @param {*} tid 线尾模型ID
 * @returns 
 */
pro.isSimpleModelLine = function (unitArray, sid, tid) {
    for (let i = 0; i < unitArray.length; i++) {
        const unit = unitArray[i];
        if (unit._attributes.id == sid || unit._attributes.id == tid) {
            if (unit.SubBlock) {
                return false;
            }
        }
    }
    return true;
}
    
/**
 * 解析子系统
 * @param {*} uid 用户UID
 * @param {*} sysjson 当前画板json描述
 * @param {*} id  当前画板id, 按main.gra4顺序来, 从1开始
 * @param {*} pid 当前画板关联的父画板
 * @param {*} sysIndex 当前画板id头位置, 从1开始
 */
pro.splitItem = function (uid, sysjson, id, pid, sysIndex) {
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
        model.child = this.getModelChildId(unitArray, model.id, sysIndex);
        model.name = unit.Title._attributes.name;
        model.nodeType = Number(unit.Looking._attributes.Shape);
        model.position = { "x": Number(unit.Rect._attributes.left), "y": Number(unit.Rect._attributes.top) };
        model.size = { "width": Number(unit.Rect._attributes.width), "height": Number(unit.Rect._attributes.height) };

        // 关联数字模型ID
        if (unit.UserFct) {
            let dllFile = unit.UserFct._attributes.Dllfile;
            let fctName = unit.UserFct._attributes.Fctname;
            dllFile = path.basename(dllFile, '.dll');
            model.modelId = uid + '_' + dllFile + '_' + fctName;
        }

        model.items = [];
        const lineArray = sysjson.Model.LineGroup.Line;
        for (let n = 0; n < lineArray.length; n++) {
            const line = lineArray[n];
            if (model.id == line.Data._attributes.in || model.id == line.Data._attributes.out) {
                // 模块与模块之间连线的粗线都平铺,只有带子系统之间连线有粗线
                if (line.SubLine && this.isSimpleModelLine(unitArray, line.Data._attributes.in, line.Data._attributes.out)) {
                    model.items.push({
                        id: (model.id == line.Data._attributes.in) ? consts.OutPrefix + line.Data._attributes.inport : consts.InPrefix + line.Data._attributes.export,
                        group: (model.id == line.Data._attributes.in) ? consts.OutFlag : consts.InFlag
                    });
                    for (let m = 0; m < Number(line.SubLine._attributes.Count); m++) {
                        const element = line.SubLine['line' + m];
                        model.items.push({
                            id: (model.id == element._attributes.in) ? consts.OutPrefix + element._attributes.inport : consts.InPrefix + element._attributes.export,
                            group: (model.id == element._attributes.in) ? consts.OutFlag : consts.InFlag
                        });
                    }
                } else {
                    model.items.push({
                        id: (model.id == line.Data._attributes.in) ? consts.OutPrefix + line.Data._attributes.inport : consts.InPrefix + line.Data._attributes.export,
                        group: (model.id == line.Data._attributes.in) ? consts.OutFlag : consts.InFlag
                    });
                }
            }
        }

        // 去重
        let result = [];
        let obj = {};
        for (let i = 0; i < model.items.length; i++) {
            let key = model.items[i].id + '_' + model.items[i].group;
            if (!obj[key]) {
                result.push(model.items[i]);
                obj[key] = true;
            }
        }
        model.items = result;
        item.block.push(model);
    }

    // 连线
    item.line = [];
    const lineArray = sysjson.Model.LineGroup.Line;
    for (let i = 0; i < lineArray.length; i++) {
        const line = lineArray[i];
        let subLine = [];   // 粗线详情
        // dim顺序递增类型
        let dim = line.Data._attributes.dim;
        if (dim > 1) {
            for (let j = 0; j < dim; j++) {
                let outPort = Number(line.Data._attributes.inport) + j;
                let inPort = Number(line.Data._attributes.export) + j;
                subLine.push({
                    source: { "cell": line.Data._attributes.in, "port": consts.OutPrefix + outPort },
                    target: { "cell": line.Data._attributes.out, "port": consts.InPrefix + inPort }
                })
            }
        }
        // SubLine无序类型
        let childLines = line.SubLine;
        if (childLines) {
            // 用户的Subline是从第二条线开始, 默认Data里是第一条，而且dim=1.
            subLine.push({
                source: { "cell": line.Data._attributes.in, "port": consts.OutPrefix + line.Data._attributes.inport },
                target: { "cell": line.Data._attributes.out, "port": consts.InPrefix + line.Data._attributes.export }
            })

            for (let i = 0; i < Number(childLines._attributes.Count); i++) {
                const childLine = childLines['line' + i];
                subLine.push({
                    source: { "cell": childLine._attributes.in, "port": consts.OutPrefix + childLine._attributes.inport },
                    target: { "cell": childLine._attributes.out, "port": consts.InPrefix + childLine._attributes.export }
                })
            }
        }

        // 
        if (subLine.length > 0 && this.isSimpleModelLine(unitArray, line.Data._attributes.in, line.Data._attributes.out)) {
            for (let i = 0; i < subLine.length; i++) {
                const cline = subLine[i];
                item.line.push({
                    id: pomelo.app.db.genId(),
                    lineType: line.Data._attributes.dim > 1 ? 2 : 1,
                    source: cline.source,
                    target: cline.target,
                    subLine: [],
                });
            }
        } else {
            item.line.push({
                id: pomelo.app.db.genId(),
                lineType: line.Data._attributes.dim > 1 ? 2 : 1,
                source: {
                    "cell": line.Data._attributes.in,
                    "port": consts.OutPrefix + line.Data._attributes.inport
                },
                target: {
                    "cell": line.Data._attributes.out,
                    "port": consts.InPrefix + line.Data._attributes.export
                },
                subLine: subLine,
            });
        }
    }

    return item;
}

/**
 * 
 * @param {*} sortData 带分组的线, 按是否是一对多/多对多端口分类
 * @param {*} inORout 输入/输出
 * @param {*} childPanel 子系统db结构
 * @param {*} cIOModel IO模块gra4结构
 * @returns 
 */
pro._oneMoreSpecialCass = function (sortData, inORout, childPanel, cIOModel) {
    const groupBy = (array, f) => {
        let groups = {};
        array.forEach((o) => {
            let group = JSON.stringify(f(o));
            groups[group] = groups[group] || [];
            groups[group].push(o);
        });
        return Object.keys(groups).map((group) => {
            return groups[group];
        });
    };
    const sorted = groupBy(sortData, (item) => {
        if (inORout == 1) {
            return item.Data._attributes.in + '_' + item.Data._attributes.inport;
        } else {
            return item.Data._attributes.out + '_' + item.Data._attributes.export;
        }
    });

    let oneMoreArray = [];
    let recordArray = [];
    for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        if (item.length > 1) {
            oneMoreArray.push(item);
        } else {
            recordArray.push(item[0]);
        }
    }

    if (inORout == 1) {
        for (let i = 0; i < oneMoreArray.length; i++) {
            const items = oneMoreArray[i];
            const line = items[0];
            // 添加输入模块
            let inputId = pomelo.app.db.genId();
            childPanel.block.push({
                id: inputId,
                name: "输入",
                nodeType: consts.ShapeType.IO,
                position: { "x": Number(cIOModel.Rect._attributes.left) - 50, "y": Number(cIOModel.Rect._attributes.top) - 40 + i * 30 },
                size: { "width": 40, "height": 20 },
                items: [{ "id": consts.OutPrefix + line.Data._attributes.inport, "group": consts.OutFlag }],
            })

            // 连线关联
            for (let n = 0; n < childPanel.line.length; n++) {
                let childLine = childPanel.line[n];
                if (childLine.source.cell == line.Data._attributes.in && (childLine.source.port == (consts.OutPrefix + line.Data._attributes.inport))) {
                    childLine.source.cell = inputId;
                }
            }
        }
    } else {
        for (let i = 0; i < oneMoreArray.length; i++) {
            const items = oneMoreArray[i];
            const line = items[0][0];
            // 添加输出模块
            let outputId = pomelo.app.db.genId();
            childPanel.block.push({
                id: outputId,
                name: "输出",
                nodeType: consts.ShapeType.IO,
                position: { "x": Number(cIOModel.Rect._attributes.left) + 50, "y": Number(cIOModel.Rect._attributes.top) - 40 + i * 30 },
                size: { "width": 40, "height": 20 },
                items: [{ "id": consts.InPrefix + line.Data._attributes.export, "group": consts.InFlag }],
            })

            // 连线关联
            for (let n = 0; n < childPanel.line.length; n++) {
                let childLine = childPanel.line[n];
                if (childLine.target.cell == line.Data._attributes.out && (childLine.target.port == (consts.InPrefix + line.Data._attributes.export))) {
                    childLine.target.cell = outputId;
                }
            }
        }
    }
    return recordArray;
};

/**
 * 
 * @param {*} pIOArray 父节点输入/输出连线数组
 * @param {*} cIOModel 子系统中IO模块gra4 json结构
 * @param {*} inORout 输入还是输出 1 输入 2 输出
 * @param {*} cLineArray 子系统中连线数组(gra4 json结构)
 * @param {*} childPanel 子系统面板(db结构)
 */
pro._splitInterface = function (pIOArray, cIOModel, inORout, cLineArray, childPanel) {
    for (let i = 0; i < pIOArray.length; i++) {
        const line = pIOArray[i];
        // 记录相关线
        let ioID = cIOModel._attributes.id;
        let record = [];
        if (line.subLine.length <= 1) {
            // 细线
            let ioPort = null;
            if (inORout == 1) {
                ioPort = line.target.port;
                for (let j = 0; j < cLineArray.length; j++) {
                    const item = cLineArray[j];
                    if (item.Data._attributes.in == ioID && ((consts.InPrefix + item.Data._attributes.inport) == ioPort)) {
                        record.push(item);
                    }
                }
            } else {
                ioPort = line.source.port;
                for (let j = 0; j < cLineArray.length; j++) {
                    const item = cLineArray[j];
                    if (item.Data._attributes.out == ioID && ((consts.OutPrefix + item.Data._attributes.export) == ioPort)) {
                        record.push(item);
                    }
                }
            }
        } else {
            // 粗线
            for (let m = 0; m < line.subLine.length; m++) {
                const cLine = line.subLine[m];
                let ioPort = null;
                if (inORout == 1) {
                    ioPort = cLine.target.port;
                    for (let n = 0; n < cLineArray.length; n++) {
                        const item = cLineArray[n];
                        if (item.Data._attributes.in == ioID && ((consts.InPrefix + item.Data._attributes.inport) == ioPort)) {
                            record.push(item);
                            break;
                        }
                    }
                } else {
                    ioPort = cLine.source.port;
                    for (let n = 0; n < cLineArray.length; n++) {
                        const item = cLineArray[n];
                        if (item.Data._attributes.out == ioID && ((consts.OutPrefix + item.Data._attributes.export) == ioPort)) {
                            record.push(item);
                            break;
                        }
                    }
                }
            }
        }

        // 一个模块的输出连多个模块的输入或多个模块输出给一个模块输入情况
        record = this._oneMoreSpecialCass(record, inORout, childPanel, cIOModel);
        if (record.length == 0) {
            continue;
        }

        // > 1才创建总线, 否则只需要输入/输出模块
        if (record.length > 1) {
            let blockId = pomelo.app.db.genId();
            // 总线端口信息
            let ports = [];
            for (let z = 0; z < record.length; z++) {
                const element = record[z];
                ports.push({
                    id: inORout == 1 ? (consts.OutPrefix + element.Data._attributes.inport) : (consts.InPrefix + element.Data._attributes.export),
                    group: inORout == 1 ? consts.OutFlag : consts.InFlag
                });

                // 总线替换用户IO模块, 修改原连线关联ID
                for (let n = 0; n < childPanel.line.length; n++) {
                    let childLine = childPanel.line[n];
                    if (inORout == 1) {
                        if (childLine.source.cell == ioID && (childLine.source.port == (consts.OutPrefix + element.Data._attributes.inport))) {
                            childLine.source.cell = blockId;
                        }
                    } else {
                        if (childLine.target.cell == ioID && (childLine.target.port == (consts.InPrefix + element.Data._attributes.export))) {
                            childLine.target.cell = blockId;
                        }
                    }
                }
            }
            if (inORout == 1) {
                ports.push({ id: consts.InPrefix + 0, group: consts.InFlag });

                // 添加输入总线模块
                childPanel.block.push({
                    id: blockId,
                    name: "一对多总线",
                    nodeType: consts.ShapeType.OneMore,
                    position: { "x": Number(cIOModel.Rect._attributes.left), "y": Number(cIOModel.Rect._attributes.top) },
                    size: { "width": 20, "height": 80 },
                    items: ports,
                });

                // 添加输入模块
                let inputId = pomelo.app.db.genId();
                childPanel.block.push({
                    id: inputId,
                    name: "输入",
                    nodeType: consts.ShapeType.IO,
                    position: { "x": Number(cIOModel.Rect._attributes.left) - 50, "y": Number(cIOModel.Rect._attributes.top) - 40 + i * 30 },
                    size: { "width": 40, "height": 20 },
                    items: [{ "id": consts.OutPrefix + "0", "group": consts.OutFlag }],
                })
                childPanel.line.push({
                    id: pomelo.app.db.genId(),
                    lineType: 1,
                    source: { "cell": inputId, "port": consts.OutPrefix + "0" },
                    target: { "cell": blockId, "port": consts.InFlag + "0" },
                });
            } else {
                ports.push({ id: consts.OutPrefix + 0, group: consts.OutFlag });
                // 输出总线
                childPanel.block.push({
                    id: blockId,
                    name: "多对一总线",
                    nodeType: consts.ShapeType.MoreOne,
                    position: { "x": Number(cIOModel.Rect._attributes.left), "y": Number(cIOModel.Rect._attributes.top) },
                    size: { "width": 20, "height": 80 },
                    items: ports,
                });
                // 输出模块
                let outputId = pomelo.app.db.genId();
                childPanel.block.push({
                    id: outputId,
                    name: "输出",
                    nodeType: consts.ShapeType.IO,
                    position: { "x": Number(cIOModel.Rect._attributes.left) + 50, "y": Number(cIOModel.Rect._attributes.top) - 40 + i * 30 },
                    size: { "width": 40, "height": 20 },
                    items: [{ "id": consts.InPrefix + "0", "group": consts.InFlag }],
                })
                childPanel.line.push({
                    id: pomelo.app.db.genId(),
                    lineType: 1,
                    source: { "cell": blockId, "port": consts.OutPrefix + "0" },
                    target: { "cell": outputId, "port": consts.InPrefix + "0" },
                });
            }
        } else {
            if (inORout == 1) {
                // 添加输入模块
                let inputId = pomelo.app.db.genId();
                childPanel.block.push({
                    id: inputId,
                    name: "输入",
                    nodeType: consts.ShapeType.IO,
                    position: { "x": Number(cIOModel.Rect._attributes.left) - 50, "y": Number(cIOModel.Rect._attributes.top) - 40 + i * 30 },
                    size: { "width": 40, "height": 20 },
                    items: [{ "id": consts.OutPrefix + "0", "group": consts.OutFlag }],
                })
                childPanel.line.push({
                    id: pomelo.app.db.genId(),
                    lineType: 1,
                    source: { "cell": inputId, "port": consts.OutPrefix + "0" },
                    target: { "cell": record[0].Data._attributes.out, "port": consts.InPrefix + record[0].Data._attributes.export },
                });
            } else {
                // 添加输出模块
                let outputId = pomelo.app.db.genId();
                childPanel.block.push({
                    id: outputId,
                    name: "输出",
                    nodeType: consts.ShapeType.IO,
                    position: { "x": Number(cIOModel.Rect._attributes.left) + 50, "y": Number(cIOModel.Rect._attributes.top) - 40 + i * 30 },
                    size: { "width": 40, "height": 20 },
                    items: [{ "id": InPrefix + "0", "group": consts.InFlag }],
                })
                childPanel.line.push({
                    id: pomelo.app.db.genId(),
                    lineType: 1,
                    source: { "cell": record[0].Data._attributes.in, "port": consts.OutPrefix + record[0].Data._attributes.export },
                    target: { "cell": outputId, "port": consts.InPrefix + "0" },
                });
            }
        }
    }
}

/**
 * 
 * @param {*} parentPanel 父节点面板 db格式
 * @param {*} childjson 子系统面板gra4 json格式
 * @param {*} childPanel 子系统面板 db格式
 * @param {*} sysCpid  子系统在其父系统中的ID
 * @returns 
 */
pro.splitInterfaceModel = function (parentPanel, childjson, childPanel, sysCpid) {
    let inputArray = [];
    let outputArray = [];
    for (let i = 0; i < parentPanel.line.length; i++) {
        const line = parentPanel.line[i];
        if (line.target.cell == sysCpid) {
            inputArray.push(line);
        }
        if (line.source.cell == sysCpid) {
            outputArray.push(line);
        }
    }

    // 当前认为输入/输出模块只有一个
    const ioArray = childjson.Model.IoportGroup.Ioport;
    const lineArray = childjson.Model.LineGroup.Line;
    if (ioArray.length > 2) {
        console.error('非标准的gra4格式!');
        return;
    }

    let inputIO = ioArray[0];
    let outputIO = ioArray[1];
    this._splitInterface(inputArray, inputIO, 1, lineArray, childPanel);
    this._splitInterface(outputArray, outputIO, 2, lineArray, childPanel);
}

/**
 * 递归拆子系统
 * @param {*} uid 用户UID
 * @param {*} admZip admzip解包对象
 * @param {*} rootPath 项目根目录
 * @param {*} sysArray 子系统数组容器
 * @param {*} sysJson  子系统json描述
 * @param {*} sysId    面板ID
 * @param {*} sysPid   子系统父ID
 * @param {*} sysCpid   子系统在其父系统中的ID
 * @param {*} sysIndex 当前层系统头位置(为了定义子系统ID, ID为顺序递增, 所以要记录每层ID的头位置)
 */
pro.splitChildSys = function (uid, admZip, rootPath, sysArray, sysJson, sysId, sysPid, sysCpid, sysIndex) {
    // 当前层系统解析
    let item = this.splitItem(uid, sysJson, sysId, sysPid, sysIndex);
    // 插入子系统中转器件
    if (sysCpid) {
        let parentPanel = null;
        for (let i = 0; i < sysArray.length; i++) {
            let element = sysArray[i];
            if (element.id == sysPid) {
                parentPanel = element;
            }
        }
        this.splitInterfaceModel(parentPanel, sysJson, item, sysCpid);
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
        let childPath = item.SubBlock._attributes.File.replace(/\\/g, "/");
        let xmlData = admZip.readAsText(rootPath + "/" + childPath);
        let xmlJson = convert.xml2json(xmlData, { compact: true, spaces: 4 });
        xmlJson = JSON.parse(xmlJson);
        let id = ++sysId;
        let pid = curSysId;
        let cpid = item._attributes.id;
        this.splitChildSys(uid, admZip, rootPath, sysArray, xmlJson, id, pid, cpid, sysIndex);
    }
}
