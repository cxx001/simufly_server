const fs = require('fs');
const path = require('path');
const unzip = require("unzip-stream");
const pomelo = require('pomelo');
const { fileUploadError } = require('../constant/err.type')

class UploadController {
    async importProject(ctx, next) {
        const { uid } = ctx.request.body;
        const { file } = ctx.request.files   // 上传的文件key
        // let fileTypes = ['image/png', 'image/jpeg']
        if (file && file.size > 0) {
            console.log('[%s]上传文件: %s 路径: %s', uid, file.name, file.path);
            try {
                // 解压
                fs.createReadStream(file.path).pipe(unzip.Extract({ path: path.dirname(file.path)}));

                // 读取解析

                // 写数据库
                let db = {
                    uid: uid,
                    data: [
                        {
                            id: 1,
                            pid: null,
                            name: 'sysname',
                            block: [
                                {
                                    id: "1",
                                    child: 1,
                                    name: 'model_1',
                                    nodeType: 1,
                                    position: { "x": 0, "y": 0 },
                                    size: { "width": 0, "height": 0 },
                                    items: [{ "id": "0", "group": "in" }, { "id": "0", "group": "out" }],
                                    model: 'model_name.json',
                                    order: 1
                                }
                            ],
                            line: [
                                {
                                    id: "srand",
                                    source: {
                                        "cell": "1",
                                        "port": "1"
                                    },
                                    target: {
                                        "cell": "2",
                                        "port": "0"
                                    },
                                }
                            ]
                        }
                    ]
                }
                let id = pomelo.app.db.genId();
                await ctx.app.assetsStub.getEntry(id, db);

                // 同步用户表, 前面已经判断用户一定在线
                let sid = ctx.userdata.sid;
                let proinfo = {
                    id: id,
                    name: 'test_pro'
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