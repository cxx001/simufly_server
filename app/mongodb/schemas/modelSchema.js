var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var ModelSchema = new Schema({
	_id: String,
	uid: String,
    groupId: Number,
    data: {}
});

ModelSchema.set('toObject', { getters: true });

module.exports = ModelSchema;