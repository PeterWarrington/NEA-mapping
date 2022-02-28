//Load HTTP module

var express = require('express');
var fs = require('fs');
var app = express();
const hostname = 'localhost';
const port = 80;
const options = {index: "index/index.html"};
const path = require("path");
const JSONStream = require('JSONStream');
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
getData(() => {
    logger.log("Loaded db.");

    app.get("/api/GetTestDB", (req, res) => require("./api/getTestDB.js").getTestDB(shared, req, res));
    app.get("/api/GetTestOSMpoints", (req, res) => require("./api/getTestOSMpoints.js").getTestOSMpoints(shared, req, res));
    app.get("/api/GetDBfromFile", (req, res) => require("./api/getDBfromFile.js").getDBfromFile(shared, req, res));
    app.get("/api/GetDBfromQuery", (req, res) => require("./api/dbFromQuery.js").getDBfromQuery(shared, req, res));
    app.get("/api/PointSearch", (req, res) => require("./api/pointSearch.js").pointSearchAPI(shared, req, res));
    app.get("/api/FindRoute", (req, res) => require("./api/findRoute.js").findRoute(shared, req, res));

    app.use(express.static('web', options));
    app.use(express.static('shared', options));

    // Error handler
    app.use((err, req, res, next) => {
        logger.log(err.stack)
        res.status(500).send("error: misc");
    })

    app.listen(port);

    logger.log(`Server has started at http://${hostname}:${port}`);
});

function getData(callback) {
    // Read file
    data = fs.readFileSync('db.json', 'utf8');

    // Convert from JSON to MapDataObjectDB
    let simpleDB = JSON.parse(data);
    shared.database = shared.MapDataObjectDB.MapDataObjectDBFromObject(simpleDB);

    // Cache database data to grid
    shared.mapObjectsGridCache = new shared.MapGridCache(shared.database);
    shared.mapObjectsGridCache.gridSquareSize = 10;
    shared.mapObjectsGridCache.cacheDataToGrid();

    callback();
}

// // Read JSON (based on https://stackoverflow.com/a/49298376)
// function getData(callback) {
//     let readStream = fs.createReadStream('db.json', 'utf8');
//     let parser = JSONStream.parse(readStream);
//     readStream.pipe(parser);

//     parser.on('data', (simpleDB) => {
//         shared.database = shared.MapDataObjectDB.MapDataObjectDBFromObject(simpleDB);
//         // shared.highwayPaths = require("./api/dbFromQuery.js").getHighwayPaths(shared);

//         // Cache database data to grid
//         shared.mapObjectsGridCache = new shared.MapGridCache(shared.database);
//         shared.mapObjectsGridCache.gridSquareSize = 10;
//         shared.mapObjectsGridCache.cacheDataToGrid();
//         callback();
//     });
// }