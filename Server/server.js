const express = require('express');
const http = require('http');
const bodyParser= require('body-parser')
const MongoClient = require('mongodb').MongoClient
const mongoose = require('mongoose');

const C_DEVICE = "DEVICES";
const C_TEMPERATURE = "TEMPERATURE";
const NUM_NODES = 4;
const CLEAR_TIMEOUT = 5000;
const READ_TIMEOUT = 300000;
const ERROR_REFRESH = 2000;

const COLOURS = ["e6194b", "3cb44b", "ffe119", "0082c8", "f58231", "911eb4", "46f0f0", "d2f53c", "fabebe", "e6beff"];

var url = 'mongodb://localhost:27017/sensornet';
mongoose.connect(url);

var app = express();
app.use("/images", express.static(__dirname + '/images'));
app.use("/scripts", express.static(__dirname + '/scripts'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('Database connected and open');
});

var deviceSchema = mongoose.Schema({
    mac: String,
    ip: String,
    colourIndex: Number,
    pos: { x: Number, y: Number},
    name: String
});
var Device = mongoose.model('Device', deviceSchema);

var temperatureSchema = mongoose.Schema({
    mac: String,
    temperature: Number,
    timeStamp: Date 
});
var Temperature = mongoose.model('Temperature', temperatureSchema);

var deviceQueue = [];
var dataQueue = [];
var timeStamp;

function getServerIP() {

  var os = require('os');
  var ifaces = os.networkInterfaces();
  var values = Object.keys(ifaces).map(function(name) {
    return ifaces[name];
  });
  values = [].concat.apply([], values).filter(function(val) {
    return val.family == 'IPv4' && val.internal == false;
  });

  return values.length ? values[0].address : '0.0.0.0';
}

app.get('/', function(req, res) {
    console.log("Index request");
    res.sendFile('index.html', {root: __dirname })
});

app.get('/heatmap', function(req, res) {
    console.log("Heatmap request");
    res.sendFile('heatmap.html', {root: __dirname })
});

