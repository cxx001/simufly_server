const pomelo = require('pomelo');
const path = require('path');
const logger = require('pomelo-logger').getLogger('cskl', '__filename');
const consts = require('../../common/consts');

let IoCount = 0;
let TransCount = 0;

var pro = module.exports;

/**
 * 获取数字模型导入时关联的key
 * @param {*} uid 
 * @param {*} entry 当前模型gra4-json描述 
 * @returns 
 */
pro.getImportModelId = function (uid, entry) {
    if (entry.UserFct) {
        let dllFile = entry.UserFct._attributes.Dllfile;
        dllFile = path.normalize(dllFile);
        dllFile = path.basename(dllFile, '.dll');
        dllFile = dllFile.split('\\');
        dllFile = dllFile[dllFile.length-1];
        let fctName = entry.UserFct._attributes.Fctname;
        let key = `${uid}_${dllFile}_${fctName}`;
        return key;
    }
    return null;
}

/**
 * 粗线情况:
 * 1. 模块-模块, 子系统-模块, 模块-子系统
 *  直接平铺
 * 
 * 2. 子系统-子系统
 * 子系统里边添加总线, 外部还是粗线
 * 
 * 解析模型端口
 */
pro.parseModelPort = function (modelId, lineArray, unitArray) {
    let ports = [];
    for (let i = 0; i < lineArray.length; i++) {
        const item = lineArray[i];
        const inId = item.Data._attributes.in;
        const outId = item.Data._attributes.out;
        if (modelId == inId || modelId == outId) {
            const model_in = this.getModelGra4Info(inId, unitArray);
            const model_out = this.getModelGra4Info(outId, unitArray);
            if (!(model_in && model_out)) {
                // 信号记录监控模块或IO模块
                continue;
            }

            let subLines = this.getBoldLineDetails(item);
            if (subLines.length == 0) {
                logger.error('gra4 模块线描述格式错误!');
                return;
            }

            if (this.isLineTiled(subLines, model_in, model_out)) {
                for (let j = 0; j < subLines.length; j++) {
                    const line = subLines[j];
                    ports.push({
                        id: (modelId == line.source.cell) ? line.source.port : line.target.port,
                        group: (modelId == line.source.cell) ? consts.OutFlag : consts.InFlag
                    });
                }
            } else {
                ports.push({
                    id: (modelId == inId) ? `${consts.OutPrefix}${item.Data._attributes.inport}` : `${consts.InPrefix}${item.Data._attributes.export}`,
                    group: (modelId == inId) ? consts.OutFlag : consts.InFlag
                });
            }
        }
    }

    // 去重
    let result = [];
    let obj = {};
    for (let i = 0; i < ports.length; i++) {
        let key = ports[i].id + '_' + ports[i].group;
        if (!obj[key]) {
            result.push(ports[i]);
            obj[key] = true;
        }
    }
    return result;
}

/**
 * 线是否需要展开
 * @param {*} subLine 线的详情
 * @param {*} inUnit 线输入端模块
 * @param {*} outUnit 线输出端模块
 * @returns 
 */
pro.isLineTiled = function (subLine, inUnit, outUnit) {
    if (subLine.length <= 1) {
        // 细线
        return true;
    } else {
        // 粗线
        if (inUnit.SubBlock && outUnit.SubBlock) {
            // 子系统与子系统连接
           return false;
        } else {
            return true;
        }
    }
}

/**
 * 获取模块gra4描述对象
 * @param {*} modelId 模块ID
 * @param {*} unitArray 模块所在面板所有模块数组
 * @returns 
 */
pro.getModelGra4Info = function (modelId, unitArray) {
    for (let i = 0; i < unitArray.length; i++) {
        const unit = unitArray[i];
        if (unit._attributes.id == modelId) {
            return unit;
        }
    }
    return null;
}

/**
 * 展开连线内部详情
 * @param {*} line 
 */
pro.getBoldLineDetails = function (line) {
    let subLine = [];   // 粗线详情
    // dim顺序递增类型
    let dim = line.Data._attributes.dim;
    for (let i = 0; i < dim; i++) {
        let inPort = Number(line.Data._attributes.inport) + i;
        let outPort = Number(line.Data._attributes.export) + i;
        subLine.push({
            source: { "cell": line.Data._attributes.in, "port": `${consts.OutPrefix}${inPort}`},
            target: { "cell": line.Data._attributes.out, "port": `${consts.InPrefix}${outPort}`}
        })
    }

    // SubLine无序类型
    let childLines = line.SubLine;
    if (childLines) {
        for (let i = 0; i < Number(childLines._attributes.Count); i++) {
            const childLine = childLines['line' + i];
            const childDim = Number(childLine._attributes.dim);
            for (let j = 0; j < childDim; j++) {
                let inPort = Number(childLine._attributes.inport) + j;
                let outPort = Number(childLine._attributes.export) + j;
                subLine.push({
                    source: { "cell": childLine._attributes.in, "port": `${consts.OutPrefix}${inPort}` },
                    target: { "cell": childLine._attributes.out, "port": `${consts.InPrefix}${outPort}` }
                })
            }
        }
    }

    return subLine;
}

