/**
 * Date: 2022/4/1
 * Author: admin
 * Description:
 */
'use strict';
const pomelo = require('pomelo');
const consts = require('../common/consts');
const utils = require('../util/utils')
const logger = require('pomelo-logger').getLogger('cskl', '__filename');
const fs = require('fs');
const messageService = require('../services/messageService');
const koa = require('../koa/main');

const SAVE_DB_TIME = 60 * 1000 * 5;

var instance = null;
module.exports = function (app) {
    if (instance) {
        return instance;
    }
    return instance = new AssetsStub(app);
}

var AssetsStub = function (app) {
    this.app = app;
    let assets = app.get('servers').assets;
    this.assetsCfg = utils.find2key('id', app.get('serverId'), assets);
    koa.start(this);

    this.db = pomelo.app.db.getModel('Project');
    this.waitToUpdateDB = new Set();
    this.projectsById = {};
    this.saveDBTimer = setInterval(this._onSaveToDB.bind(this), SAVE_DB_TIME);
}

var pro = AssetsStub.prototype;

pro._onSaveToDB = function () {
    if (this.waitToUpdateDB.size === 0)
        return;
    let entry;
    for (let id of this.waitToUpdateDB) {
        entry = this.projectsById[id];
        this.db.update({_id: id}, entry, {upsert: true}, function (err, raw) {
            if (err) {
                logger.error(id + " save db error: " + err);
            }
        })
    }
    this.waitToUpdateDB.clear();
};

// 获取、新建项目
/**
 * 
createData:
{
    uid: string
    data: [
        {
            id: int,
            pid: string,
            name: string,
            block: [{
                id: int,
                child: string,
                name: string,    
                nodeType: int,
                position: Object,
                size: Object,
                items: [{ "id": "0", "group": "in" }, { "id": "0", "group": "out" }],
                model: string,
                order: int
            }],
            line: [{
                id: string,
                source: Object,
                target: Object,
            }],
        }
    ]
}
 * 
 */
pro.getEntry = function (id, createData) {
	let self = this;
    return new Promise(function (resolve, reject) {
		let entry = self.projectsById[id];
        if (entry) {
            if (createData) {
                logger.warn('创建的新项目[%s]已经存在!', id);
            }
            resolve(entry);
        }
        else {
            self.db.findById(id, function (err, doc) {
                if (err) {
                    logger.error("db find project info error: " + err);
                    return;
                }
                // 新项目
                let entry = null;
                if (!doc && createData) {
                    entry = createData;
                    self.projectsById[id] = entry;
                    self.waitToUpdateDB.add(id);
                }
                else if (doc){
                    if (createData) {
                        logger.warn('创建的新项目[%s]已经存在!', id);
                    }
                    entry = doc;
                    self.projectsById[id] = entry;
                }
                resolve(entry);
            })
        }
    })
}

/**
 * 
 * @param {*} uid 用户id
 * @param {*} sid 用户所在服务器id
 * @param {*} optype 操作类型 1 新增  2 删除
 * @param {*} proinfo 项目基础信息
 * @returns 
 */
pro.callAvatarRemote = function (uid, sid, optype, proinfo) {
    return new Promise((resolve, reject) => {
        pomelo.app.rpc.connector.entryRemote.onModifyProjectList.toServer(sid, uid, optype, proinfo, () => {
            resolve()
        });
    })
}

