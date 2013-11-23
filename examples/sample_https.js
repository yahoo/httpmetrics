/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
var https = require('https'),
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


var req = https.get('https://www.yahoo.com/');

req.on('response', function (res) {
    res.on('data', function (data) {
        //Do something with the data
    });
    res.on('end', function () {
    });
});


/*
//Running this example
node sample_https.js
=============================================================================================================
Sample response and details on metrics
=============================================================================================================
----------------------------------------------------------------------
Metrics for response
{ bodySize: 89735,
  firstChunkSize: 16384,
  firstChunkTransferTime: 57,
  headerSize: 589,
  statusCode: 200,
  totalTransferTime: 63,
  host: 'www.yahoo.com' }
----------------------------------------------------------------------
----------------------------------------------------------------------
Metrics for request
{ host: 'www.yahoo.com',
  connectTime: 45,
  firstChunkSize: 0,
  bodySize: 0,
  headerSize: 63 }
----------------------------------------------------------------------
=============================================================================================================
*/

