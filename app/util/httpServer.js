var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var path = require('path');
var express = require('express');
var multer = require('multer');

var app = express();

exports.start = function(cfg){
    let port = cfg.port;
	app.listen(port);
	console.log("http server is listening on " + port);
}

//设置跨域访问
app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", ' 3.2.1')
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
});

var createFolder = function (folder) {
    try {
        fs.accessSync(folder);
    } catch (e) {
        mkdirsSync(folder);
    }
};

var mkdirsSync = function (dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}

var uploadFolder = './assets/upload/';

createFolder(uploadFolder);

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadFolder);    // 保存的路径
    },
    filename: function (req, file, cb) {
        // 将保存文件名
        cb(null, file.originalname);
    }
});

// 通过 storage 选项来对 上传行为 进行定制化
var upload = multer({ storage: storage })

// 文件上传
app.post('/upload', upload.single('singleFile'), function (req, res, next) {
    var file = req.file;
    console.log('文件类型：%s', file.mimetype);
    console.log('原始文件名：%s', file.originalname);
    console.log('文件大小：%s', file.size);
    console.log('文件保存路径：%s', file.path);

    res.send({ ret_code: '0' });
});

app.get('/form', function(req, res, next){
    // var form = fs.readFileSync('./form.html', {encoding: 'utf8'});
    // res.send(form);
});