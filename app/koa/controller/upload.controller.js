const { fileUploadError } = require('../constant/err.type')

class UploadController {
    async importProject(ctx, next) {
        const { file } = ctx.request.files   // 上传的文件key
        // let fileTypes = ['image/png', 'image/jpeg']
        if (file && file.size > 0) {
            ctx.body = {
                code: 200,
                message: '上传成功',
                result: {
                    userdata: ctx.userdata
                }
            }

        } else {
            ctx.app.emit('error', fileUploadError, ctx)
            return
        }

        await next()
    }
}

module.exports = new UploadController()