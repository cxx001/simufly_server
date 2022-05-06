var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var SimulateSchema = new Schema({
	_id: String,     // 就用项目ID
	uid: String,
    state: Number,   // 0: 分配任务 1: 生成代码 2: 生成代码中 3: 部署 4: 部署中  5: 配置完成  6: 连接成功  7: 开始仿真  8: 暂停仿真
    simuTime: Number,
    simuStep: Number,
    assignTask: [],
    signalSet: [],
    triggerSet: {}
});

SimulateSchema.set('toObject', { getters: true });

module.exports = SimulateSchema;