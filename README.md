
# 快速搭载http服务
```
python -m SimpleHTTPServer 8000
python ./SimpleHTTP.py (跨域访问)
```

# 调试
1. servers.json添加对应要调试的服务配置(本机调试:"args": " --inspect=5858", 远程调试:"--inspect=0.0.0.0:5858", 安全考虑正式环境不建议开远程调试)
2. 命令行后台启动服务器(cd根目录，执行pomelo start)
3. 选择要调试的服务端口(launch.json),启动vscode远程调试(由于是多进程,每次只能调试一个进程)

# 环境部署
1. 安装nodejs(> -v 8.11.x, 当前14.16.0)
2. 安装python(--version 2.5<version<3.0, 当前2.7.18)
3. 安装pomelo(npm install pomelo -g)
4. 安装mongodb 3.6.10

# 打包
1. npm run pkg
2. 后台运行 
```
nohup ./sumu-fly &>server.log & 
exit
```

# 常用命令
1. 启动 
```
pomelo start [-e production] [-D -d -t -i]
```
2. 退出 
```
pomelo stop
```
3. 获取服务器信息 
```
pomelo list
```