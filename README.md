
# 【快速搭载http服务】
python -m SimpleHTTPServer 8000
python ./SimpleHTTP.py (跨域访问)

# 【调试】
1. servers.json添加对应要调试的服务配置(本机调试:"args": " --inspect=5858", 远程调试:"--inspect=0.0.0.0:5858", 安全考虑正式环境不建议开远程调试)
2. 命令行后台启动服务器(cd根目录，执行pomelo start)
3. 选择要调试的服务端口(launch.json),启动vscode远程调试(由于是多进程,每次只能调试一个进程)

# 【环境】
1. 安装nodejs(> -v 8.11.x)
2. 安装python(--version 2.5<version<3.0)
3. 安装pomelo(npm install pomelo -g)
4. 安装mongodb 3.6.10

# 【常用操作】
1. pomelo启动: pomelo start [-e production] [-D -d -t -i]
(-D,设为守护进程，不然后台会被杀掉 pomelo start -e production -D)

2. 后台运行mongodb:
配置方式启动: mongod -f /usr/mongodb/mongodb.conf
命令参数启动: mongod --fork --dbpath=/usr/mongodb/db --logpath=/usr/mongodb/log/mongodb.log --logappend

3. 后台运行:
nohup xxx & (注意不能直接关闭shell窗口,要先exit命令退出)
nohup xxx >/dev/null 2>log &  只输出错误信息到日志文件 
nohup xxx >/dev/null 2>&1 &  什么信息也不要

4. mongodb创建密码访问账号用:
```
1. 用mongo.exe客户端程序连接上.
2. use admin
3. db.createUser({"user":"root","pwd":"123456","roles":[{role:"root",db:"admin"}]})
4. db.auth('root','123456')
```

5. 初始环境mongodb创建用户操作:
```
1. 创建数据库(mongo_fly 名字与mongodb.json配置一致)
use mongo_fly

2. 创建用户表 avatars 并插入数据
db.avatars.insert({"openid": "cxx", "account": "cxx", "password": "123456"})

```

# 【问题集】
1. linux上初次git pull fatal: Not a git repository (or any of the parent directories): .git
解决：先git init，再pull

2. Error:timer is not exsits...
是远程调用cb回调了两次以上引起，一般是读取数据库异步操作引起，可以使用Async.waterfall避免

3. windows上安装完mongodb，bin下双击mongod.exe启动马上就退出：
解决：假设安装在D:\mongodb\bin\mongod.exe这个目录，那么要在D根目录下建一个data目录。

4. 启动报 Last few GCs  ----  JS stacktrace ------ 内存不足错误:
解决: 管理员权限下启动cmd, 执行 set NODE_OPTIONS=--max_old_space_size=8172


