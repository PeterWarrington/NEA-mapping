//Load HTTP module

var express = require('express');
var app = express();
const hostname = '127.0.0.1';
const port = 80;
const options = {index: "index/index.html"};
const path = require("path");
var shared = require('./shared/sharedStructures.js').shared;

var logger = new (require('./logging.js').Logger)();

// Using https://stackoverflow.com/a/29371929
app.use(function (req, res, next) {
    var filename = "/" + path.basename(req.url);
    logger.log(filename + " was requested.");
    next();
});

app.get("/api/GetPaths", (req, res) => require("./api/getPaths.js").getPaths(shared, req, res));

app.use(express.static('web', options));
app.listen(port);