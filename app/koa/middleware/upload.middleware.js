const pomelo = require('pomelo');
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


module.exports = {
    userValidator,
    verifyUser
}