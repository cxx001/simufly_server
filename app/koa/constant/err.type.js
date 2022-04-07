module.exports = {
    userFormatError: {
        code: 400,
        message: '用户名或密码不能为空'
    },
    userAlreadyExist: {
        code: 401,
        message: '用户名已存在'
    },
    userRegisterError: {
        code: 402,
        message: '用户注册错误'
    },
    userDoesNotExist: {
        code: 403,
        message: '用户名不存在'
    },
    userLoginError: {
        code: 407,
        message: '用户登陆失败'
    },
    invalidPassword: {
        code: 405,
        message: '密码不匹配'
    },
    tokenExpires: {
        code: 406,
        message: '登陆已过期'
    },
    commonError: {
        code: 404,
        message: '操作失败'
    },
    hasNotAdminPermission: {
        code: 408,
        message: '没有相关权限'
    },
    fileUploadError: {
        code: 409,
        message: '上传失败'
    }
}