/**
 * 解析子系统
 * @param {*} uid 用户UID
 * @param {*} sysjson 当前画板json描述
 * @param {*} panelId  当前画板id, 按main.gra4顺序来, 从1开始
 * @param {*} pid 当前画板关联的父画板ID
 */
pro.splitItem = function (uid, sysjson, panelId, pid) {
    let item = {};
    item.id = panelId;
    item.pid = pid;
    item.name = sysjson.Model.Title._text;

    // 模块
    item.block = [];
    const lineArray = sysjson.Model.LineGroup.Line;
    const unitCount = sysjson.Model.UnitGroup._attributes.Count;
    let unitArray = sysjson.Model.UnitGroup.Unit;
    if (unitCount == 1) {
        let array = [];
        array.push(unitArray);
        unitArray = array;
        console.warn('数量为1时xml解析出来不是数组!', sysjson.Model.Title);
    }
    for (let i = 0; i < unitArray.length; i++) {
        let model = {};
        const unit = unitArray[i];
        model.id = unit._attributes.id;
        if (unit.SubBlock) {
            model.child = pomelo.app.db.genId();
        }
        model.name = unit.Title._attributes.name;
        model.nodeType = Number(unit.Looking._attributes.Shape);
        model.position = { "x": Number(unit.Rect._attributes.left), "y": Number(unit.Rect._attributes.top) };
        model.size = { "width": Number(unit.Rect._attributes.width), "height": Number(unit.Rect._attributes.height) };
        model.modelId = this.getImportModelId(uid, unit);
        model.items = this.parseModelPort(model.id, lineArray, unitArray);
        item.block.push(model);
    }

    // 连线
    item.line = [];
    for (let i = 0; i < lineArray.length; i++) {
        const line = lineArray[i];
        const subLine = this.getBoldLineDetails(line);
        const model_in = this.getModelGra4Info(line.Data._attributes.in, unitArray);
        const model_out = this.getModelGra4Info(line.Data._attributes.out, unitArray);
        if (!(model_in && model_out)) {
            // 信号记录监控模块或IO模块
            continue;
        }

        if (this.isLineTiled(subLine, model_in, model_out)) {
            for (let i = 0; i < subLine.length; i++) {
                const child_line = subLine[i];
                item.line.push({
                    id: pomelo.app.db.genId(),
                    lineType: line.Data._attributes.dim > 1 ? 2 : 1,
                    source: child_line.source,
                    target: child_line.target,
                    subLine: [],
                });
            }
        } else {
            item.line.push({
                id: pomelo.app.db.genId(),
                lineType: line.Data._attributes.dim > 1 ? 2 : 1,
                source: {
                    "cell": line.Data._attributes.in,
                    "port": `${consts.OutPrefix}${line.Data._attributes.inport}`
                },
                target: {
                    "cell": line.Data._attributes.out,
                    "port": `${consts.InPrefix}${line.Data._attributes.export}`
                },
                subLine: subLine,
            });
        }
    }

    return item;
}

pro.findIOModel = function (isInput, cIoArray) {
    for (let i = 0; i < cIoArray.length; i++) {
        const item = cIoArray[i];
        if (isInput) {
            const ydim = Number(item.Dim._attributes.ydim);
            if (ydim > 0) {
                return item;
            }
        } else {
            const udim = Number(item.Dim._attributes.udim);
            if (udim > 0) {
                return item;
            }
        }
    }
}

/**
 * 创建输入/输出相关接口模型
 * @param {*} parentJson 父面板gra4
 * @param {*} childjson 子面板gra4
 * @param {*} sysCpid 子面板在其父面板中的ID
 * @param {*} childPanel 子面板DB
 * @returns 
 */