pro.getProject = async function (id, cb) {
    let project = await this.getEntry(id);
    if (!project) {
        logger.warn('get project [%s] not exist!', id);
        cb({code: consts.Code.FAIL});
        return;
    }

    // TODO: test dbjson -> vuejson
    let sysList = [
        {
            "id": 1,
            "label": "示例工程", 
            "data": {
                "cells": [
                    {
                        "position": { "x": 140, "y": 90 },
                        "size": { "width": 130, "height": 90 },
                        "attrs": { "text": { "text": "动力仿真子模型" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "out" },
                                { "id": "2", "group": "out" },
                                { "id": "3", "group": "out" }
                            ]
                        },
                        "id": "bdab4feb-19b2-486b-8c58-ddc1e3c6993a",
                        "child": 2,
                        "name": "动力仿真子模型",
                        "nodeType": "1",
                        "zIndex": 1
                    },
                    {
                        "position": { "x": 150, "y": 290 },
                        "size": { "width": 130, "height": 90 },
                        "attrs": { "text": { "text": "质量仿真子模型" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "in" },
                                { "id": "2", "group": "out" }
                            ]
                        },
                        "id": "84cc0ed7-85e4-4747-a6a8-cc2142a14276",
                        "child": 3,
                        "name": "质量仿真子模型",
                        "nodeType": "1",
                        "zIndex": 2
                    },
                    {
                        "position": { "x": 404, "y": 200 },
                        "size": { "width": 80, "height": 60 },
                        "attrs": { "text": { "text": "弹道" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "in" },
                                { "id": "2", "group": "out" }
                            ]
                        },
                        "id": "29928825-0b85-449a-bc9d-6d187fd7e86d",
                        "name": "弹道",
                        "nodeType": "1",
                        "zIndex": 3
                    },
                    {
                        "shape": "dag-edge",
                        "attrs": { "line": { "strokeDasharray": 0 } },
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "016d87aa-9898-40ad-840e-d8bd7c7df196",
                        "source": {
                            "cell": "29928825-0b85-449a-bc9d-6d187fd7e86d",
                            "port": "2"
                        },
                        "target": {
                            "cell": "bdab4feb-19b2-486b-8c58-ddc1e3c6993a",
                            "port": "0"
                        },
                        "zIndex": 4
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "71d47bc7-f636-46a7-94e4-6e5d72c771de",
                        "source": {
                            "cell": "bdab4feb-19b2-486b-8c58-ddc1e3c6993a",
                            "port": "2"
                        },
                        "target": {
                            "cell": "84cc0ed7-85e4-4747-a6a8-cc2142a14276",
                            "port": "0"
                        },
                        "zIndex": 5
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "ba413091-b7e0-4492-8960-fd757a9a237c",
                        "source": {
                            "cell": "bdab4feb-19b2-486b-8c58-ddc1e3c6993a",
                            "port": "3"
                        },
                        "target": {
                            "cell": "84cc0ed7-85e4-4747-a6a8-cc2142a14276",
                            "port": "1"
                        },
                        "zIndex": 6
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "6598461c-1fa9-4fed-a878-34b56a55bb06",
                        "source": {
                            "cell": "bdab4feb-19b2-486b-8c58-ddc1e3c6993a",
                            "port": "1"
                        },
                        "target": {
                            "cell": "29928825-0b85-449a-bc9d-6d187fd7e86d",
                            "port": "0"
                        },
                        "zIndex": 7
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "ba86c755-874b-4846-ab83-e253ebd19bbe",
                        "source": {
                            "cell": "84cc0ed7-85e4-4747-a6a8-cc2142a14276",
                            "port": "2"
                        },
                        "target": {
                            "cell": "29928825-0b85-449a-bc9d-6d187fd7e86d",
                            "port": "1"
                        },
                        "zIndex": 8
                    }
                ]
            }
        },
        {
            "pid": 1,
            "id": 2,
            "label": "动力仿真子模型", 
            "data": {
                "cells": [
                    {
                        "position": { "x": 10.000000000000014, "y": 130 },
                        "size": { "width": 130, "height": 200 },
                        "attrs": { "text": { "text": "动力仿真子模型输入" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "out" },
                                { "id": "2", "group": "out" }
                            ]
                        },
                        "id": "57d13230-6467-4522-b829-11111111",
                        "name": "动力仿真子模型输入",
                        "nodeType": "2",
                        "zIndex": 1
                    },
                    {
                        "position": { "x": 600, "y": 130 },
                        "size": { "width": 130, "height": 210 },
                        "attrs": { "text": { "text": "动力仿真子模型输出" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "in" },
                                { "id": "2", "group": "in" },
                                { "id": "3", "group": "out" }
                            ]
                        },
                        "id": "57d13230-6467-4522-b829-22222222",
                        "name": "动力仿真子模型输出",
                        "nodeType": "2",
                        "zIndex": 1
                    },
                    {
                        "position": { "x": 350, "y": 220 },
                        "size": { "width": 20, "height": 20 },
                        "attrs": { "text": { "text": "+" } },
                        "shape": "my-circle",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "in" },
                                { "id": "2", "group": "out" }
                            ]
                        },
                        "id": "57d13230-6467-4522-b829-cd05103e9dcb",
                        "name": "加法器",
                        "nodeType": "2",
                        "zIndex": 1
                    },
                    {
                        "position": { "x": 190.328125, "y": 126 },
                        "size": { "width": 80, "height": 60 },
                        "attrs": { "text": { "text": "发动机" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "out" },
                                { "id": "2", "group": "out" }
                            ]
                        },
                        "id": "df43714b-ae04-45bb-b4d5-306a6f4aa1ac",
                        "name": "发动机",
                        "nodeType": "1",
                        "zIndex": 2
                    },
                    {
                        "position": { "x": 190.328125, "y": 272 },
                        "size": { "width": 80, "height": 60 },
                        "attrs": { "text": { "text": "发动机" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "out" },
                                { "id": "2", "group": "out" }
                            ]
                        },
                        "id": "9c46e292-5fe9-47c1-85d2-9723d7652bec",
                        "name": "发动机",
                        "nodeType": "1",
                        "zIndex": 3
                    },
                    {
                        "position": { "x": 457.328125, "y": 126 },
                        "size": { "width": 80, "height": 60 },
                        "attrs": { "text": { "text": "贮箱" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "out" }
                            ]
                        },
                        "id": "9bbcb02e-07fb-49df-b57d-9fb585c80c54",
                        "name": "贮箱",
                        "nodeType": "1",
                        "zIndex": 4
                    },
                    {
                        "position": { "x": 457.328125, "y": 272 },
                        "size": { "width": 80, "height": 60 },
                        "attrs": { "text": { "text": "贮箱" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "out" }
                            ]
                        },
                        "id": "c3f988c6-9e9d-4bb1-98c6-5c6a06098002",
                        "name": "贮箱",
                        "nodeType": "1",
                        "zIndex": 5
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "dcbd3b66-b7ca-4006-abba-d945cdddda9f",
                        "zIndex": 6,
                        "source": {
                            "cell": "9c46e292-5fe9-47c1-85d2-9723d7652bec",
                            "port": "1"
                        },
                        "target": {
                            "cell": "57d13230-6467-4522-b829-cd05103e9dcb",
                            "port": "1"
                        }
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "81016f92-4532-4985-8d0a-c167b2c4590d",
                        "zIndex": 7,
                        "source": {
                            "cell": "df43714b-ae04-45bb-b4d5-306a6f4aa1ac",
                            "port": "1"
                        },
                        "target": {
                            "cell": "57d13230-6467-4522-b829-cd05103e9dcb",
                            "port": "0"
                        }
                    },
                    {
                        "shape": "dag-edge",
                        "attrs": { "line": { "strokeDasharray": 0 } },
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "d48da2df-0443-4f01-aa1e-a6506611a14a",
                        "zIndex": 8,
                        "source": {
                            "cell": "df43714b-ae04-45bb-b4d5-306a6f4aa1ac",
                            "port": "2"
                        },
                        "target": {
                            "cell": "9bbcb02e-07fb-49df-b57d-9fb585c80c54",
                            "port": "0"
                        }
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "aad62afe-0c82-4d5c-a96c-58e379a2b48f",
                        "zIndex": 9,
                        "source": {
                            "cell": "9c46e292-5fe9-47c1-85d2-9723d7652bec",
                            "port": "2"
                        },
                        "target": {
                            "cell": "c3f988c6-9e9d-4bb1-98c6-5c6a06098002",
                            "port": "0"
                        }
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "9fd86932-1e28-4915-8aa7-766567ae29ea",
                        "source": {
                            "cell": "57d13230-6467-4522-b829-11111111",
                            "port": "1"
                        },
                        "target": {
                            "cell": "df43714b-ae04-45bb-b4d5-306a6f4aa1ac",
                            "port": "0"
                        },
                        "zIndex": 13
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "c1df62bb-686c-4c68-a348-7876d609ad4e",
                        "source": {
                            "cell": "57d13230-6467-4522-b829-11111111",
                            "port": "2"
                        },
                        "target": {
                            "cell": "9c46e292-5fe9-47c1-85d2-9723d7652bec",
                            "port": "0"
                        },
                        "zIndex": 14
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "71bb5df9-28ad-4f9c-a15a-002d09f32ae8",
                        "source": {
                            "cell": "57d13230-6467-4522-b829-cd05103e9dcb",
                            "port": "2"
                        },
                        "target": {
                            "cell": "57d13230-6467-4522-b829-22222222",
                            "port": "1"
                        },
                        "zIndex": 15
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "6cbc17b9-1c3c-4378-be21-0e320394d4bf",
                        "source": {
                            "cell": "c3f988c6-9e9d-4bb1-98c6-5c6a06098002",
                            "port": "1"
                        },
                        "target": {
                            "cell": "57d13230-6467-4522-b829-22222222",
                            "port": "2"
                        },
                        "zIndex": 16
                    },
                    {
                        "shape": "dag-edge",
                        "attrs": { "line": { "strokeDasharray": 0 } },
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "5f6619b9-e1ad-46c3-ba66-a86a0f3a0c87",
                        "source": {
                            "cell": "9bbcb02e-07fb-49df-b57d-9fb585c80c54",
                            "port": "1"
                        },
                        "target": {
                            "cell": "57d13230-6467-4522-b829-22222222",
                            "port": "0"
                        },
                        "zIndex": 17
                    }
                ]
            }
        }, 
        {
            "pid": 1,
            "id": 3,
            "label": "质量仿真子模型", 
            "data": {
                "cells": [
                    {
                        "position": { "x": 40.000000000000014, "y": 120 },
                        "size": { "width": 130, "height": 200 },
                        "attrs": { "text": { "text": "质量仿真子模型输入" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "out" },
                                { "id": "2", "group": "out" }
                            ]
                        },
                        "id": "57d13230-6467-4522-b829-bd222222",
                        "name": "质量仿真子模型输入",
                        "nodeType": "2",
                        "zIndex": 1
                    },
                    {
                        "position": { "x": 540, "y": 110 },
                        "size": { "width": 130, "height": 210 },
                        "attrs": { "text": { "text": "质量仿真子模型输出" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "out" }
                            ]
                        },
                        "id": "57d13230-6467-4522-b829-bd111111",
                        "name": "质量仿真子模型输出",
                        "nodeType": "2",
                        "zIndex": 1
                    },
                    {
                        "position": { "x": 270, "y": 110 },
                        "size": { "width": 80, "height": 60 },
                        "attrs": { "text": { "text": "部段1" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "out" }
                            ]
                        },
                        "id": "4bfca3ab-922e-4262-a149-c8ec72619ba2",
                        "name": "部段1",
                        "nodeType": "1",
                        "zIndex": 1
                    },
                    {
                        "position": { "x": 270, "y": 260 },
                        "size": { "width": 80, "height": 60 },
                        "attrs": { "text": { "text": "部段2" } },
                        "shape": "my-rect",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "out" }
                            ]
                        },
                        "id": "964b1489-d514-48ea-a9d6-81f85b43562a",
                        "name": "部段2",
                        "nodeType": "1",
                        "zIndex": 2
                    },
                    {
                        "position": { "x": 430, "y": 190 },
                        "size": { "width": 20, "height": 20 },
                        "attrs": { "text": { "text": "+" } },
                        "shape": "my-circle",
                        "ports": {
                            "groups": {
                                "in": {
                                    "position": "left",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                },
                                "out": {
                                    "position": "right",
                                    "attrs": {
                                        "circle": {
                                            "r": 3,
                                            "magnet": true,
                                            "strokeWidth": 1,
                                            "stroke": "#1890ff",
                                            "fill": "#1890ff"
                                        }
                                    }
                                }
                            },
                            "items": [
                                { "id": "0", "group": "in" },
                                { "id": "1", "group": "in" },
                                { "id": "2", "group": "out" }
                            ]
                        },
                        "id": "9940b81f-53ee-48b6-9159-c7c7fedc11c6",
                        "name": "加法器",
                        "nodeType": "2",
                        "zIndex": 3
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "3ae35a76-5028-41ab-a6b3-a3f2fcc950cd",
                        "zIndex": 4,
                        "source": {
                            "cell": "4bfca3ab-922e-4262-a149-c8ec72619ba2",
                            "port": "1"
                        },
                        "target": {
                            "cell": "9940b81f-53ee-48b6-9159-c7c7fedc11c6",
                            "port": "0"
                        }
                    },
                    {
                        "shape": "dag-edge",
                        "attrs": { "line": { "strokeDasharray": 0 } },
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "e6a34367-7952-4e72-b1be-0761f22111e7",
                        "zIndex": 5,
                        "source": {
                            "cell": "964b1489-d514-48ea-a9d6-81f85b43562a",
                            "port": "1"
                        },
                        "target": {
                            "cell": "9940b81f-53ee-48b6-9159-c7c7fedc11c6",
                            "port": "1"
                        }
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "7759d8d6-49de-4036-b867-60bed93fda9a",
                        "source": {
                            "cell": "57d13230-6467-4522-b829-bd222222",
                            "port": "1"
                        },
                        "target": {
                            "cell": "4bfca3ab-922e-4262-a149-c8ec72619ba2",
                            "port": "0"
                        },
                        "zIndex": 6
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "86e11fe6-9435-48ac-8ed6-8393cdc447ad",
                        "source": {
                            "cell": "57d13230-6467-4522-b829-bd222222",
                            "port": "2"
                        },
                        "target": {
                            "cell": "964b1489-d514-48ea-a9d6-81f85b43562a",
                            "port": "0"
                        },
                        "zIndex": 7
                    },
                    {
                        "shape": "dag-edge",
                        "router": { "name": "manhattan" },
                        "connector": { "name": "rounded" },
                        "id": "475cb818-b05f-4e3e-8169-ebd2cbb04f66",
                        "source": {
                            "cell": "9940b81f-53ee-48b6-9159-c7c7fedc11c6",
                            "port": "2"
                        },
                        "target": {
                            "cell": "57d13230-6467-4522-b829-bd111111",
                            "port": "0"
                        },
                        "zIndex": 8
                    }
                ]
            }
        }
    ]

    cb({
        code: consts.Code.OK,
        sysList: sysList
    });
}

