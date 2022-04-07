const { userRegisterError, commonError } = require('../constant/err.type')

class UserController {
    // async register(ctx, next) {
    //     const { username, password } = ctx.request.body;
    //     try {
    //         const res = await createUser(username, password);
    //         ctx.body = {
    //             code: 200,
    //             message: '注册成功',
    //             result: {
    //                 id: res.id,
    //                 username: res.username
    //             }
    //         }
    //     } catch(e) {
    //         console.log('error', e)
    //         ctx.app.emit('error', userRegisterError, ctx)
    //         return
    //     }
    //     await next()
    // }

    // async login(ctx, next) {
    //     const { username } = ctx.request.body;
    //     // 1、获取用户信息
    //     try {
    //         // 从返回结果中剔除password
    //         const { password, ...res } = await getUserInfo({ username })

    //         ctx.body = {
    //             code: 200,
    //             message: '登陆成功',
    //             result: {
    //                 ...res,
    //                 token: jwt.sign(res, JWT_SECRET, { expiresIn: '1d' })
    //             }
    //         }
    //     } catch (error) {
    //         console.log('err', error)
    //     }

    //     await next();
    // }

    async getinfo(ctx, next) {
        ctx.body = '获取成功'
    }

    // async updatePwd(ctx, next) {
    //     const { id } = ctx.state.user;
    //     const { password } = ctx.request.body;
        
    //     try {
    //         const res = await updateById({id, password})
    //         if (res) {
    //             ctx.body = {
    //                 code: 200,
    //                 message: '修改成功'
    //             }
    //         }
    //     } catch (error) {
    //         console.log('err', error)
    //         return ctx.app.emit('error', commonError, ctx)
    //     }
    //     await next()
    // }
}

module.exports = new UserController()