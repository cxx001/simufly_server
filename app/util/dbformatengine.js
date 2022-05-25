const fs = require('fs');
const consts = require('../common/consts');

var pro = module.exports;

const EnginePath = '/home/simufly_engine/build/bin/config/project/project.json';

// 前端与引擎模块ID映射表 {panelID_modelID: indexID}.
let mappingtbl = {};

/**
 * 数据库工程文件转引擎平铺格式
 * @param {*} assignList 分配任务列表
 * @param {*} dbList 数据库工程文件
 */
pro.formatDb2Engine = function (assignList, dbList) {
    mappingtbl = {};
    let project = [];
    for (let i = 0; i < assignList.length; i++) {
        // 一台机器
        let projectItem = {
            PartitionGroup: [],
            LineGroup: [],
        }
        const pcitem = assignList[i];
        projectItem.IP = pcitem.ip;
        let threads = pcitem.thread;
        let blockTotal = this.genPartition(threads, dbList, projectItem);
        this.genLine(dbList, projectItem);
        projectItem.PartitionTotal = projectItem.PartitionGroup.length;
        projectItem.BlockTotal = blockTotal;
        projectItem.LineTotal = projectItem.LineGroup.length;
        project.push(projectItem);
    }

    fs.writeFile(EnginePath, JSON.stringify(project[0], null, '\t'), () => {});
    console.log('write engine json complete.');
    return mappingtbl;
}

/**
 * 分任务模块
 * @param {*} threads 客户端上传的分区列表信息
 * @param {*} dbList 数据库画板信息
 * @param {*} projectItem 输出给引擎json数据容器
 * @returns 
 */
pro.genPartition = function (threads, dbList, projectItem) {
    // 分任务
    let idx = 0;
    for (let i = 0; i < threads.length; i++) {
        let blockList = [];
        const partItem = threads[i];
        let partType = partItem.type;    // sm/ss当前不需要，默认数组第一个是sm，其它都是ss
        let partBlock = partItem.block;
        let curPartBlock = null;
        for (let m = 0; m < partBlock.length; m++) {
            const blockId = partBlock[m];
            let mainPanel = dbList[0];
            for (let n = 0; n < mainPanel.block.length; n++) {
                curPartBlock = mainPanel.block[n];
                if (blockId == curPartBlock.id) {
                    this.getMinBlockList(curPartBlock, dbList, blockList, mainPanel.id);
                    break;
                }
            }
        }

        if (blockList.length == 0) {
            console.warn('当前分区上没有一个最小模块!', partItem);
            continue;
        }

        // 生成Partition Block
        let partitionItem = {};
        partitionItem.Id = i;
        partitionItem.CpuId = i;
        partitionItem.Name = curPartBlock.name;
        partitionItem.BlockGroup = [];
        for (let j = 0; j < blockList.length; j++) {
            const item = blockList[j];
            let blockId = idx++;
            let modelName = item.modelId ? item.modelId.substring(25) : item.name;
            partitionItem.BlockGroup.push({
                Id: blockId,
                Name: item.name,
                Model: modelName + '.json',
                Order: blockId,
            });
            mappingtbl[item.panelId + '_' + item.id] = blockId;
        }
        partitionItem.BlcokCount = partitionItem.BlockGroup.length;
        projectItem.PartitionGroup.push(partitionItem);
    }
    return idx;
}

/**
 * 平铺连线
 * @param {*} dbList 数据库画板信息
 * @param {*} projectItem 输出给引擎json数据容器
 */
pro.genLine = function (dbList, projectItem) {
    for (const k in mappingtbl) {
        const value = mappingtbl[k];
        let keys = k.split('_');
        let panelId = keys[0];
        let blockId = keys[1];
        const panelItem = this.findPanelById(panelId, dbList);
        if (!panelItem) {
            console.error('查找的画板不存在!', panelId);
            return;
        }

        let lines = panelItem.line;
        for (let i = 0; i < lines.length; i++) {
            const lineItem = lines[i];
            // 模块的输入线
            if (lineItem.source.cell == blockId) {
                for (let j = 0; j < panelItem.block.length; j++) {
                    // 找线的目标模块
                    const blockItem = panelItem.block[j];
                    if (lineItem.target.cell == blockItem.id ) {
                        let inputPort = lineItem.target.port;
                        const ids = inputPort.split('_');
                        const portId = ids[ids.length-1];
                        this.setTargetLine(blockItem, panelItem, portId, dbList, projectItem, value, lineItem);
                        break;
                    }
                }
            }
        }
    }
}