pro._getShapeType = function (nodeType) {
    let shape = "my-rect"
    if (nodeType == 6) {
        // 子系统
        shape = "my-rect"
    } else if (nodeType == 0) {
        // 最小模型
        shape = "my-rect"
    } else if (nodeType == 2) {
        // 加法器, 圆形
        shape = "my-circle"
    }
    return shape;
}

pro._formatDB2Vue = function (dbjson) {
    let sysList = [];
    for (let i = 0; i < dbjson.data.length; i++) {
        const itemSys = dbjson.data[i];
        let item = {};
        item.pid = itemSys.pid;
        item.id = itemSys.id;
        item.label = itemSys.name;
        item.data = {};
        item.data.cells = [];
        // 模块
        for (let j = 0; j < itemSys.block.length; j++) {
            const unit = element.block[j];
            let model = {};
            model.position = unit.position;
            model.size = unit.size;
            model.attrs = { text: { text: unit.name} };
            model.shape = this._getShapeType(unit.nodeType);
            model.ports = {};
            model.items = unit.items;
            model.id = unit.id;
            model.child = unit.child;
            model.name = unit.name;
            model.nodeType = unit.nodeType;
            model.zIndex = j;
            item.data.cells.push(model);
        }

        // 连线
        for (let j = 0; j < itemSys.line.length; j++) {
            const unit = element.line[j];
            let line = {};
            if (unit.dim > 1) {
                line.shape = "double-edge";
            } else {
                line.shape = "dag-edge";
            }
            line.id = unit.id;
            line.source = unit.source;
            line.target = unit.target;
            line.zIndex = j + itemSys.block.length;
        }
        
        sysList.push(item);
    }
    return sysList;
}