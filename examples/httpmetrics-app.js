/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
var http = require('http'),
    httpmetrics = require('..');


//Invoke the metrics collection module
//Once done, all http outbound requests are going to get 
//'metrics' object attached to the outgoing request and
//incoming response
httpmetrics.appendHttpMetrics();

httpmetrics.on('httpmetrics', function (metricType, metrics) {
    console.error('----------------------------------------------------------------------');
    console.error('Metrics for ' + metricType);
    console.error(metrics);
    console.error('----------------------------------------------------------------------');
});


var options = {
        host: 'www.yahoo.com'
    },
    req = http.get(options);

req.on('response', function (res) {
    res.on('data', function (data) {
        //Do something with the data
    });
    res.on('end', function () {
    });
});


/*
//Running this example
node httpmetrics-app.js
=============================================================================================================
Sample response and details on metrics
=============================================================================================================
----------------------------------------------------------------------
Metrics for response
{ bodySize: 86231,
  firstChunkSize: 882,
  firstChunkTransferTime: 79,
  headerSize: 588,
  statusCode: 200,
  totalTransferTime: 200,
  host: 'www.yahoo.com' }
----------------------------------------------------------------------
----------------------------------------------------------------------
Metrics for request
{ host: 'www.yahoo.com',
  connectTime: 49,
  firstChunkSize: 0,
  bodySize: 0,
  headerSize: 63 }
----------------------------------------------------------------------
=============================================================================================================
*/

