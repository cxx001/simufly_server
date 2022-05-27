/**
 * Date: 2022/3/11
 * Author: admin
 * Description:
 */
'use strict';
let avatarSchema = require('./schemas/avatarSchema');
let projectSchema = require('./schemas/projectSchema');
let modelSchema = require('./schemas/modelSchema');
let simulateSchema = require('./schemas/simulateSchema');
let entitySchema = require('./schemas/entitySchema');
let protocolSchema = require('./schemas/protocolSchema');

let name2Schema = {
	"Avatar": avatarSchema,
	"Project": projectSchema,
	"Model": modelSchema,
	"Simulate": simulateSchema,
	"Entity": entitySchema,
	"Protocol": protocolSchema,
};

module.exports = name2Schema;