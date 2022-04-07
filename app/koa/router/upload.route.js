const Router = require('koa-router')
const KoaBody = require('koa-body')
const path = require('path')

const router = new Router({ prefix: '/upload' })
const { importProject } = require('../controller/upload.controller')
const { userValidator, verifyUser } = require('../middleware/upload.middleware')

router.post('/importProject', userValidator, verifyUser, importProject);


module.exports = router