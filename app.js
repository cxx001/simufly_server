'use strict';
let reload = require('./app/util/require');
let pomelo = require('pomelo');
let logger = require('pomelo-logger').getLogger('cskl', __filename);
let fs = require('fs'), path = require('path');
let utils = require('./app/util/utils');
let koa = require('./app/koa/main');
let mongodb = require("./app/mongodb/mongodb");
let entityFactory = require('./app/entity/entityFactory');
let routeUtil = require('./app/util/routeUtil');
let RollStub = require('./app/services/rollStub');
let EngineStub = require('./app/services/engineStub');
let avatarFilter = require('./app/servers/connector/filter/avatarFilter');

/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'simu-fly');
app.set('reload', reload, true);

var initDB = function (app) {
	app.loadConfig('mongodb', app.getBase() + '/config/mongodb.json');
	var db = mongodb(app);
	db.init();
	app.set('db', db, true);
};

// app configuration
app.configure('production|development', 'gate', function () {
	app.set('canLogin', utils.checkMachineId());
	let curFilePath = path.resolve(__dirname);
	app.set('connectorConfig',
		{
			connector: pomelo.connectors.hybridconnector,
			heartbeat: 10,
			useDict: true,
			// ssl: {
			//     type: 'wss',
			//     key: fs.readFileSync(curFilePath + '/keys/server.key'),
			//     cert: fs.readFileSync(curFilePath + '/keys/server.crt')
			// },
			useProtobuf: false,
		});
});

app.configure('production|development', 'connector', function () {
	app.set('canLogin', utils.checkMachineId());
	app.before(avatarFilter());
	let curFilePath = path.resolve(__dirname);
	app.set('connectorConfig',
		{
			connector: pomelo.connectors.hybridconnector,
			heartbeat: 10,
			useDict: true,
			// ssl: {
			//     type: 'wss',
			//     key: fs.readFileSync(curFilePath + '/keys/server.key'),
			//     cert: fs.readFileSync(curFilePath + '/keys/server.crt')
			// },
			useProtobuf: false,
		});

	// setInterval(()=>{
	// 	let s = app.components.__connection__.getStatisticsInfo();
	// 	logger.info("服务器:[%s].在线:[%d].",s.serverId, s.loginedCount);
	// }, 1000 * 60);

	let connectors = app.get('servers').connector;
	let serverCfg = utils.find2key('id', app.get('serverId'), connectors);
	koa.start(serverCfg);
});

app.configure('production|development', function () {
	app.filter(pomelo.filters.timeout());  // 超时警告(beforeFilter->afterFilter),默认3s
	app.before(pomelo.filters.toobusy());  // 请求等待队列过长，超过一个阀值时，就会触发
	// app.enable('systemMonitor');
	if (typeof app.registerAdmin === 'function') {
		let onlineUser = require('./app/modules/onlineUser');
		app.registerAdmin(onlineUser, { app: app });
	}

	initDB(app);
	app.route('auth', routeUtil.auth);

	// 下位机配置
	app.loadConfig('underMachine', path.join(process.cwd(), '/config/underMachine.json'));

	// message缓冲
	app.set('pushSchedulerConfig', { scheduler: pomelo.pushSchedulers.buffer, flushInterval: 20 });

	// proxy configures
	app.set('proxyConfig', {
		bufferMsg: true,
		interval: 20,
		lazyConnection: true
		// enableRpcLog: true
	});
});

app.configure('production|development', 'auth', function () {
	app.set('rollStub', RollStub(app));
});

app.configure('production|development', 'engine', function () {
	app.set('engineStub', EngineStub(app), true);
});

// start app
app.start();

process.on('uncaughtException', function (err) {
	console.error(' Caught exception: ' + err.stack);
});
