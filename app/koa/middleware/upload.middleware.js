const pomelo = require('pomelo');
const consts = require('../../common/consts');
const { commonError } = require('../constant/err.type')

const userValidator = async (ctx, next) => {
    let { uid } = ctx.request.body;
    if (!uid) {
        ctx.app.emit('error', commonError, ctx)
        return
    }
    await next()
}

const callAuthRemote = (uid) => {
    return new Promise((resolve, reject) => {
        // auth目前没加路由, 只能全局唯一开一台
        pomelo.app.rpc.auth.authRemote.getUid2Sid(null, uid, (sid) => {
            resolve(sid)
        });
    })
}

const verifyUser = async (ctx, next) => {
    let { uid } = ctx.request.body;
    let sid = await callAuthRemote(uid);
    if (!sid) {
        ctx.app.emit('error', commonError, ctx)
        return
    } else {
        ctx.userdata = {
            uid: uid,
            sid: sid
        }
    }
    await next()
}

const validator = async (ctx, next) => {
    try {
        ctx.verifyParams({
            uid: { type: 'string', required: true },
            groupName: { type: 'string', required: true },
        });
    } catch (error) {
        commonError.result = error
        ctx.app.emit('error', commonError, ctx)
        return
    }
    await next()
 }

module.exports = {
    userValidator,
    verifyUser,
    validator,
}