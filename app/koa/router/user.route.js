const Router = require('koa-router')

const router = new Router({prefix: '/user'})

const { getinfo } = require('../controller/user.controller')
const { userValidator, verifyUser } = require('../middleware/user.middleware')

router.post('/register', userValidator, verifyUser)
router.post('/login', userValidator)
router.get('/getinfo', getinfo)


module.exports = router