pro.splitInterfaceModel = function (parentJson, childjson, sysCpid, childPanel) {
    /**
     * 1. 由于子系统内部输入/输出端口与其在父面板中的输入/输出肯定一致。
     *    因此从父面板中找出子系统模块相关连线开始遍历。
     * 
     * 2. 在子系统内部找出所有与外部端口一致的相关连线, 注意内部多个同类IO模块端口按顺序递增。
     * 3. 最后根据相关连线创建输入/输出/总线模块(外部subLine>1)
     * 
     */

    IoCount = 0;
    TransCount = 0;
    const pUnitArray = parentJson.Model.UnitGroup.Unit;
    const pLineArray = parentJson.Model.LineGroup.Line;
    const cIoArray = childjson.Model.IoportGroup.Ioport;
    const cLineArray = childjson.Model.LineGroup.Line;
    for (let i = 0; i < pLineArray.length; i++) {
        const pLine = pLineArray[i];
        if (pLine.Data._attributes.in == sysCpid || pLine.Data._attributes.out == sysCpid) {
            // 外部这根线是否展开
            const pSubLine = this.getBoldLineDetails(pLine);
            const model_in = this.getModelGra4Info(pLine.Data._attributes.in, pUnitArray);
            const model_out = this.getModelGra4Info(pLine.Data._attributes.out, pUnitArray);
            if (!(model_in && model_out)) {
                // 信号记录监控模块或IO模块
                continue;
            }
            const isInput = (pLine.Data._attributes.out == sysCpid) ? true : false;
            const cIoItem = this.findIOModel(isInput, cIoArray);
            const relArray = this.findRelIOLine(isInput, cIoArray, cLineArray);
            const record = this.findRelOutLine(isInput, pSubLine, relArray);
            if (this.isLineTiled(pSubLine, model_in, model_out)) {
                for (let j = 0; j < record.length; j++) {
                    const items = record[j];
                    this.createIOModel(isInput, items, cIoItem, childPanel);
                }
            } else {
                this.createTransferModel(isInput, record, cIoItem, childPanel, pSubLine);
            }
        }
    }
}

/**
 * 创建中转器模块
 * @param {*} isInput 是否是输入
 * @param {*} record 子系统内部所有与外边某条线相关连的线
 * @param {*} cIoItem 子系统内部IO模块
 * @param {*} childPanel 子系统DB格式
 * @param {*} outLine 外边对应的线
 */
pro.createTransferModel = function(isInput, record, cIoItem, childPanel, outLine) {
    if (isInput) {
        // 创建总线
        let blockId = pomelo.app.db.genId();
        let ports = [];
        ports.push({ id: `${consts.InPrefix}0`, group: consts.InFlag });
        for (let i = 0; i < record.length; i++) {
            const items = record[i];
            if (items.length > 1) {
                this.createIOModel(isInput, items, cIoItem, childPanel);
            } else {
                ports.push({ id: items[0].source.port, group: consts.OutFlag });
                childPanel.line.push({
                    id: pomelo.app.db.genId(),
                    lineType: 1,
                    source: { "cell": blockId, "port": items[0].source.port },
                    target: { "cell": items[0].target.cell, "port": items[0].target.port },
                });
            }
        }

        childPanel.block.push({
            id: blockId,
            name: "一对多总线",
            nodeType: consts.ShapeType.OneMore,
            position: { "x": Number(cIoItem.Rect._attributes.left), "y": Number(cIoItem.Rect._attributes.top) - 50 + TransCount * 90 },
            size: { "width": 20, "height": 80 },
            items: ports,
        });
        TransCount++;

        // 创建IO模块
        let inputId = `${pomelo.app.db.genId()}_${outLine[0].target.port}`;
        childPanel.block.push({
            id: inputId,
            name: "输入",
            nodeType: consts.ShapeType.Input,
            position: { "x": Number(cIoItem.Rect._attributes.left) - 50, "y": Number(cIoItem.Rect._attributes.top) - 40 + IoCount * 30 },
            size: { "width": 40, "height": 20 },
            items: [{ "id": consts.OutPrefix + "0", "group": consts.OutFlag }],
        })
        childPanel.line.push({
            id: pomelo.app.db.genId(),
            lineType: 1,
            source: { "cell": inputId, "port": consts.OutPrefix + "0" },
            target: { "cell": blockId, "port": consts.InPrefix + "0" },
        });
        IoCount++;
    } else {
        // 创建总线
        let blockId = pomelo.app.db.genId();
        let ports = [];
        ports.push({ id: `${consts.OutPrefix}0`, group: consts.OutFlag });
        for (let i = 0; i < record.length; i++) {
            const items = record[i];
            if (items.length > 1) {
                this.createIOModel(isInput, items, cIoItem, childPanel);
            } else {
                ports.push({ id: items[0].target.port, group: consts.InFlag });
                childPanel.line.push({
                    id: pomelo.app.db.genId(),
                    lineType: 1,
                    source: { "cell": items[0].source.cell, "port": items[0].source.port },
                    target: { "cell": blockId, "port": items[0].target.port },
                });
            }
        }

        childPanel.block.push({
            id: blockId,
            name: "多对一总线",
            nodeType: consts.ShapeType.MoreOne,
            position: { "x": Number(cIoItem.Rect._attributes.left), "y": Number(cIoItem.Rect._attributes.top) - 50 + TransCount * 90 },
            size: { "width": 20, "height": 80 },
            items: ports,
        });
        TransCount++;

        // 创建IO模块
        let outputId = `${pomelo.app.db.genId()}_${outLine[0].source.port}`;
        childPanel.block.push({
            id: outputId,
            name: "输出",
            nodeType: consts.ShapeType.Output,
            position: { "x": Number(cIoItem.Rect._attributes.left) + 50, "y": Number(cIoItem.Rect._attributes.top) - 40 + IoCount * 30 },
            size: { "width": 40, "height": 20 },
            items: [{ "id": `${consts.InPrefix}0`, "group": consts.InFlag }],
        })
        childPanel.line.push({
            id: pomelo.app.db.genId(),
            lineType: 1,
            source: { "cell": blockId, "port": `${consts.OutPrefix}0` },
            target: { "cell": outputId, "port": `${consts.InPrefix}0` },
        });
        IoCount++;
    }
}

