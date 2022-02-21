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

    if (shared.debug_on) 
        logger.log(`Root database has ${Object.keys(shared.database.db).length} items.`);
        
    let startTime = Date.now();

    // Filter everything with search term
    if (req.query.searchTerm != undefined && req.query.searchTerm != false) {
        let dbObjects = Object.values(shared.database.db);
        let dbObjectsLength = dbObjects.length;
        for (let i = 0; i < dbObjectsLength; i++) {
            const mapObject = dbObjects[i];
            if (filterBySearchTerm(req, res, mapObject, shared)) databaseToReturn.addMapObject(mapObject);
        }
    }

    // Filter paths
    paths = [];
    rootDBpaths = shared.database.getMapObjectsOfType("PATH");
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

    if (shared.debug_on) {
        logger.log(`PathType filtered database has ${debug_pathTypeFilterCount} paths.`);
        logger.log(`PathType and search filtered database has ${debug_searchFilterCount} paths.`)
    }

    if (paths.length == rootDBpaths.length)
        // We are returning all the contents of the DB, no need to iterate through filtered paths
        databaseToReturn = shared.database;
    else
        paths.forEach(path => {
            path.copyPathContentsToDB(shared.database, databaseToReturn);
            databaseToReturn.addMapObject(path);
        });
    
    shared.database.getMapObjectsOfType("AREA").forEach(area => {
        databaseToReturn.addMapObject(area);
        area.mapPointIDs.forEach(mapPointID => databaseToReturn.addMapObject(shared.database.db[mapPointID]));
    });

    if (shared.debug_on)
        logger.log(`Unfiltered database has ${databaseToReturn.getMapObjectsOfType("AREA").length} areas.`);

    databaseToReturn = filterByMapArea(req, res, databaseToReturn);

    if (shared.debug_on)
        logger.log(`Filtered database has ${databaseToReturn.getMapObjectsOfType("AREA").length} areas.`);
    
    if (shared.debug_on) 
        logger.log(`Fully filtered database has ${databaseToReturn.getMapObjectsOfType("PATH").length} paths.`);


    let returnString = "";

    let dbKeys = Object.keys(databaseToReturn.db);
    
    returnString += `{"db":{`;
    for (let i = 0; i < dbKeys.length; i++) {
        const dbKey = dbKeys[i];
        returnString += `"${dbKey}":${JSON.stringify(databaseToReturn.db[dbKey])}`;
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


    let result = (acceptedPathTypes.length == 0
        || acceptedPathTypes.includes(path.metadata.pathType["second_level_descriptor"])
        || acceptedPathTypes.includes(path.metadata.pathType["first_level_descriptor"]));

    if (shared.debug_on && result) debug_pathTypeFilterCount++;

    return result;
 }

 function filterBySearchTerm(req, res, mapObject, shared) {
    var searchTerm = false;
    if (req.query.searchTerm != false)
        searchTerm = req.query.searchTerm;
    
    let result = (!searchTerm || searchTerm == undefined ||
        JSON.stringify(mapObject.metadata).toLowerCase().includes(searchTerm.toLowerCase()));

    if (shared.debug_on && result) debug_searchFilterCount++;

    return result;
 }

 function filterByMapArea(req, res, db) {
     if (req.query.noMapAreaFilter) return db;

     // Filter by map area
     var x;
     var y;
     var height;
     var width;
     var pathTypeCount;

     // These variables refer to the area to exclude from results (because it has already been requested by the client)
     var excludeAreas = []

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

         if (area.pathTypeCount != undefined)
             pathTypeCount = parseInt(area.pathTypeCount);
         else mapAreaError = true;

         if (JSON.parse(req.query.excludeAreas) instanceof Array)
            excludeAreas = JSON.parse(req.query.excludeAreas)

         if (excludeAreas.length > 0 && 
            (isNaN(excludeAreas.at(-1).x) || isNaN(excludeAreas.at(-1).y) ||
            isNaN(excludeAreas.at(-1).height) || isNaN(excludeAreas.at(-1).width)))
            mapAreaError = true;
     } catch (err) {
         mapAreaError = true;
     }

     if (mapAreaError) return throwParamError("INVALID_PARAMS: mapArea (dbFromQuery)", res);

     // Find points in map area
     var filteredDB = new shared.MapDataObjectDB();
     var rootDBpoints = db.getMapObjectsOfType("POINT");

     for (let i = 0; i < rootDBpoints.length; i++) {
        const point = rootDBpoints[i];

        var outsideOfExcludeArea = true;
        for (let a = 0; a < excludeAreas.length; a++) {
            const excludeArea = excludeAreas[a];
            outsideOfExcludeArea = outsideOfExcludeArea && (excludeArea.pathTypeCount < pathTypeCount ||
                (point.x <= excludeArea.x || point.x >= excludeArea.x + excludeArea.width ||
                point.y <= excludeArea.y || point.y >= excludeArea.y + excludeArea.height)
            );
            if (!outsideOfExcludeArea) break;
        }
        
        if (outsideOfExcludeArea && point.y >= y && point.y <= y + height
            && point.x >= x && point.x <= x + width)
            filteredDB.addMapObject(point);
     }

     // Filter path parts to those that only contain filtered points
     var rootDBparts = db.getMapObjectsOfType("PART");

     for (let i = 0; i < rootDBparts.length; i++) {
         const part = rootDBparts[i];
         if (filteredDB.db[part.pointID] != undefined)
            filteredDB.addMapObject(part);
     }

     // Add whole path, its parts and points to DB if part of path is in DB
     var rootDBpaths = db.getMapObjectsOfType("PATH");
     for (let i = 0; i < rootDBpaths.length; i++) {
         const path = shared.Path.pathFromObject(rootDBpaths[i]);

         let resolvedPathPart = resolvePathPartID(filteredDB, db, path.startingPathPartID);
         let partOfPathInFilteredDB = resolvedPathPart != false;

         if (partOfPathInFilteredDB) {
            // Iterate through path parts, adding point and path part to DB before adding path
            let currentPathPartID = path.startingPathPartID;
            let getCurrentPathPart = () => db.db[currentPathPartID];
            let getCurrentPointID = () => getCurrentPathPart().pointID;
            do {
                if (filteredDB.db[getCurrentPointID()] == undefined) {
                    filteredDB.addMapObject(db.db[getCurrentPointID()]);
                }
                filteredDB.addMapObject(getCurrentPathPart());
                currentPathPartID = getCurrentPathPart().nextPathPartIDs[0];
            } while (getCurrentPathPart() != undefined);
            filteredDB.addMapObject(path);
         }
     }

     // Filter areas to those that contain at least one node in viewed area
     let rootAreas = db.getMapObjectsOfType("AREA");
     for (let i = 0; i < rootAreas.length; i++) {
         let area = new shared.Area(rootAreas[i].mapPointIDs, rootAreas[i].data);
         area.ID = rootAreas[i].ID;
         area.metadata = rootAreas[i].metadata;

         let idsToRemove = [];
         let areaAddedToDB = false;

         for (let j = 0; j < area.mapPointIDs.length; j++) {
             const mapPointID = area.mapPointIDs[j];
             if (filteredDB.db[mapPointID] != undefined) {
                if (!areaAddedToDB)
                    filteredDB.addMapObject(area);
                areaAddedToDB = true;
             }
         }

         // Add those nodes that are not in displayed region but are part of Area
         if (areaAddedToDB)
         for (let j = 0; j < area.mapPointIDs.length; j++) {
            const mapPointID = area.mapPointIDs[j];
            if (filteredDB.db[mapPointID] == undefined)
                filteredDB.addMapObject(db.db[mapPointID]);
        }

         // Replace array with mapPointIDs that are not in idsToRemove
         area.mapPointIDs = area.mapPointIDs.filter(mapPointID => idsToRemove.indexOf(mapPointID) == -1);
     }

     return filteredDB;
 }

 /**
  * If a pathPart contains a point that isn't in filteredDB, return the next pathPartID in chain that is.
  * @param {*} filteredDB 
  * @param {*} db 
  * @param {*} pathPartID 
  * @returns {string} pathPartID
  */
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