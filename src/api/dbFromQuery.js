fs = require('fs');
logger = new (require('../logging.js').Logger)();

/**
 * Querys the database stored in a file based on parameters passed to API.
 * @param {Object} shared The shared structures
 * @param {*} req 
 * @param {*} res 
 */
 module.exports.getDBfromQuery = function (shared, req, res) {
    var databaseToReturn = new shared.MapDataObjectDB();

    // Get highways from db:
    let startTime = Date.now();

    paths = [];
    mapObjects = shared.database.getMapObjectsOfType("PATH");

    for (let i = 0; i < mapObjects.length; i++) {
        const object = mapObjects[i];
        var meetsCriteria = true;

        // Filter by highway
        var highwayError = false;
        var acceptedHighways = ["motorway","primary","trunk"];
        try {
            if (req.query.highways != undefined)
            acceptedHighways = JSON.parse(req.query.highways);
        } catch {
            highwayError = true;
        }
        

        if (highwayError || !(acceptedHighways instanceof Array)) {
            const error='INVALID_PARAM: highways (dbFromQuery)';
            res.status(400).send(error);
            return;
        }

        meetsCriteria = meetsCriteria && 
            (acceptedHighways.length == 0
                || acceptedHighways.includes(object.metadata.highway));

        // Filter by search term
        var searchTerm = false;
        if (req.query.searchTerm != false)
            searchTerm = req.query.searchTerm;
        
        meetsCriteria = meetsCriteria &&
            (!searchTerm || searchTerm == undefined ||
            JSON.stringify(object.metadata).includes(searchTerm));

        if (meetsCriteria) {
            paths.push(object)
        }
    }

    logger.log(`Query (part 1) took ${Date.now() - startTime} ms.`);

    paths.forEach(path => {
        path.copyPathContentsToDB(shared.database, databaseToReturn);
        databaseToReturn.addMapObject(path);
    });
    logger.log(`Query (parts 1&2) took ${Date.now() - startTime} ms.`);

    res.send(databaseToReturn);
 }