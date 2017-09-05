const express = require('express');
const http = require('http');
const bodyParser= require('body-parser')
const MongoClient = require('mongodb').MongoClient
const mongoose = require('mongoose');

const C_DEVICE = "DEVICES";
const C_TEMPERATURE = "TEMPERATURE";
const NUM_NODES = 2;
const CLEAR_TIMEOUT = 5000;
const READ_TIMEOUT = 30000;//120000;

const COLOURS = ["e6194b", "3cb44b", "ffe119", "0082c8", "f58231", "911eb4", "46f0f0", "d2f53c", "fabebe", "e6beff"];

var url = 'mongodb://localhost:27017/sensornet';
mongoose.connect(url);

var app = express();
app.use("/images", express.static(__dirname + '/images'));
app.use("/scripts", express.static(__dirname + '/scripts'));
app.use(bodyParser.urlencoded({extended: true}));

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

var temperatureSchema = mongoose.Schema({
    mac: String,
    temperature: Number,
    timeStamp: Date 
});
var Temperature = mongoose.model('Temperature', temperatureSchema);

var deviceQueue = [];
var timeStamp;

app.get('/', function(req, res) {
    res.sendFile('index.html', {root: __dirname })
});

app.get('/data', function (req, res) {
  console.log("Getting data");
  // do something with db
  var start = new Date();
  var end = new Date();
  start.setDate(4);
  start.setFullYear(2017);
  start.setMonth(8);
  start.setHours(8);
  start.setMinutes(0);
  start.setSeconds(0);

  end.setDate(4);
  end.setFullYear(2017);
  end.setMonth(8);
  end.setHours(18);
  end.setMinutes(0);
  end.setSeconds(0);
  /*
  Temperature.find({}, function(err, dataList) {
      console.log(JSON.stringify(dataList));
  });
  */
  Device.find({}, function(err, deviceList) {
     if(err) res.status(500).send("Internal error: " + err);
     else {
       Temperature
          .find({})
          .where('timeStamp').gte(start).lte(end)
          .sort({mac:1, timeStamp:1})
          .exec(
              function(err, dataList) {
                  if (err) res.status(500).send("Internal error: " + err);
                  else {
                      res.status(200).send({devices: deviceList, data: dataList});
                  }
              }); 
     }
  });
});

app.get('/clear', function (req, res) {
  /*
  Temperature.remove({}, function(err) {
   console.log("Temp cleared!");
  });
  Device.remove({}, function(err) {
   res.status(202).send("You called it");
  });
 */
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
        device.save(function (err, deviceInstance) {
          if (err) {
            res.status(500).send("Internal error");
            return console.error(err);
          }
          res.status(202).send(COLOURS[index]);
          if ((count + 1) >= NUM_NODES) nodesConnected(); 
        });
      });
    } else {
      res.status(202).send(COLOURS[deviceList[0].colourIndex]);
      console.log("  Colour index: %s", deviceList[0].colourIndex); 
    }
  });
});

function nodesConnected() {
    console.log("All my nodes have been connected");
    setTimeout(resetAllTemperatures, CLEAR_TIMEOUT);
}

function resetAllTemperatures() {
    console.log("Resetting temperatures");
    Device.find({}, function(err, deviceList) {
        for(var i = 0; i < deviceList.length; i++) {
            deviceQueue.push(deviceList[i].ip);
        }
        resetNode();
    });
}

function resetNode() {
    if (deviceQueue.length == 0) {
        setTimeout(readAllTemperatures, READ_TIMEOUT);
        return;
    }
    var url = deviceQueue.pop();
    console.log("Resetting: " + url);
    var options = { 
                    host: url,
                    path: "/reset"
                  };
    http.get(options, function (response) {
        var data = "";
        response.on("data", function (chunk) {
            data += chunk;
        });

        response.on("end", function () {
            console.log("URL: [" + url + "] Response: " + data);
            resetNode();
        });
    });
}

function readAllTemperatures() {
    console.log("Reading temperatures");
    timeStamp = new Date();
    Device.find({}, function(err, deviceList) {
        for(var i = 0; i < deviceList.length; i++) {
            deviceQueue.push(deviceList[i].ip);
        }
        readNode();
    });
}

function readNode() {
    if (deviceQueue.length == 0) {
        setTimeout(readAllTemperatures, READ_TIMEOUT);
        return;
    }
    var url = deviceQueue.pop();
    console.log("Reading node: " + url);
    var options = {
                    host: url,
                    path: "/average"
                  };
    http.get(options, function (response) {
        var data = "";
        response.on("data", function (chunk) {
            data += chunk;
        });

        response.on("end", function () {
            saveElement(JSON.parse(data));
            console.log("URL: [" + url + "] Average temperature: " + data);
            readNode();
        });
    });
}

function saveElement(dataPoint) {
    dataPoint.timeStamp = timeStamp;
    console.log("        Saving: " + JSON.stringify(dataPoint));
    var temperature = new Temperature({ mac: dataPoint.mac, temperature: dataPoint.average, timeStamp: dataPoint.timeStamp });
    temperature.save(function (err, deviceInstance) {
      if (err) {
        console.error("Save temperature error: " + err);
        return;
      }
      console.log("        Saved!");
    });
}

app.listen(3000, function () {
  console.log('Server started on port 3000!');
  /*
  Device.remove({}, function(err) {
   console.log("DB devices cleared");
  });
  Temperature.remove({}, function(err) {
   console.log("DB temperatures cleared");
  });
  */
  /*
  Device.count({}, function( err, count){
    var index = count;
    console.log("There are " + count + " devices");
    if ((count) >= NUM_NODES) nodesConnected();
  });
  */
  Temperature.count({}, function( err, count){
    var index = count;
    console.log("There are " + count + " temperature entries");
  });
});
