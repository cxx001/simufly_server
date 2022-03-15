/**
 * Date: 2022/3/11
 * Author: admin
 * Description:
 */
'use strict';
var Avatar = require("./avatar")

var entityClasses = {
	Avatar: Avatar,
}

var entityFactory = module.exports;

entityFactory.createEntity = function (entityType, entityid, entitycontent) {
    entitycontent = entitycontent || {}
    if (entityid)
        entitycontent["_id"] = entityid;
    var entityCreator = entityClasses[entityType];
    return new entityCreator(entitycontent);
};
