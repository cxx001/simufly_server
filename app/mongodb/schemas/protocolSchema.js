var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var ProtocolSchema = new Schema({
	_id: String,
	uid: String,
    name: String,
    des: String,
    portType: Number,
    interfaceType: Number,
    interfaces: [],
    datas: []
});

ProtocolSchema.set('toObject', { getters: true });

module.exports = ProtocolSchema;