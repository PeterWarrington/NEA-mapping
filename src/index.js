//Load HTTP module

var express = require('express');
var app = express();
const hostname = '127.0.0.1';
const port = 80;
const options = {index: "index/index.html"};
const path = require("path");

var logger = new (require('./logging.js').Logger)();

// Using https://stackoverflow.com/a/29371929
app.use(function (req, res, next) {
    var filename = path.basename(req.url);
    var extension = path.extname(filename);
    if (extension === '.css')
        logger.log("The file " + filename + " was requested.");
    next();
});

app.use(express.static('web', options));
app.listen(port);