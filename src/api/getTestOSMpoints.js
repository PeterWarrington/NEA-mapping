fs = require('fs');

/**
 * Sends test points from JSON as JSON data back to the client.
 * @param {Object} shared The shared structures
 * @param {*} req 
 * @param {*} res 
 */
 module.exports.getTestOSMpoints = function (shared, req, res) {
    // Read file
    fs.readFile('.osmToJS_mapPoints2D.json', 'utf8' , (err, data) => {
        if (err) {
            const error='FILE_READ_ERROR (getTestOSMpoints)';
            res.status(500).send(error);
            module.exports.logger.log(error + "\n" + err.toString());
            return;
        }
 
        res.send(data);
    });
 }