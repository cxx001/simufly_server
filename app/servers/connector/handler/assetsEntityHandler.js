/**
 * Date: 2022/5/17
 * Author: admin
 * Description: 
 */
 'use strict';
 module.exports = function (app) {
     return new Handler(app);
 };
 
 var Handler = function (app) {
     this.app = app;
 };
 
 var handler = Handler.prototype;