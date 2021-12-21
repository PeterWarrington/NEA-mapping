//Load HTTP module

var express = require('express');
var app = express();
const hostname = '127.0.0.1';
const port = 80;
const options = {index: "index/index.html"};
const path = require("path");
var shared = require('./shared/sharedStructures.js').shared;

var logger = new (require('./logging.js').Logger)();

module.exports.logger = logger;

// Using https://stackoverflow.com/a/29371929
app.use(function (req, res, next) {
    var filename = "/" + path.basename(req.url);
    logger.log(filename + " was requested.");
    next();
});

app.get("/api/GetTestDB", (req, res) => require("./api/getTestDB.js").getTestDB(shared, req, res));
app.get("/api/GetTestOSMpoints", (req, res) => require("./api/getTestOSMpoints.js").getTestOSMpoints(shared, req, res));
app.get("/api/GetDBfromFile", (req, res) => require("./api/getDBfromFile.js").getDBfromFile(shared, req, res));

app.use(express.static('web', options));
app.listen(port);