/**
 * 创建IO模块
 * @param {*} isInput 是否是输入
 * @param {*} items 子系统内部与外边某条线相关连的线
 * @param {*} cIoItem 子系统内部IO模块
 * @param {*} childPanel 子系统DB格式
 */
pro.createIOModel = function(isInput, items, cIoItem, childPanel) {
    if (isInput) {
        let inputId = `${pomelo.app.db.genId()}_${items[0].source.port}`;
        childPanel.block.push({
            id: inputId,
            name: "输入",
            nodeType: consts.ShapeType.Input,
            position: { "x": Number(cIoItem.Rect._attributes.left) - 50, "y": Number(cIoItem.Rect._attributes.top) - 40 + IoCount * 30 },
            size: { "width": 40, "height": 20 },
            items: [{ "id": `${consts.OutPrefix}0`, "group": consts.OutFlag }],
        })

        // 连线
        for (let n = 0; n < items.length; n++) {
            const line = items[n];
            childPanel.line.push({
                id: pomelo.app.db.genId(),
                lineType: 1,
                source: { "cell": inputId, "port": `${consts.OutPrefix}0` },
                target: { "cell": line.target.cell, "port": line.target.port },
            });
        }
    } else {
        let outputId = `${pomelo.app.db.genId()}_${items[0].target.port}`;
        childPanel.block.push({
            id: outputId,
            name: "输出",
            nodeType: consts.ShapeType.Output,
            position: { "x": Number(cIoItem.Rect._attributes.left) + 50, "y": Number(cIoItem.Rect._attributes.top) - 40 + IoCount * 30 },
            size: { "width": 40, "height": 20 },
            items: [{ "id": `${consts.InPrefix}0`, "group": consts.InFlag }],
        })

        // 连线
        for (let n = 0; n < items.length; n++) {
            const line = items[n];
            childPanel.line.push({
                id: pomelo.app.db.genId(),
                lineType: 1,
                source: { "cell": line.source.cell, "port": line.source.port },
                target: { "cell": outputId, "port": `${consts.InPrefix}0` },
            });
        }
    }
    IoCount++;
}

/**
 * 找出子系统内与外边线端口一致的所有连线
 * @param {*} isInput 是否是输入
 * @param {*} subLine 外边线详情数组
 * @param {*} relArray 里边IO模块数组
 */
pro.findRelOutLine = function(isInput, subLine, relArray) {
    let record = [];
    if (isInput) {
        for (let i = 0; i < subLine.length; i++) {
            const outLine = subLine[i];
            let relitem = [];  // > 1 则表示一个输入模块直接连多个模块的同一个端口
            for (let j = 0; j < relArray.length; j++) {
                const inLine = relArray[j];
                const iport = inLine.source.port.split('_')[1];
                const oport = outLine.target.port.split('_')[1];
                if (iport == oport) {
                    relitem.push(inLine);
                }
            }
            if (relitem.length > 0) {
                record.push(relitem);
            } else {
                console.warn('关联线不存在, 可能是IO/监控模块!', isInput);
            }
        }
    } else {
        for (let i = 0; i < subLine.length; i++) {
            const outLine = subLine[i];
            let relitem = [];
            for (let j = 0; j < relArray.length; j++) {
                const inLine = relArray[j];
                const iport = inLine.target.port.split('_')[1];
                const oport = outLine.source.port.split('_')[1];
                if (iport == oport) {
                    relitem.push(inLine);
                }
            }
            if (relitem.length > 0) {
                record.push(relitem);
            } else {
                console.warn('关联线不存在, 可能是IO/监控模块!', isInput);
            }
        }
    }
    return record;
}

