const express = require('express');
const bodyParser= require('body-parser')
const MongoClient = require('mongodb').MongoClient
const mongoose = require('mongoose');

const C_DEVICE = "DEVICES";
const C_TEMPERATURE = "TEMPERATURE";

const COLOURS = ["e6194b", "3cb44b", "ffe119", "0082c8", "f58231", "911eb4", "46f0f0", "d2f53c", "fabebe", "e6beff"];

var url = 'mongodb://localhost:27017/sensornet';
mongoose.connect(url);

var app = express();
app.use("/scripts", express.static(__dirname + '/scripts'));
app.use(bodyParser.urlencoded({extended: true}))

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('Database connected and open');
});

var deviceSchema = mongoose.Schema({
    mac: String,
    ip: String,
    colourIndex: Number
});
var Device = mongoose.model('Device', deviceSchema);

app.get('/', function(req, res) {
    res.sendFile('index.html', {root: __dirname })
});

app.get('/data', function (req, res) {
  // do something with db
  res.send('Node.js and MongoDB up and running');
});

app.get('/clear', function (req, res) {
  Device.remove({}, function(err) {
   res.status(202).send("You called it");
  });
});

app.get('/register', function (req, res) {
  console.log("Registration: ");
  console.log("    MAC: " + req.query.mac);
  console.log("    IP : " + req.query.ip);
  Device.find({ mac: new RegExp(req.query.mac) }, function(err, deviceList) {
    if (err || deviceList.length == 0) {
      console.log("  Cannot find " + req.query.mac + ": " + err);
      Device.count({}, function( err, count){
        var index = count;
        console.log("There are " + count + " devices, adding another");
        var device = new Device({ mac: req.query.mac, ip: req.query.ip, colourIndex: index });
        device.save(function (err, fluffy) {
          if (err) {
            res.status(500).send("Internal error");
            return console.error(err);
          }
          res.status(202).send(COLOURS[index]);
        });
      });
    } else {
      res.status(202).send(COLOURS[deviceList[0].colourIndex]);
      console.log("  Colour index: %s", deviceList[0].colourIndex); 
    }
  });
});

app.listen(3000, function () {
  console.log('Server started on port 3000!');
});
