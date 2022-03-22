/**
 * Date: 2022/3/11
 * Author: admin
 * Description: component基类定义
 */
'use strict';
let EventEmitter = require('events').EventEmitter;
let util = require('util');

let Component = function (entity) {
    EventEmitter.call(this);
    this.entity = entity;

    this.event2Funcs = {};
};

util.inherits(Component, EventEmitter);
module.exports = Component;

let pro = Component.prototype;

pro.safeBindEvent = function (event, func) {
    if (!(event in this.event2Funcs)) {
        this.event2Funcs[event] = [];
    }
    this.on(event, func);
    this.event2Funcs[event].push(func);
};

pro.clearEventListeners = function () {
    for (let event in this.event2Funcs) {
        let funcs = this.event2Funcs[event];
        for (let i = 0; i < funcs.length; i++) {
            this.removeListener(event, funcs[i]);
        }
    }
    this.event2Funcs = {};
};

pro.destroy = function () {
    this.clearEventListeners();
    this.stopSchedule();
    this.entity = null;
};

pro.startSchedule = function(step, cb) {
	this.stopSchedule();
    let count = 0;
	this._schedule = setInterval(function () {
        count = count + step;
        if(count > 1000 * 10) {
            this.stopSchedule();
        }
        cb();
    }.bind(this), step);
};

pro.stopSchedule = function() {
	if (this._schedule) {
		clearInterval(this._schedule);
		this._schedule = null;
	}
};
