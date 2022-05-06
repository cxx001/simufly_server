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

let name2Schema = {
	"Avatar": avatarSchema,
	"Project": projectSchema,
	"Model": modelSchema,
	"Simulate": simulateSchema,
};

module.exports = name2Schema;