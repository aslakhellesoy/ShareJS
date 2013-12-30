var Duplex = require('stream').Duplex;
var format = require('util').format;
var http = require('http');
var connect = require('connect');
var argv = require('optimist').argv;
var livedb = require('livedb');
var livedbMongo = require('livedb-mongo');
var Primus = require('primus');

var sharejs = require('../lib');

var app = connect(
  connect.static(__dirname + '/public'),
  connect.static(sharejs.scriptsDir)
);
var server = http.createServer(app);
var primus = new Primus(server);

var backend = livedb.client(livedbMongo('localhost:27017/test?auto_reconnect', {safe:false}));
var share = sharejs.server.createClient({backend:backend});

primus.on('connection', function (spark) {
  var stream = new Duplex({objectMode: true});
  stream._write = function (chunk, encoding, callback) {
    console.log('s->c', chunk);
    // TODO: silently drop messages if spark is disconnected?
    spark.write(chunk);
    callback();
  };

  // See http://nodejs.org/api/stream.html#stream_readable_read_size_1
  // Especially how we interact with push.
  stream._read = function() {};

  spark.on('data', function (data) {
    console.log('c->s', data);
    stream.push(data);
  });

  stream.on('error', function (msg) {
    client.stop();
  });

  spark.on('close', function () {
    stream.emit('close');
    stream.emit('end');
    stream.end()
  });

  // ... and give the stream to ShareJS.
  share.listen(stream);
});

var port = argv.p || 7007;
server.listen(port);
console.log(format("Listening on http://localhost:%d/", port));

