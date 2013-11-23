/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
var mockery = require('mockery'),
    events = require('events'),
    timer = require('timers'),
    Stream = require('stream'),
    vows = require('vows'),
    assert = require('assert');


var sutPath = '../lib/httpmetrics.js';

var httpMock = {
    testMetrics : {
        'ClientRequest' : {
            'onSocket' : {}
        },
        'IncomingMessage' : {
            'emitevents' : {}
        },
        'OutgoingMessage' : {
            '_send' : {}
        }
    },

    ClientRequest: function () {
    },

    IncomingMessage: function () {
        Stream.call(this);
    },

    OutgoingMessage: function () {
        Stream.call(this);
    }

};
require('util').inherits(httpMock.OutgoingMessage, Stream);
require('util').inherits(httpMock.IncomingMessage, Stream);

httpMock.IncomingMessage.prototype.headers = "headers";
httpMock.IncomingMessage.prototype.statusCode = 200;
httpMock.IncomingMessage.prototype.socket = {
    'socketConnectTime' : 200
};
/*jslint nomen: true*/
httpMock.OutgoingMessage.prototype._header = "headers";
httpMock.OutgoingMessage.prototype.ymetrics = null;

httpMock.ClientRequest.prototype.onSocket = function () {
    httpMock.testMetrics.ClientRequest.onSocket = this.ymetrics;
};

httpMock.ClientRequest.prototype._headers = {
    "host" : "localhost"
};

httpMock.IncomingMessage.prototype.ymetrics = null;
httpMock.IncomingMessage.prototype._emitevents = function (data) {
    this.ymetrics = null;
    this.socket = {
        'ymetrics' : {
            'type': 'outbound',
            'host': 'localhost',
            'onSocketTime': Date.now()
        }
    };
    this.emit('finish');
    this.emit('random');
    this.emit('data', data);
    this.emit('data', data);
    this.emit('end');
    httpMock.testMetrics.IncomingMessage._emitevents = this.ymetrics;
};
httpMock.OutgoingMessage.prototype._send = function () {
    this.emit('finish');
    httpMock.testMetrics.OutgoingMessage._send = this.ymetrics;
};

var setUp = function () {
    mockery.enable();
    mockery.registerAllowable(sutPath);
    mockery.registerMock('http', httpMock);
    httpMock.OutgoingMessage.prototype.ymetrics = null;
    httpMock.IncomingMessage.prototype.ymetrics = null;

    var modulePath = require.resolve(sutPath);
    delete require.cache[modulePath];
}

var tearDown = function () {
    mockery.deregisterAll();
    mockery.disable();
}

