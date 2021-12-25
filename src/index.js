//Load HTTP module

var express = require('express');
var fs = require('fs');
var app = express();
const hostname = '127.0.0.1';
const port = 80;
const options = {index: "index/index.html"};
const path = require("path");
var shared = require('./shared/sharedStructures.js').shared;

var logger = new (require('./logging.js').Logger)();

logger.log("Server is starting...");

// Using https://stackoverflow.com/a/29371929
app.use(function (req, res, next) {
    var filename = "/" + path.basename(req.url);
    logger.log(filename + " was requested.");
    next();
});

logger.log("Loading db.");
getData();
logger.log("Loaded db.");

app.get("/api/GetTestDB", (req, res) => require("./api/getTestDB.js").getTestDB(shared, req, res));
app.get("/api/GetTestOSMpoints", (req, res) => require("./api/getTestOSMpoints.js").getTestOSMpoints(shared, req, res));
app.get("/api/GetDBfromFile", (req, res) => require("./api/getDBfromFile.js").getDBfromFile(shared, req, res));
app.get("/api/GetDBfromQuery", (req, res) => require("./api/dbFromQuery.js").getDBfromQuery(shared, req, res));

app.use(express.static('web', options));
app.listen(port);

function getData() {
    // Read file
    data = fs.readFileSync('db.json', 'utf8');

    // Convert from JSON to MapDataObjectDB
    let simpleDB = JSON.parse(data);
    shared.database = shared.MapDataObjectDB.MapDataObjectDBFromObject(simpleDB);
    // shared.highwayPaths = require("./api/dbFromQuery.js").getHighwayPaths(shared);
}