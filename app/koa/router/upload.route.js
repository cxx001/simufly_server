const Router = require('koa-router')

const router = new Router({ prefix: '/upload' })
const { importProject } = require('../controller/upload.controller')
const { userValidator, verifyUser } = require('../middleware/upload.middleware')

router.post('/importProject', userValidator, verifyUser, importProject);


module.exports = router