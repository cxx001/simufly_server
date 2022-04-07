/**
 * 目前服务端与前端交互框架还只支持长连接, 为什么先只考虑支持长连接？
 * 1. 长连接通信效率要高于短连接。
 * 2. 服务器能更好的获取客户端信息，管理客服端。
 * 3. 项目场景是针对某某单位内部客户，用户量不会过于庞大(百万级以上)。
 * 注: 后面如果确有需求，改短连接对于客户端几乎不需要改动，服务端扩展connector组件，同时提供http客服端封装，上层交互接口统一。
 * 
 * 当前使用http场景并不多(就上传服务)，所以先简单点引入koa提供独立的http服务。
 */

const path = require('path')
const Koa = require('koa');
const KoaStatic = require('koa-static')
const parameter = require('koa-parameter');
const cors = require('koa-cors');
const KoaBody = require('koa-body')

const app = new Koa();

const router = require('./router')
const uploadFolder = path.join(__dirname, '../../assets/upload/');

app.use(KoaBody({
    multipart: true,
    formidable: {
        // 在配置选项不推荐使用相对路径
        uploadDir: uploadFolder,
        keepExtensions: true,
        // filter: function ({name, originalFilename, mimetype}) {
        //     // keep only images
        //     console.log(mimetype)
        //     return mimetype && mimetype.includes("image");
        // }
        onFileBegin: (name, file) => {
            file.path = `${uploadFolder}${file.name}`
        },
        onError: (error) => {
            console.warn('上传失败!');
        },
    }
}))

// app.use(KoaStatic(path.join(__dirname, uploadFolder)))
app.use(parameter(app))
app.use(cors());
app.use(router.routes())
app.use(router.allowedMethods())
app.on('error', (err, ctx) => {
    ctx.status = 200;
    ctx.body = err
    console.warn(err);
})

exports.start = function(port){
    app.listen(port, () => {
        console.log(`http server is running on http://localhost:${port}`);
    })
}