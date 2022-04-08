var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var ProjectSchema = new Schema({
	_id: String,
	uid: String,
    data: []
});

ProjectSchema.set('toObject', { getters: true });

module.exports = ProjectSchema;