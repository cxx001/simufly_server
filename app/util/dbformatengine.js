const fs = require('fs');
const consts = require('../common/consts');

var pro = module.exports;

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
        let idx = 0;
        const pcitem = assignList[i];
        projectItem.IP = pcitem.ip;
        let threadItem = pcitem.thread;
        for (let j = 0; j < threadItem.length; j++) {
            // 一个分区
            let blockList = [];
            const partItem = threadItem[j];
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

            // 生成Partition Block
            let partitionItem = {};
            partitionItem.Id = j;
            partitionItem.CpuId = j;
            partitionItem.Name = curPartBlock.name;
            partitionItem.BlockGroup = [];
            for (let z = 0; z < blockList.length; z++) {
                const item = blockList[z];
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

        /********************************************************************** */
        // 连线
        for (const k in mappingtbl) {
            const value = mappingtbl[k];
            let keys = k.split('_');
            let panelId = keys[0];
            let blockId = keys[1];
            for (let i = 0; i < dbList.length; i++) {
                const panelItem = dbList[i];
                if (panelItem.id == panelId) {
                    let lines = panelItem.line;
                    for (let j = 0; j < lines.length; j++) {
                        const lineItem = lines[j];
                        // 模块的输入线
                        if (lineItem.source.cell == blockId) {
                            for (let m = 0; m < panelItem.block.length; m++) {
                                // 找线的目标模块
                                const blockItem = panelItem.block[m];
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
                    break;
                }
            }
        }

        projectItem.PartitionTotal = projectItem.PartitionGroup.length;
        projectItem.BlockTotal = idx;
        projectItem.LineTotal = projectItem.LineGroup.length;
        project.push(projectItem);
    }
    fs.writeFile('project.json', JSON.stringify(project[0]), () => {});
    console.log('write complete.');
    return mappingtbl;
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
        for (let i = 0; i < dbList.length; i++) {
            const panel = dbList[i];
            if (panelId == panel.id) {
                for (let j = 0; j < panel.block.length; j++) {
                    const blockItem = panel.block[j];
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
                break;
            }
        }
    } else if(targetItem.nodeType >= consts.ShapeType.Input ) {
        // 输入/输出/总线模块
        let isOutModel = true;
        for (let i = 0; i < targetPanel.line.length; i++) {
            const line = targetPanel.line[i];
            if (line.source.cell == targetItem.id) {
                isOutModel = false;
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

        if (isOutModel) {
            for (let i = 0; i < dbList.length; i++) {
                const panelItem = dbList[i];
                if (panelItem.id == targetPanel.pid) {
                    for (let j = 0; j < panelItem.block.length; j++) {
                        const block = panelItem.block[j];
                        if (block.child == targetPanel.id) {
                            for (let m = 0; m < panelItem.line.length; m++) {
                                const lineItem = panelItem.line[m];
                                if (lineItem.source.cell == block.id) {
                                    if (lineItem.subLine.length > 0) {
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
                            break;
                        }
                    }
                    break;
                }
            }
        }

    } else {
        let blockItem = null;
        for (const k in mappingtbl) {
            const value = mappingtbl[k];
            if (value == blockEngineId) {
                let keys = k.split('_');
                let panelId = keys[0];
                let blockId = keys[1];
                for (let i = 0; i < dbList.length; i++) {
                    const panelItem = dbList[i];
                    if (panelItem.id == panelId) {
                        for (let j = 0; j < panelItem.block.length; j++) {
                            const block = panelItem.block[j];
                            if (block.id == blockId) {
                                blockItem = block;
                                break;
                            }
                        }
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