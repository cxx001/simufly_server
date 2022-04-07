const { userFormatError, userAlreadyExist, userRegisterError } = require('../constant/err.type')

const userValidator = async (ctx, next) => {
    let { username, password } = ctx.request.body;
    if (!username || !password) {
        ctx.app.emit('error', userFormatError, ctx)
        return
    }
    await next()
}

const verifyUser = async (ctx, next) => {
    let { username } = ctx.request.body;
    try{
        // const res = await getUserInfo({username})
        // if (res) {
        //     ctx.app.emit('error', userAlreadyExist, ctx)
        //     return
        // }
    } catch(e) {
        // console.log(e);
        // ctx.app.emit('error', userRegisterError, ctx)
        // return
    }
    await next()
}


module.exports = {
    userValidator,
    verifyUser
}