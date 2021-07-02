//Load HTTP module

var express = require('express');
var app = express();
const hostname = '127.0.0.1';
const port = 80;
const options = {index: "index/index.html"};

app.use(express.static('web', options));
app.listen(port);