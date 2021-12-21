fs = require('fs');

/**
 * Sends test points from JSON as JSON data back to the client.
 * @param {Object} shared The shared structures
 * @param {*} req 
 * @param {*} res 
 */
 module.exports.getDBfromFile = function (shared, req, res) {
    // Read file
    fs.readFile('db.json', 'utf8' , (err, data) => {
        if (err) {
            const error='FILE_READ_ERROR (getDBfromFile)';
            res.status(500).send(error);
            module.exports.Logger.log(error + "\n" + err.toString());
            return;
        }
 
        res.send(data);
    });
 }