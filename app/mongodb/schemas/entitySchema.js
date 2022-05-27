var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var EntitySchema = new Schema({
	_id: String,
	uid: String,
    name: String,
    modelId: String,
    groupId: Number,
    iconUrl: String,
    des: String,
    nodeList: [],
    mapList: [],
});

EntitySchema.set('toObject', { getters: true });

module.exports = EntitySchema;