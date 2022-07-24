fs = require('fs');
logger = new (require('../logging.js').Logger)();

// Used to count number of items filtered via pathTypes for debugging
var debug_pathTypeFilterCount = 0;
// Used to count number of items filtered via search term for debugging
var debug_searchFilterCount = 0;

/**
 * Querys the database stored in a file based on parameters passed to API.
 * @param {Object} shared The shared structures
 * @param {*} req 
 * @param {*} res 
 */
 module.exports.getDBfromQuery = function (shared, req, res) {
    var databaseToReturn = new shared.MapDataObjectDB();

    let startTime = Date.now();

    if (req.query.mapTilesOnly) {
        let tiles = shared.database.getMapObjectsOfType("TILE");
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            databaseToReturn.addMapObject(tile);
        }
    } else {
        // Get map db for area
        var areaDB = filterByMapArea(req, res, shared.database, shared);

        // Filter paths
        paths = [];
        rootDBpaths = areaDB.getMapObjectsOfType("PATH");
        for (let i = 0; i < rootDBpaths.length; i++) {
            const path = rootDBpaths[i];
            var meetsCriteria = true;

            // These filter function calls return undefined if unsuccesful, where bool && undefined == undefined
            // Filter by pathTypes
            meetsCriteria = meetsCriteria && filterByPathType(req, res, path, shared);

            if (meetsCriteria) {
                paths.push(path)
            } else if (meetsCriteria == undefined) return;
        }

        paths.forEach(path => {
            path.copyPathContentsToDB(areaDB, databaseToReturn);
            databaseToReturn.addMapObject(path);
        });
        
        areaDB.getMapObjectsOfType(["AREA", "COMPLEX-AREA-PART"]).forEach(area => {
            databaseToReturn.addMapObject(area);
            area.mapPointIDs.forEach(mapPointID => {
                let point = shared.database.db.get(mapPointID);
                if (point != undefined)
                databaseToReturn.addMapObject(point);
            });
        });

        areaDB.getMapObjectsOfType("COMPLEX-AREA").forEach(area => {
            databaseToReturn.addMapObject(area);
        });
    };

    let returnString = "";

    let dbKeys = Array.from(databaseToReturn.db.keys());
    
    returnString += `{"db":{`;
    for (let i = 0; i < dbKeys.length; i++) {
        const dbKey = dbKeys[i];
        returnString += `"${dbKey}":${JSON.stringify(databaseToReturn.db.get(dbKey))}`;
        if (i+1 < dbKeys.length) returnString += `,`;
    }

    returnString += "}}";
    res.send(returnString);
 }

 function filterByPathType(req, res, path, shared) {
    var pathTypeError = false;
    // var acceptedPathTypes = ["motorway","primary","trunk"];
    var acceptedPathTypes = [];

    try {
        if (req.query.pathTypes != undefined)
        acceptedPathTypes = JSON.parse(req.query.pathTypes);
    } catch {
        pathTypeError = true;
    }

    if (pathTypeError || !(acceptedPathTypes instanceof Array)) 
        return throwParamError("INVALID_PARAM: pathTypes (dbFromQuery)", res);

    containsSecondLevelDescriptor = path.metadata.pathType != undefined && path.metadata.pathType["second_level_descriptor"] != undefined && acceptedPathTypes.includes(path.metadata.pathType["second_level_descriptor"]);
    containsFirstLevelDescriptor = path.metadata.pathType != undefined && path.metadata.pathType["first_level_descriptor"] != undefined && acceptedPathTypes.includes(path.metadata.pathType["first_level_descriptor"]);

    let result = (acceptedPathTypes.length == 0
        || containsSecondLevelDescriptor
        || containsFirstLevelDescriptor);

    if (shared.debug_on && result) debug_pathTypeFilterCount++;

    return result;
 }

 function filterByMapArea(req, res, db, shared) {
     if (req.query.noMapAreaFilter) return db;

     // Filter by map area
     var x;
     var y;
     var height;
     var width;

     var mapAreaError = false;

     try {
         let area = req.query.area;
         if (area == undefined) mapAreaError = true;
         area = JSON.parse(area);

         if (area.x != undefined)
             x = parseInt(area.x);
         else mapAreaError = true;

         if (area.y != undefined)
             y = parseInt(area.y);
         else mapAreaError = true;

         if (area.height != undefined)
             height = parseInt(area.height);
         else mapAreaError = true;

         if (area.width != undefined)
             width = parseInt(area.width);
         else mapAreaError = true;
     } catch (err) {
         mapAreaError = true;
     }

     if (mapAreaError) return throwParamError("INVALID_PARAMS: mapArea (dbFromQuery)", res);

     var filteredDB = new shared.MapDataObjectDB();

     // Find objects in map area
     var idsInArea = shared.mapObjectsGridCache.getSquareContentInBounds(x, y, width, height);

     for (let i = 0; i < idsInArea.length; i++) {
        const objectID = idsInArea[i];
        let mapObject = db.db.get(objectID);

        if (mapObject == undefined)
            continue;

        filteredDB.addMapObject(mapObject);

        // If path, add whole path, its parts and points to db
        if (mapObject instanceof shared.Path) {
            let path = mapObject;
            path.copyPathContentsToDB(db, filteredDB);
        }
     }

     return filteredDB;
 }

 function throwParamError(errorDesc, res) {
    res.status(400).send(errorDesc);
    return undefined;
 }