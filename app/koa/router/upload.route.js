const Router = require('koa-router')

const router = new Router({ prefix: '/upload' })
const { importProject, importModel } = require('../controller/upload.controller')
const { userValidator, verifyUser, validator } = require('../middleware/upload.middleware')

router.post('/importProject', userValidator, verifyUser, importProject);
router.post('/importModel', validator, verifyUser, importModel);

module.exports = router