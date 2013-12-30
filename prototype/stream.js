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
  share.listen(sparkStream(spark));
});

function sparkStream(spark) {
  var Duplex = require('stream').Duplex;

  var stream = new Duplex({objectMode: true});

  stream._write = function (chunk, encoding, callback) {
    console.log('s->c', chunk);
    spark.write(chunk);
    callback();
  };

  stream._read = function() {};

  stream.on('error', function (msg) {
    client.stop();
  });

  spark.on('data', function (data) {
    console.log('c->s', data);
    stream.push(data);
  });

  spark.on('close', function () {
    stream.emit('close');
    stream.emit('end');
    stream.end()
  });

  return stream;
};

var port = argv.p || 7007;
server.listen(port);
console.log(format("Listening on http://localhost:%d/", port));

