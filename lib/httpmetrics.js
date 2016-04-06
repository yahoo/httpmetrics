/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/**
 * ynodejs addon to get http stats
 * Please refer to the example files that demonstrates
 * how to make GET and POST calls
 * and retrieve these below metrics
 */
var http = require('http'),
    EventEmitter = require("events").EventEmitter,
    util = require('util');

/*
 * Please refer to the example files to get details on usage and metrics
 * Metrics added
 * IncomingMessage: {
    ymetrics: {
        headerSize:
        firstChunkSize:
        bodySize:
        statusCode:
        totalTransferTime:
        host:
    }
 }
 * OutgoingMessage: {
    ymetrics: {
        headerSize:
        firstChunkSize:
        bodySize:
        connectTime:
        totalTransferTime:
        firstChunkTransferTime:
        host:
    }
 }
 */
var REQUEST = 'request',
    RESPONSE = 'response',
    // We need this to ensure we invoke the hookfunction only for outbound requests
    OUTBOUND = 'outbound';

var Appender = function () {
    EventEmitter.call(this);
};
util.inherits(Appender, EventEmitter);

Appender.prototype.metricsAppended = false;
Appender.prototype.appendHttpMetrics = function () {

    if (this.metricsAppended) {
        //Metrics already appended. Do not append more than once
        return this;
    }
    this.metricsAppended = true;

    //Object for all the methods that need to be monkeypatched
    //Store the original function handles
    /*jslint nomen: true*/
    var backupMethods = {
        'IncomingMessage': {
            'emit' : http.IncomingMessage.prototype.emit
        },
        'OutgoingMessage': {
            '_send' : http.OutgoingMessage.prototype._send,
            'emit' : http.OutgoingMessage.prototype.emit
        },
        'ClientRequest': {
            'onSocket': http.ClientRequest.prototype.onSocket
        }
    }, self = this;

    //Monkeypatch http functions
    /**
     * This method is reliable to ensure socket was created for our request
     * For the request socket, catch the emitted events
     * And set timers where approriate
     */
    http.ClientRequest.prototype.onSocket = function (socket) {
        var request = this;
        //Initializations
        if (!request.ymetrics) {
            request.ymetrics = {};
        }
        if (!socket.ymetrics) {
            socket.ymetrics = {};
        }


        //Call the original method
        backupMethods.ClientRequest.onSocket.call(this, socket);

        //Note the time when socket was created
        socket.ymetrics.onSocketTime = Date.now();

        //only in case of outbound requests for now
        //When we decide to remove that restriction, or extend metrics for all cases,
        //we should be able to remove this additional check
        socket.ymetrics.type = OUTBOUND;

        //Store the emit function of the socket
        //Catch all events emitted
        //For interested events, do whatever
        //Call the original emit function
        if (!socket.ymetrics.socketEmitFn) {
            //If not already monkeypatched, do it
            //This is because in case of socket reuse, its already monkeypatched
            socket.ymetrics.socketEmitFn = socket.emit;
        }

        //Store the host name in both socket and request
        if (request._headers && request._headers.host) {
            socket.ymetrics.host = request._headers.host;
            request.ymetrics.host = request._headers.host;
        }

        //Set 0 as connect time
        //If a new socket is being connected, you get the actual connect time
        //Otherwise 0 indicates there was no new connection, socket reused
        request.ymetrics.connectTime = 0;
        socket.emit = function (event) {
            //We want to catch the connect event (for http) or secureConnect (for https)
            //To capture the time taken to connect after the socket was created
            if (event === 'connect' || event === 'secureConnect') {
                request.ymetrics.connectTime =
                    Date.now() - this.ymetrics.onSocketTime;
            }

            //We want to catch the drain event
            //To capture the time taken to send headers and data to the socket
            //after connection was established
            //[bug 6243384] No more drain event
            //Using 'free' and also computing header size here and removing the need
            //for 'finish' on OutgoingMessage

            //In case of redirects
            //With followRedirect: false, we get 'connect', 'finish', 'close'
            //With followRedirect: true, we get 'connect', 'finish', 'connect', 'free', 'close'
            //So we need to listen to both free and finish
            if (event === 'free' || event === 'finish') {
                //NOTE: If we reuse socket, this even will still be called once
                //per use
                //DO NOTE REPLACE THIS WITH CLOSE - Close is called only once
                //after reusing sockets for 'Keep-Alive'

                //Total transfer time *so far* and this value isnt meaningful
                //until the request is completed
                //http://comments.gmane.org/gmane.comp.lang.javascript.nodejs/1407
                //Because we do not get the drain event, we cannot compute
                //requestTotalTransferTime
                /*
                request.ymetrics.totalTransferTime =
                    Date.now() - this.ymetrics.onSocketTime;
                */

                //Request header size
                request.ymetrics.headerSize = 0;
                if (request._header) {
                    request.ymetrics.headerSize = request._header.length;
                }

                //This marks end of request transfer
                //Emit event if its an outbound request
                if (this.ymetrics.type === OUTBOUND) {
                    //In case of outbound, we know this is the 'request' object
                    self.emit('httpmetrics',
                        REQUEST,
                        request.ymetrics);
                }
            }

            //Call the original socket emit function
            socket.ymetrics.socketEmitFn.apply(this, arguments);

        };
    };

    /**
     * _send
     * This method is invoked to send headers and body to the socket
     * We will need to monkeypatch this to capture the data size
     */
    http.OutgoingMessage.prototype._send = function (data/*, encoding, callback*/) {

        // Note that this initialization is mandatory
        // Headers and data might be already received in the stream before
        // the socket has been created, connected and ready to accept data
        if (!this.ymetrics) {
            this.ymetrics = {};
        }
        if (!this.ymetrics.firstChunkSize) {
            this.ymetrics.firstChunkSize = data.length;
            this.ymetrics.bodySize = this.ymetrics.firstChunkSize;
        } else {
            this.ymetrics.bodySize += data.length;
        }

        //Invoke the original method
        backupMethods.OutgoingMessage._send.apply(this, arguments);
    };

    http.IncomingMessage.prototype.emit = function (event, chunk) {
        //Invoked when IncomingMessage has this.emit('data')
        if (!this.ymetrics) {
            this.ymetrics = {};
        }

        if (event === 'data') {
            //Check if first chunk of data received
            if (!this.ymetrics.firstChunkSize) {
                this.ymetrics.bodySize = 0;
                this.ymetrics.firstChunkSize = chunk.length;
                if (this.socket
                        && this.socket.ymetrics
                        && this.socket.ymetrics.onSocketTime) {
                    this.ymetrics.firstChunkTransferTime =
                        Date.now() - this.socket.ymetrics.onSocketTime;
                }
            }

            //Aggregate body size
            this.ymetrics.bodySize += chunk.length;
        }

        //Invoked when IncomingMessage has this.emit('end')
        if (event === 'end') {
            if (this.headers) {
                this.ymetrics.headerSize =
                    (JSON.stringify(this.headers)).length;
            }

            if (this.statusCode) {
                this.ymetrics.statusCode = this.statusCode;
            }

            //Make sure the socket has connection time set
            if (this.socket && this.socket.ymetrics) {

                //Compute the total transfer time
                if (this.socket.ymetrics.onSocketTime) {
                    this.ymetrics.totalTransferTime =
                        Date.now() - this.socket.ymetrics.onSocketTime;
                }
                //Store the host name
                if (this.socket.ymetrics.host) {
                    this.ymetrics.host = this.socket.ymetrics.host;
                }

                //This marks end of response
                //Emit event if this is an outbound request
                if (this.socket.ymetrics.type === OUTBOUND) {
                    //In case of outbound, we know this is the 'response' object
                    self.emit('httpmetrics',
                        RESPONSE,
                        this.ymetrics);
                }

            }
        }

        //Invoke the original method
        backupMethods.IncomingMessage.emit.apply(this, arguments);

    };

    //Return self to enable us to do an on('event') like
    //require('httpmetrics').appendHttpMetrics().on(...)
    return this;
};

/**
 * AppendHttpMetrics
 * is an instance of EventEmitter
 * emits out 'httpmetrics' event upon request/response metrics collection
 */
module.exports = new Appender();