/**
 * 递归获取当前模块所有最小模块
 * @param {*} blockItem 当前模块
 * @param {*} dbList 数据库工程数据
 * @param {*} blockList 筛选模块列表
 * @param {*} panelId 当前模块所在画板ID
 * @returns 
 */
pro.getMinBlockList = function (blockItem, dbList, blockList, panelId) {
    if (!blockItem.child && blockItem.nodeType < consts.ShapeType.Input) {
        blockItem.panelId = panelId;
        blockList.push(blockItem);
        return;
    }

    for (let i = 0; i < dbList.length; i++) {
        const panelItem = dbList[i];
        if (panelItem.id == blockItem.child) {
            for (let j = 0; j < panelItem.block.length; j++) {
                const childBlock = panelItem.block[j];
                this.getMinBlockList(childBlock, dbList, blockList, panelItem.id);
            }
            break;
        }
    }
}

/**
 * 根据画板ID找画板
 * @param {*} panelId 画板ID
 * @param {*} dbList 整个工程信息
 * @returns 
 */
pro.findPanelById = function (panelId, dbList) {
    for (let i = 0; i < dbList.length; i++) {
        const panelItem = dbList[i];
        if (panelId == panelItem.id) {
            return panelItem;
        }
    }
    return null;
}

/**
 * 根据模块的子面板ID查找模块
 * @param {*} childId 子面板ID
 * @param {*} blockArray 所有模块
 * @returns 
 */
pro.findBlockByChildId = function (childId, blockArray) {
    for (let i = 0; i < blockArray.length; i++) {
        const block = blockArray[i];
        if (block.child == childId) {
            return block;
        }
    }
    return null;
}

/**
 * 线连的对端是子系统情况
 * @param {*} panelId 对端子系统画板ID
 * @param {*} dbList 项目数据
 * @param {*} targetItem 目标block
 * @param {*} targetPanel 目标所在面板
 * @param {*} projectItem 转引擎json数据保存对象
 * @param {*} blockEngineId 当前模块在引擎中的ID
 * @param {*} inputPort 外边连线target端的端口
 * @param {*} outLine 最上层起始的连线信息
 * @returns 
 */
pro.setChildSysLineType = function (panelId, dbList, targetItem, targetPanel, projectItem, blockEngineId, inputPort, outLine) {
    // 目标子系统的内部
    const panel = this.findPanelById(panelId, dbList); 
    if (!panel) {
        console.error('画板不存在!', panelId);
        return;
    }

    for (let i = 0; i < panel.block.length; i++) {
        const blockItem = panel.block[i];
        // 找到对应的输入模块
        const ids = blockItem.id.split('_');
        const portId = ids[ids.length-1];
        let inPort = null;
        for (let m = 0; m < targetPanel.line.length; m++) {
            const line = targetPanel.line[m];
            if (line.target.cell == targetItem.id) {
                let ports = line.target.port.split('_');
                inPort = ports[ports.length-1];
                break;
            }
        }

        if ((blockItem.nodeType == consts.ShapeType.Input || blockItem.nodeType == consts.ShapeType.Output) && 
            blockItem.items[0].group == 'out' && inPort == portId) {
            // 递归找输入模块关联的最小模块连线
            this.setTargetLine(blockItem, panel, inputPort, dbList, projectItem, blockEngineId, outLine);
            break;
        }
    }
}

/**
 * 线连的对端是IO/总线模块情况
 * @param {*} targetItem 输出端连的目标模块
 * @param {*} targetPanel 目标模块所在的面板
 * @param {*} inputPort 输入端口号
 * @param {*} dbList 工程数据
 * @param {*} projectItem 转后存储对象
 * @param {*} blockEngineId 模块在引擎中的ID
 * @param {*} outLine 递归开始的第一根连线
 * @returns 
 */
