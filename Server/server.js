const express = require('express');
const bodyParser= require('body-parser')
const MongoClient = require('mongodb').MongoClient
var url = 'mongodb://localhost:27017/sensornet';

var app = express();
app.use("/scripts", express.static(__dirname + '/scripts'));
app.use(bodyParser.urlencoded({extended: true}))

function connect(url) {
  return new Promise(function(resolve, reject) {
    MongoClient.connect(url, function(err, db) {
      if (err) {
        console.error('mongo connection error: ', err.message);
        reject(err);
      } else {
        console.info("connected to mongodb");
        resolve(db);
      }
    });
  });
}

app.get('/', function(req, res) {
    res.sendFile('index.html', {root: __dirname })
});

connect(url).then(function(db) {
  app.get('/data', function (req, res) {
    // do something with db
    res.send('Node.js and MongoDB up and running');
  });

  app.listen(3000, function () {
    console.log('Server started on port 3000!');
  });
}, function(err) {
  console.error(err);
});

