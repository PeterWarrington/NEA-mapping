fs = require('fs');
logger = new (require('../logging.js').Logger)();

// Used to count number of items filtered via highways for debugging
var debug_highwayFilterCount = 0;
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

    // Get highways from db:
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
        // Filter by highways
        meetsCriteria = meetsCriteria && filterByHighway(req, res, path, shared);

        if (meetsCriteria) {
            paths.push(path)
        } else if (meetsCriteria == undefined) return;
    }

    if (shared.debug_on) {
        logger.log(`Highway filtered database has ${debug_highwayFilterCount} paths.`);
        logger.log(`Highway and search filtered database has ${debug_searchFilterCount} paths.`)
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

    res.send(databaseToReturn);
 }

 function filterByHighway(req, res, path, shared) {
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


    let result = (acceptedHighways.length == 0
        || acceptedHighways.includes(path.metadata.pathType["second_level_descriptor"])
        || acceptedHighways.includes(path.metadata.pathType["first_level_descriptor"]));

    if (shared.debug_on && result) debug_highwayFilterCount++;

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

     // These variables refer to the area to exclude from results (because it has already been requested by the client)
     var excludeAreas = []

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
            outsideOfExcludeArea = outsideOfExcludeArea && (
                point.x <= excludeArea.x || point.x >= excludeArea.x + excludeArea.width ||
                point.y <= excludeArea.y || point.y >= excludeArea.y + excludeArea.height
            );
            if (!outsideOfExcludeArea) break;
        }
        
        if (point.y >= y && point.y <= y + height && outsideOfExcludeArea)
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

     // Filter areas to those that contain at least one node in viewed area
     let rootAreas = db.getMapObjectsOfType("AREA");
     for (let i = 0; i < rootAreas.length; i++) {
         let area = new shared.Area(rootAreas[i].mapPointIDs, rootAreas[i].data);
         area.ID = rootAreas[i].ID;

         let idsToRemove = [];
         let areaAddedToDB = false;

         for (let j = 0; j < area.mapPointIDs.length; j++) {
             const mapPointID = area.mapPointIDs[j];
             if (filteredDB.db[mapPointID] != undefined) {
                if (!areaAddedToDB)
                    filteredDB.addMapObject(area);
                areaAddedToDB = true;
             } else {
                idsToRemove.push(mapPointID);
             }
         }

         // Replace array with mapPointIDs that are not in idsToRemove
         area.mapPointIDs = area.mapPointIDs.filter(mapPointID => idsToRemove.indexOf(mapPointID) == -1);
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