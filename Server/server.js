const express = require('express');
const bodyParser= require('body-parser')
const MongoClient = require('mongodb').MongoClient

var app = express();
app.use("/scripts", express.static(__dirname + '/scripts'));
app.use(bodyParser.urlencoded({extended: true}))

app.get('/', function(req, res) {
    res.sendFile('index.html', {root: __dirname })
});

app.listen(3000, function() {
  console.log('Server running on port 3000')
})

MongoClient.connect('link-to-mongodb', (err, database) => {
  // ... start the server
})