var tests = {

    //---------------------------------------------
    // Tests
    //---------------------------------------------

    'testing _send': {
        topic: function () {
            setUp();
            var ModHttp = require(sutPath),
                sut = ModHttp.appendHttpMetrics(),
                data = "test data",
                dataSize = data.length,
                req = {
                    'mod_config': {
                        'enable' : 'true'
                    }
                };

                httpMock.OutgoingMessage.prototype._send(data, "utf8");
                httpMock.OutgoingMessage.prototype._send(data, "utf8");
                return {
                    'data': data,
                };
        },
        'test mock received data': function (topic) {
            var dataSize = topic.data.length;
            assert.ok(httpMock.testMetrics.OutgoingMessage._send !== null);
            assert.equal(dataSize, httpMock.testMetrics.OutgoingMessage._send.firstChunkSize);
            assert.equal(dataSize * 2, httpMock.testMetrics.OutgoingMessage._send.bodySize);    
        },
        tearDown: function() {
            tearDown();
        }
        
    },

    'testing incomingmessage': {
        topic: function () {
            var ModHttp = require(sutPath),
                sut = ModHttp.appendHttpMetrics(),
                that = this,
                data = "test data",
                dataSize = data.length,
                req = {
                    'mod_config': {
                        'enable' : 'true'
                    }
                };
            httpMock.IncomingMessage.prototype._emitevents(data);
            return {};
        },
        'test mock received events': function (topic) {
            assert.ok(httpMock.testMetrics.IncomingMessage._emitevents !== null);
            assert.equal(httpMock.IncomingMessage.prototype.statusCode,
                httpMock.testMetrics.IncomingMessage._emitevents.statusCode);
        },
        tearDown: function () {
            tearDown();
        }
    },

    'testing incomingmessage hookfunction': {
        topic: function () {

            var ModHttp = require(sutPath),
                hookcalled = false,
                sut = ModHttp.appendHttpMetrics(),
                that = this,
                data = "test data",
                dataSize = data.length,
                req = {
                    'mod_config': {
                        'enable' : 'true'
                    }
                },
                self = this;

            ModHttp.on('httpmetrics', function (metricsType, metrics) {
                self.callback(null, {
                    metricsType: metricsType,
                    metrics: metrics,
                    hookcalled: true
                });
            });
            httpMock.IncomingMessage.prototype._emitevents(data);
        },
        'test hookfunction received metrics' : function (topic) {
            assert.equal(httpMock.IncomingMessage.prototype.statusCode,
                topic.metrics.statusCode);
            assert.equal('response', topic.metricsType);
            assert.ok(httpMock.testMetrics.IncomingMessage._emitevents !== null);
            assert.ok(httpMock.testMetrics.IncomingMessage.bodySize !== null);
            assert.ok(httpMock.testMetrics.IncomingMessage.firstChunkSize !== null);
            assert.ok(httpMock.testMetrics.IncomingMessage.firstChunkTranserTime !== null);
            assert.ok(httpMock.testMetrics.IncomingMessage.headerSize !== null);
            assert.ok(httpMock.testMetrics.IncomingMessage.statusCode !== null);
            assert.ok(httpMock.testMetrics.IncomingMessage.totalTransferTime !== null);
            assert.ok(httpMock.testMetrics.IncomingMessage.host !== null);
            assert.equal(httpMock.IncomingMessage.prototype.statusCode,
                httpMock.testMetrics.IncomingMessage._emitevents.statusCode);
            assert.ok(topic.hookcalled === true);
        },
        tearDown: function () {
            tearDown();
        }
        
    },

    'testing onSocket': {
        topic: function () {
            var ModHttp = require(sutPath),
                sut = ModHttp.appendHttpMetrics(),
                that = this,
                delay = 200,
                req = {
                    'mod_config': {
                        'enable' : 'true'
                    }
                },
                socket = new events.EventEmitter(),
                self = this;
            httpMock.ClientRequest.prototype.onSocket(socket);

            timer.setTimeout(function () {
                    //Emit connect event after 'delay' milliseconds
                    //Our metrics should indicate that value
                socket.emit('connect');
                self.callback(null, {
                    socket: socket,
                    delay: delay
                });
            }, delay + 1);
        },
        'test socket data': function (topic) {
            assert.ok(topic.socket.socketConnectTime !== null);
            assert.ok(httpMock.testMetrics.ClientRequest.onSocket !== null);
            assert.equal('localhost', httpMock.testMetrics.ClientRequest.onSocket.host);
            assert.ok(httpMock.testMetrics.ClientRequest.onSocket.connectTime >= topic.delay);
            
        },
        tearDown: function () {
            tearDown();
        }

    },
    'testing onSocket for secureConnect': {
        topic: function () {
            var ModHttp = require(sutPath),
                sut = ModHttp.appendHttpMetrics(),
                that = this,
                delay = 200,
                req = {
                    'mod_config': {
                        'enable' : 'true'
                    }
                },
                socket = new events.EventEmitter(),
                self = this;
            httpMock.ClientRequest.prototype.onSocket(socket);

            timer.setTimeout(function () {
                    //Emit connect event after 'delay' milliseconds
                    //Our metrics should indicate that value
                socket.emit('secureConnect');
                self.callback(null, {
                    socket: socket,
                    delay: delay
                });
            }, delay + 1);
        },
        'test socket data': function (topic) {
            assert.ok(topic.socket.socketConnectTime !== null);
            assert.ok(httpMock.testMetrics.ClientRequest.onSocket !== null);
            assert.equal('localhost', httpMock.testMetrics.ClientRequest.onSocket.host);
            assert.ok(httpMock.testMetrics.ClientRequest.onSocket.connectTime >= topic.delay);
            
        },
        tearDown: function () {
            tearDown();
        }

    },

    'testing onSocket free': {
        topic: function () {
            setUp();
            var ModHttp = require(sutPath),
                hookcalled = false,
                sut = ModHttp.appendHttpMetrics(),
                that = this,
                delay = 200,
                req = {
                    'mod_config': {
                        'enable' : 'true'
                    }
                },
                socket = new events.EventEmitter(),
                self = this;

            httpMock.ClientRequest.prototype.onSocket(socket);
            socket.emit('free');
            self.callback(null, {
                socket:socket
            })
        },
        'test socket received free event': function (topic) {
            assert.ok(topic.socket.socketConnectTime !== null);
            assert.ok(httpMock.testMetrics.ClientRequest.onSocket !== null);
        },
        tearDown: function() {
            tearDown();
        }
    }
}

vows.describe('httpmetrics').addBatch(tests).export(module);


// vim:ts=4 sw=4 et
