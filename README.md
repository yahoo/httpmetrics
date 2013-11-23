# httpmetrics

Nodejs module that reports metrics, both for request and response, to outgoing HTTP/HTTPS connections made from the app.
The module hooks into the HTTP methods of node to compute metrics.
Upon completing outgoing request, module emits 'httpmetrics' event with 'request' as metric type.
Upon receiving a response back on the socket, module emits 'httpmetrics' event with 'response' as metric type.

```
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
```

This package is tested only with Node versions 8 and 10.

# install

With [npm](http://npmjs.org) do:

```
npm install httpmetrics
```

# usage
```js
var httpmetrics = require('httpmetrics');

//Start collecting metrics
httpmetrics.appendHttpMetrics();

httpmetrics.on('httpmetrics', function(metricType, metrics) {
    //metricType = request / response
    //metrics = corresponding metrics
});

```

# example

Please refer to the examples/httpmetrics-app.js for details

# Build Status

[![Build Status](https://secure.travis-ci.org/yahoo/httpmetrics.png?branch=master)](http://travis-ci.org/yahoo/httpmetrics)

# Node Badge

[![NPM](https://nodei.co/npm/httpmetrics.png)](https://nodei.co/npm/httpmetrics/)