app.get('/data', function (req, res) {
  var start = new Date();
  var end = new Date();

  start.setHours(start.getHours() - 8);

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

app.get('/data/:mac', function (req, res) {
  var start = new Date();
  var end = new Date();

  start.setDate(start.getDate() - 5);
  start.setHours(7);
  start.setMinutes(30);

  Temperature
     .find({mac : new RegExp(req.params.mac)})
     .where('timeStamp').gte(start).lte(end)
     .sort({timeStamp:1})
     .exec(
        function(err, dataList) {
          if (err) res.status(500).send("Internal error: " + err);
          else {
              res.status(200).send({data: dataList});
          }
        });
});

app.get('/devices', function (req, res) {
  var start = new Date();
  var end = new Date();

  start.setHours(start.getHours() - 8);

  Device.find({}, function(err, deviceList) {
     if(err) res.status(500).send("Internal error: " + err);
     else {
         if (err) res.status(500).send("Internal error: " + err);
         else {
            res.status(200).send(deviceList);
         }
     }
  });
});

app.post('/device', function (req, res) {
  console.log(req.body.mac + " updated: " + JSON.stringify(req.body));
  Device.update({'mac':new RegExp(req.body.mac)}, {'$set': req.body}, function (err) {  
      if(err) {
          res.status(500).send("Internal error: " + err);
          console.log(err);
      } else {
        res.status(200).send('Success');
      }
  });
});

app.get('/clear', function (req, res) {
  
/*  Temperature.remove({}, function(err) {
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
      console.log("Updating IP");
      Device.update({'mac':new RegExp(req.query.mac)}, {'ip': req.query.ip}, function (err) {
          if(err) {
             res.status(500).send("Internal error: " + err);
             console.log(err);
          } else {
             res.status(202).send(COLOURS[deviceList[0].colourIndex]);
          }
      });
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

function getNextTimeout() {
    var date = new Date();
    var diff = Math.ceil(date.getMinutes()/5)*5;
    var nDate = new Date();
    nDate.setMinutes(diff);
    nDate.setSeconds(0);
    nDate.setMilliseconds(0);

    var timeOut = nDate.getTime() - date.getTime();
    if (timeOut < 0) {
        timeOut = READ_TIMEOUT + timeOut;
        nDate.setMilliseconds(nDate.getMilliseconds() + READ_TIMEOUT);
    }
    return timeOut;
}

function resetNode() {
    if (deviceQueue.length == 0) {
        var timeOut = getNextTimeout(); 
        console.log("Waiting " + timeOut + " millis ");
        setTimeout(readAllTemperatures, timeOut);
        return;
    }
    var url = deviceQueue.pop();
    console.log("Resetting: " + url);
    var options = { 
                    host: url,
                    path: "/reset"
                  };
    var request = http.get(options, function (response) {
        var data = "";
        response.on("data", function (chunk) {
            data += chunk;
        });

        response.on("end", function () {
            console.log("URL: [" + url + "] Response: " + data);
            if (data.toUpperCase().trim() != "SUCCESS") {
                console.log("   FAILED [" + url + "], SEARCHING AGAIN");
                deviceQueue.push(url);
            }
            resetNode();
        });
    });

    request.on('error', function (e) {
        console.log("   RESET FAILED [" + url + "], SEARCHING AGAIN. ERROR: [" + e + "]");
        deviceQueue.push(url);
        setTimeout(function() { resetNode(); }, ERROR_REFRESH);
    });
}

function readAllTemperatures() {
    console.log("Reading temperatures");
    timeStamp = new Date();
    timeStamp.setSeconds(0);
    timeStamp.setMilliseconds(0);
    deviceQueue = [];
    dataQueue = [];
    Device.find({}, function(err, deviceList) {
        for(var i = 0; i < deviceList.length; i++) {
            deviceQueue.push(deviceList[i].ip);
        }
        readNode();
    });
}

function readNode() {
    if (deviceQueue.length == 0) {
        saveElements();
        setTimeout(readAllTemperatures, getNextTimeout());
        return;
    }
    var url = deviceQueue.pop();
    console.log("Reading node: " + url);
    var options = {
                    host: url,
                    path: "/average"
                  };

    var request = http.get(options, function (response) {
        var data = "";
        response.on("data", function (chunk) {
            data += chunk;
        });

        response.on("end", function () {
            dataQueue.push(JSON.parse(data));
            console.log("URL: [" + url + "] Average temperature: " + data);
            readNode();
        });
    });
 
    request.on('error', function (e) {
        console.log("   READ FAILED [" + url + "], TRYING AGAIN. ERROR: [" + e + "]");
        setTimeout(function() { readAllTemperatures(); }, ERROR_REFRESH);
    });
}

function saveElements() {
    for (var i = 0; i < dataQueue.length; i++) {
        var dataPoint = dataQueue[i];
        dataPoint.timeStamp = timeStamp;
        var temperature = new Temperature({ mac: dataPoint.mac, temperature: dataPoint.average, timeStamp: dataPoint.timeStamp });
        temperature.save(function (err, tempInstance) {
            if (err) {
                console.error("Save temperature error: " + err);
                return;
            }
            console.log("        Saved: " + JSON.stringify(tempInstance));
        });
    }
}

var server = app.listen(3000, function () {
  var port = server.address().port;
  console.log("Server started: http://%s:%s", getServerIP(), port);
  /*
  Device.remove({}, function(err) {
   console.log("DB devices cleared");
  });
  Temperature.remove({}, function(err) {
   console.log("DB temperatures cleared");
  });
  */
  
  Device.count({}, function( err, count){
    var index = count;
    console.log("There are " + count + " devices");
    if ((count) >= NUM_NODES) nodesConnected();
  });
  
  Temperature.count({}, function( err, count){
    var index = count;
    console.log("There are " + count + " temperature entries");
  });
});
