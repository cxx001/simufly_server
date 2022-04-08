/**
 * Date: 2022/3/11
 * Author: admin
 * Description:
 */
'use strict';
let avatarSchema = require('./schemas/avatarSchema');
let projectSchema = require('./schemas/projectSchema');

let name2Schema = {
	"Avatar": avatarSchema,
	"Project": projectSchema,
};

module.exports = name2Schema;