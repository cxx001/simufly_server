var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var AvatarSchema = new Schema({
    _id: String,
    openid: String,
    account: String,
    password: String,
	createTime: Number,
	lastOfflineTime: Number,
    projectList: []
});

AvatarSchema.set('toObject', { getters: true });

module.exports = AvatarSchema;