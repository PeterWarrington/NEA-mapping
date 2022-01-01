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

    rootDBpaths = shared.database.getMapObjectsOfType("PATH");
    for (let i = 0; i < rootDBpaths.length; i++) {
        const path = rootDBpaths[i];
        var meetsCriteria = true;

        // These filter function calls return undefined if unsuccesful, where bool && undefined == undefined
        // Filter by highways
        meetsCriteria = meetsCriteria && filterByHighway(req, res, path);

        // Filter by search term
        meetsCriteria = meetsCriteria && filterBySearchTerm(req, res, path);

        if (meetsCriteria) {
            paths.push(path)
        } else if (meetsCriteria == undefined) return;
    }

    if (paths.length == rootDBpaths.length)
        // We are returning all the contents of the DB, no need to iterate through filtered paths
        databaseToReturn = shared.db;
    else
        paths.forEach(path => {
            path.copyPathContentsToDB(shared.database, databaseToReturn);
            databaseToReturn.addMapObject(path);
        });

    databaseToReturn = filterByMapArea(req, res, databaseToReturn);

    res.send(databaseToReturn);
 }

 function filterByHighway(req, res, path) {
    var highwayError = false;
    // var acceptedHighways = ["motorway","primary","trunk"];
    var acceptedHighways = [];

    try {
        if (req.query.highways != undefined)
        acceptedHighways = JSON.parse(req.query.highways);
    } catch {
        highwayError = true;
    }

    if (highwayError || !(acceptedHighways instanceof Array)) 
        return throwParamError("INVALID_PARAM: highways (dbFromQuery)", res);

    return (acceptedHighways.length == 0
            || acceptedHighways.includes(path.metadata.highway));
 }

 function filterBySearchTerm(req, res, path) {
    var searchTerm = false;
    if (req.query.searchTerm != false)
        searchTerm = req.query.searchTerm;
    
    return (!searchTerm || searchTerm == undefined ||
        JSON.stringify(path.metadata).includes(searchTerm));
 }

 // URL to test this: http://localhost/api/GetDBfromQuery?highways=[%22motorway%22,%22primary%22,%22trunk%22]&x=5332.999999999993&y=4692.4999999999945&height=2000&width=2000
 function filterByMapArea(req, res, db) {
     if (req.query.noMapAreaFilter) return db;

     // Filter by map area
     var x;
     var y;
     var height;
     var width;
     var mapAreaError = false;

     try {
         if (req.query.x != undefined)
             x = parseInt(req.query.x);
         else mapAreaError = true;

         if (req.query.y != undefined)
             y = parseInt(req.query.y);
         else mapAreaError = true;

         if (req.query.height != undefined)
             height = parseInt(req.query.height);
         else mapAreaError = true;

         if (req.query.width != undefined)
             width = parseInt(req.query.width);
         else mapAreaError = true;
     } catch {
         mapAreaError = true;
     }

     if (mapAreaError) return throwParamError("INVALID_PARAMS: mapArea (dbFromQuery)", res);

     // Find points in map area
     var filteredDB = new shared.MapDataObjectDB();
     var rootDBpoints = db.getMapObjectsOfType("POINT");

     for (let i = 0; i < rootDBpoints.length; i++) {
        const point = rootDBpoints[i];
        if (point.x >= x && point.x <= x + width &&
            point.y >= y && point.y <= y + height)
                filteredDB.addMapObject(point);
     }

     // Filter path parts to those that only contain filtered points
     var rootDBparts = db.getMapObjectsOfType("PART");

     for (let i = 0; i < rootDBparts.length; i++) {
         const part = rootDBparts[i];
         if (filteredDB.db[part.pointID] != undefined)
            filteredDB.addMapObject(part);
     }

     // Resolve path parts that point to path parts not in filtered list
     var filteredParts = filteredDB.getMapObjectsOfType("PART");
     for (let i = 0; i < filteredParts.length; i++) {
        const part = filteredParts[i];
        if (part.nextPathPartIDs.length != 0) {
            var pathPartID = resolvePathPartID(filteredDB, db, part.nextPathPartIDs[0]);

            if (pathPartID)
                part.nextPathPartIDs[0] = pathPartID;
            else part.nextPathPartIDs = [];
        }
     }

     // Resolve starting path parts of paths
     var rootDBpaths = db.getMapObjectsOfType("PATH");
     for (let i = 0; i < rootDBpaths.length; i++) {
         const path = shared.Path.pathFromObject(rootDBpaths[i]);
         path.startingPathPartID = resolvePathPartID(filteredDB, db, path.startingPathPartID);
         if (path.startingPathPartID)
            filteredDB.addMapObject(path);
     }

     return filteredDB;
 }

 function resolvePathPartID(filteredDB, db, pathPartID) {
    while (filteredDB.db[pathPartID] == undefined) {
        if (db.db[pathPartID].nextPathPartIDs.length != 0)
            pathPartID = db.db[pathPartID].nextPathPartIDs[0];
        else {
            // The path has ended, flag to replace with empty array
            pathPartID = false;
            break;
        }
    }
    return pathPartID;
 }

 function throwParamError(errorDesc, res) {
    res.status(400).send(errorDesc);
    return undefined;
 }