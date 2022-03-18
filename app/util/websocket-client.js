let EventEmitter = require('events').EventEmitter ;
let WebSocket = require('ws');
let utils = require('./utils');
let logger = require('pomelo-logger').getLogger('cskl', __filename);

/**
 * 与引擎通信协议格式: 
 * {
 *     route: 'xxx',
 *     idx: number,   // 0: 服务端主动推送  其它客户端主动请求
 *     msg: {}
 * }
 */

class SocketClient extends EventEmitter{
    constructor(){
        super();
        this.socket = null;
        this.initCallback = null;
        this.disconnectCb = null;
        this.callbacks = {};
        this.reqId = 0;
    }

    async init(params, cb) {
        if( cb === undefined ){
            let p0 =  new Promise( (resolve, reject)=>{ 
                let callback = (data)=>{
                    resolve( true );               
                };
                this._init(params,callback);
            });
            let p1 =  utils.sleep(10*1000); 
            let r = await Promise.race([p0,p1]);
            if( r ){
                return r ;
            }
            else{ 
                let err = 'pomelo init timeout:' + params; 
                logger.error(err);
                throw err ;                 
            }
        }else{
            this._init(params, cb);
        }
    }

    _init(params, cb) {
        this.initCallback = cb;
        let host = params.host;
        let port = params.port;
        let url = 'ws://' + host;
        if (port) {
            url += ':' + port;
        }
        this._initWebSocket(url);
    }

    _initWebSocket(url) {
        logger.info('init websocket: ', url);
        let onopen = (event)=> {
            logger.info("===onopen");
            if (this.initCallback) {
                this.initCallback(this.socket);
                this.initCallback = null;
            }
        }

        let onmessage = (data)=> {
            let resp = JSON.stringify(data);
            logger.info("===onmessage: ", resp);
            
            // 请求与cb可以分开
            // this.emit(resp.route, resp.msg);

            if (!resp.idx) {
                logger.debug("server push_msg:", resp);
                this.emit(resp.route, resp.msg);
                return;
            }

            let cb = this.callbacks[resp.idx];
            delete this.callbacks[resp.idx];
            if (typeof cb !== 'function') {
                logger.warn('server callback not function!');
                return;
            }
            cb(resp);
        }

        let onerror = (event)=> {
            logger.info("===onerror" + event);
            this.emit('io-error', event);
        }

        let onclose =  (event)=> {
            logger.info("===onclose");
            this.emit('close', event);
            let disconnectCb = this.disconnectCb ;
            disconnectCb && disconnectCb();
            this.disconnectCb = null;
            this.removeAllListeners()
        }

        this.socket = new WebSocket(url);
        this.socket.on("open", onopen);
        this.socket.on("close", onclose);
        this.socket.on("error", onerror);
        this.socket.on("message", onmessage);
    }

    async disconnect(cb){
        if( cb === undefined ){
            let p0 =  new Promise( (resolve, reject)=>{ 
                let callback = (data)=>{
                    resolve( true );               
                };
                this._disconnect(callback);
            });
            let p1 = utils.sleep(10*1000);
            let r = await  Promise.race([p0,p1]);
            if( r ){
                return r ;
            }
            else{ 
                let err = 'pomelo disconnect timeout'; 
                logger.error(err);
                throw err ; 
            }            
        }else{
            this._disconnect( cb );
        }  
    }

    _disconnect (cb) {
        this.disconnectCb = null;  
        if (this.socket) {
            this.disconnectCb = cb; 
            if (this.socket.disconnect) this.socket.disconnect();
            if (this.socket.close) this.socket.close();
            logger.info('disconnect.');
            this.socket = null;
        }
    }

    async request(route, msg, cb){
        if( cb === undefined ){
            let p0 =  new Promise( (resolve, reject)=>{ 
                let callback = (data)=>{
                    resolve( data );               
                };
                this._request(route,msg,callback);
            });
            let p1 = utils.sleep(8*1000);
            let r = await Promise.race([p0,p1]);
            if( r ){
                return r ;
            }
            else{ 
                let err = 'pomelo request timeout:' + route + ':' + msg ;    
                logger.error(err);
                throw err ;                        
            }            
        }else{
            this._request(route,msg,cb);
        }        
    }
    
    _request(route, msg, cb) {
        if (!route) {
            logger.warn();('===fail to send request without route.');
            return;
        }

        this.reqId++;
        let encode = {};
        encode.route = route;
        encode.idx = this.reqId;
        encode.msg = msg;
        
        logger.debug("@@@send:",route, JSON.stringify(msg)); 
        if (this.socket) {
            this.socket.send(JSON.stringify(encode));
        }
        this.callbacks[this.reqId] = cb;
    }
}

module.exports = SocketClient;