/**
 * 找出子系统内部所有与IO模块相连的线(粗线已经展开)
 * @param {*} isInput 是否是输入
 * @param {*} ioArray 子系统IO模块数组
 * @param {*} lineArray 子系统所有连线数组
 * @returns 
 */
pro.findRelIOLine = function (isInput, ioArray, lineArray) {
    let relArray = []; // 记录全部展开后相关线
    let portIdx = 0;
    if (isInput) {
        for (let i = 0; i < ioArray.length; i++) {
            const item = ioArray[i];
            const ydim = Number(item.Dim._attributes.ydim);
            // 输入模块
            if (ydim > 0) {
                for (let j = 0; j < lineArray.length; j++) {
                    const line = lineArray[j];
                    if (line.Data._attributes.in == item._attributes.id) {
                        let subLine = this.getBoldLineDetails(line);
                        for (let m = 0; m < subLine.length; m++) {
                            const subitem = subLine[m];
                            let sport = Number(subitem.source.port.split('_')[1]) + portIdx;
                            let tport = Number(subitem.target.port.split('_')[1]) + portIdx;
                            relArray.push({
                                source: { "cell": subitem.source.cell, "port": `${consts.OutPrefix}${sport}`},
                                target: { "cell": subitem.target.cell, "port": `${consts.InPrefix}${tport}`}
                            });
                        }
                    }
                }
                portIdx = portIdx + ydim;
            }
        }
    } else {
        for (let i = 0; i < ioArray.length; i++) {
            const item = ioArray[i];
            const udim = Number(item.Dim._attributes.udim);
            // 输出模块
            if (udim > 0) {
                for (let j = 0; j < lineArray.length; j++) {
                    const line = lineArray[j];
                    if (line.Data._attributes.out == item._attributes.id) {
                        let subLine = this.getBoldLineDetails(line);
                        for (let m = 0; m < subLine.length; m++) {
                            const subitem = subLine[m];
                            let sport = Number(subitem.source.port.split('_')[1]) + portIdx;
                            let tport = Number(subitem.target.port.split('_')[1]) + portIdx;
                            relArray.push({
                                source: { "cell": subitem.source.cell, "port": `${consts.OutPrefix}${sport}`},
                                target: { "cell": subitem.target.cell, "port": `${consts.InPrefix}${tport}`}
                            });
                        }
                    }
                }
                portIdx = portIdx + udim;
            }
        }
    }
    return relArray;
}

/**
 * 递归拆子系统
 * @param {*} uid 用户UID
 * @param {*} projectList 解析后所有gra4 json对象
 * @param {*} sysArray 项目画板数组容器
 * @param {*} parentJson  当前画板父面板json描述
 * @param {*} sysJson  当前画板json描述
 * @param {*} sysId    当前画板ID
 * @param {*} sysPid   当前画板父ID
 * @param {*} sysCpid   当前画板在其父画板中的模块ID
 */
pro.splitChildSys = function (uid, projectList, sysArray, parentJson, sysJson, sysId, sysPid, sysCpid) {
    // 当前层系统解析
    let item = this.splitItem(uid, sysJson, sysId, sysPid);
    // 插入子系统中转器件
    if (sysCpid) {
        this.splitInterfaceModel(parentJson, sysJson, sysCpid, item);
    }
    sysArray.push(item);

    // 子系统
    let findCSysPanelId = function (id) {
        for (let i = 0; i < item.block.length; i++) {
            const block = item.block[i];
            if (block.id == id) {
                return block.child;
            }
        }
    }

    let units = sysJson.Model.UnitGroup.Unit;
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.SubBlock) {
            let key = path.normalize(unit.SubBlock._attributes.File);
            let xmlJson = projectList[key];
            if (!xmlJson) {
                key = key.replace(/\\/g, "/");
                xmlJson = projectList[key];
            }
            let cpid = unit._attributes.id;
            let id = findCSysPanelId(cpid);
            let pid = sysId;
            this.splitChildSys(uid, projectList, sysArray, sysJson, xmlJson, id, pid, cpid);
        }
    }
}