pro.setIOBusLineType = function (targetItem, targetPanel, inputPort, dbList, projectItem, blockEngineId, outLine) {
    if (targetItem.nodeType == consts.ShapeType.Input || targetItem.nodeType == consts.ShapeType.OneMore) {
        // 进入
        for (let i = 0; i < targetPanel.line.length; i++) {
            const line = targetPanel.line[i];
            if (line.source.cell == targetItem.id) {
                for (let j = 0; j < targetPanel.block.length; j++) {
                    const blockItem = targetPanel.block[j];
                    if (blockItem.id == line.target.cell) {
                        // 如果是一对多总线
                        if (targetItem.nodeType == consts.ShapeType.OneMore) {
                            const ports = line.source.port.split('_');
                            const port = ports[ports.length-1];
                            if (port == inputPort) {
                                inputPort = line.target.port.split('_')[1];
                                this.setTargetLine(blockItem, targetPanel, inputPort, dbList, projectItem, blockEngineId, outLine);
                            }
                        } else {
                            this.setTargetLine(blockItem, targetPanel, inputPort, dbList, projectItem, blockEngineId, outLine);
                        }
                        break;
                    }
                }
            }
        }
    } else {
        // 出去
        const panelItem = this.findPanelById(targetPanel.pid, dbList);
        if (!panelItem) {
            console.error('父面板不存在!', targetPanel.pid);
            return;
        }

        const block = this.findBlockByChildId(targetPanel.id, panelItem.block);
        if (!block) {
            console.error('子画板模块在父画板中不存在!', targetPanel.id);
            return;
        }

        for (let m = 0; m < panelItem.line.length; m++) {
            const lineItem = panelItem.line[m];
            if (lineItem.source.cell == block.id) {
                if (lineItem.subLine && lineItem.subLine.length > 1) {
                    // 粗线
                    for (let n = 0; n < lineItem.subLine.length; n++) {
                        const childLine = lineItem.subLine[n];
                        const ports = childLine.source.port.split('_');
                        const srcProt = ports[ports.length-1];
                        if (srcProt == inputPort) {
                            for (let n = 0; n < panelItem.block.length; n++) {
                                const inblock = panelItem.block[n];
                                if (inblock.id == lineItem.target.cell) {
                                    let targetProts = childLine.target.port.split('_');
                                    inputPort = targetProts[targetProts.length-1];
                                    this.setTargetLine(inblock, panelItem, inputPort, dbList, projectItem, blockEngineId, outLine);
                                    break;
                                }
                            }
                            break;
                        }
                    }

                } else {
                    // 细线
                    const ports = lineItem.source.port.split('_');
                    const srcProt = ports[ports.length-1];
                    if (srcProt == inputPort) {
                        for (let n = 0; n < panelItem.block.length; n++) {
                            const inblock = panelItem.block[n];
                            if (inblock.id == lineItem.target.cell) {
                                let targetProts = lineItem.target.port.split('_');
                                inputPort = targetProts[targetProts.length-1];
                                this.setTargetLine(inblock, panelItem, inputPort, dbList, projectItem, blockEngineId, outLine);
                                break;
                            }
                        }
                        break;
                    }

                }
            }
        }
    }
}

/**
 * 递归设置目标模块的连线 
 * @param {*} targetItem 输出端连的目标模块
 * @param {*} targetPanel 目标模块所在面板信息
 * @param {*} inputPort 输入端口号
 * @param {*} dbList 画板数据库数据
 * @param {*} projectItem 转换后数据保存对象
 * @param {*} blockEngineId 模块在引擎中的ID
 * @param {*} outLine 递归开始的第一根连线
 */
pro.setTargetLine = function (targetItem, targetPanel, inputPort, dbList, projectItem, blockEngineId, outLine) {
    let panelId = targetItem.child;
    if (panelId) {
        // 连子系统
        this.setChildSysLineType(panelId, dbList, targetItem, targetPanel, projectItem, blockEngineId, inputPort, outLine);
    } else if(targetItem.nodeType >= consts.ShapeType.Input ) {
        // 输入/输出/总线模块
        this.setIOBusLineType(targetItem, targetPanel, inputPort, dbList, projectItem, blockEngineId, outLine);
    } else {
        // 最小模块
        let blockItem = null;
        for (const k in mappingtbl) {
            const value = mappingtbl[k];
            if (value == blockEngineId) {
                let keys = k.split('_');
                let panelId = keys[0];
                let blockId = keys[1];
                const panelItem = this.findPanelById(panelId, dbList);
                for (let i = 0; i < panelItem.block.length; i++) {
                    const block = panelItem.block[i];
                    if (block.id == blockId) {
                        blockItem = block;
                        break;
                    }
                }
                break;
            }
        }

        // 最小模块
        projectItem.LineGroup.push({
            Src: blockEngineId,
            Dst: mappingtbl[targetPanel.id + '_' + targetItem.id],
            SrcPort: Number(outLine.source.port.split('_')[1]),
            DstPort: Number(inputPort),
            SrcName: blockItem.name,
            DstName: targetItem.name,
        });
    }
}