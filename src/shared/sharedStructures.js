shared = {};

// If running on backend, make accessible
try {
    module.exports.shared = shared;
} catch {}

// Readable debug_on setting across both client and server
shared.debug_on = true;

/** A database model used to containerise map data using an ID system
 * of the format [Type]_[UID]
 * Contained map objects are accessed using database.db[id],
 * map objects are added using database.addMapObject(mapObject).
 */
shared.MapDataObjectDB = class MapDataObjectDB {
    /** Object, where key is the ID of the MapObject */
    db = new Map();
    /** Caches point IDs */
    pointIDs = []
    /** Caches path IDs */
    pathIDs = []
    /** Caches part IDs */
    partIDs = []
    /** Caches area IDs */
    areaIDs = []
    /** Caches complex area IDs */
    complexAreaIDs = []
    /** Caches complex area part IDs */
    complexAreaPartIDs = []

    /**
     * Adds a map object to the database, generating a random ID.
     * @param {MapDataObject} mapObject Map object to add
     */
    addMapObject(mapObject) {
        let ID = "";

        if (mapObject.ID != null) {
            ID = mapObject.ID;
        } else {
            ID += shared.MapDataObjectDB.getMapObjectType(mapObject);

            ID += "_";

            // Generate random characters for ID https://stackoverflow.com/a/1349426
            var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            var charactersLength = characters.length;
            for ( var i = 0; i < 6; i++ ) {
                ID += characters.charAt(Math.floor(Math.random() * charactersLength));
            }
        }

        // Add to DB
        mapObject.ID = ID;
        this.db.set(ID, mapObject);

        // Cache ID
        if (ID.indexOf("POINT_") == 0) this.pointIDs.push(ID);
        if (ID.indexOf("PART_") == 0) this.partIDs.push(ID);
        if (ID.indexOf("PATH_") == 0) this.pathIDs.push(ID);
        if (ID.indexOf("AREA_") == 0) this.areaIDs.push(ID);
        if (ID.indexOf("COMPLEX-AREA_") == 0) this.complexAreaIDs.push(ID);
        if (ID.indexOf("COMPLEX-AREA-PART_") == 0) this.complexAreaPartIDs.push(ID);

        return mapObject;
    }

    getMapObjectsOfType(type) {
        let mapObjects = [];
        let objectIDs = this.getMapObjectIDsOfType(type);
        objectIDs.forEach((objectID) => mapObjects.push(this.db.get(objectID)));

        return mapObjects;
    }

    /**
     * Gets map object IDs of ID matching type.
     * @param {array or string} type 
     * @returns 
     */
    getMapObjectIDsOfType(type) {
        if (typeof type == "string") type = [type];

        let ids = [];
        type.forEach(type => {
            switch (type) {
                case "POINT":
                    ids = ids.concat(this.pointIDs);
                    break;
                case "PATH":
                    ids = ids.concat(this.pathIDs);
                    break;
                case "PART":
                    ids = ids.concat(this.partIDs);
                    break;
                case "AREA":
                    ids = ids.concat(this.areaIDs);
                    break;
                case "COMPLEX-AREA":
                    ids = ids.concat(this.complexAreaIDs);
                    break;
                case "COMPLEX-AREA-PART":
                    ids = ids.concat(this.complexAreaPartIDs);
                    break;
                default:
                    ids = ids.concat(this.db.keys().filter(id => id.indexOf(type + "_") == 0)); // Slow fallback
                    break;
            }
        });

        return ids;
    }

    /**
     * Converts a un-instanciated object into a database.
     * @param {*} object Un-instanciated object detailing a database
     * @returns {MapDataObjectDB}
     */
    static MapDataObjectDBFromObject(object) {
        var database = new shared.MapDataObjectDB();

        var db = object.db;
        var pointIDs = Object.keys(db).filter(id => id.indexOf("POINT_") == 0);
        var pathPartIDs = Object.keys(db).filter(id => id.indexOf("PART_") == 0);
        var pathIDs = Object.keys(db).filter(id => id.indexOf("PATH_") == 0);
        var areaIDs = Object.keys(db).filter(id => id.indexOf("AREA_") == 0);
        var complexAreaIDs = Object.keys(db).filter(id => id.indexOf("COMPLEX-AREA_") == 0);
        var complexAreaPartIDs = Object.keys(db).filter(id => id.indexOf("COMPLEX-AREA-PART_") == 0);

        pointIDs.forEach(pointID => {
            let point = shared.MapPoint.mapPointFromObject(db[pointID]);
            point.options = new shared.MapPoint().options; // Strip options, replace with default
            database.addMapObject(point);
        });

        pathPartIDs.forEach(pathPartID => {
            let pathPart = shared.PathPart.pathPartFromObject(db[pathPartID]);
            database.addMapObject(pathPart);
        });

        pathIDs.forEach(pathID => {
            let path = shared.Path.pathFromObject(db[pathID]);
            database.addMapObject(path);
        });

        areaIDs.forEach(areaID => {
            let area = shared.Area.areaFromObject(db[areaID]);
            database.addMapObject(area);
        });

        complexAreaPartIDs.forEach(complexAreaPartID => {
            let complexAreaPart = shared.ComplexAreaPart.complexAreaPartFromObject(db[complexAreaPartID]);
            database.addMapObject(complexAreaPart);
        });

        complexAreaIDs.forEach(complexAreaID => {
            let complexArea = shared.ComplexArea.complexAreaFromObject(db[complexAreaID]);
            database.addMapObject(complexArea);
        })

        return database;
    }

    /**
     * Copy another database's items into this db.
     * @param {MapDataObjectDB} otherDB 
     */
    mergeWithOtherDB(otherDB) {
        let otherDBitems = Array.from(otherDB.db.values());

        for (let i = 0; i < otherDBitems.length; i++) {
            const item = otherDBitems[i];

            if (this.db.get(item.ID) == undefined)
                this.addMapObject(item);
        }
    }

    static getMapObjectType(mapObject) {
        if (mapObject instanceof shared.MapPoint)
            return "POINT";
        else if (mapObject instanceof shared.PathPart)
            return "PART";
        else if (mapObject instanceof shared.Path)
            return "PATH";
        else if (mapObject instanceof shared.ComplexAreaPart)
            return "COMPLEX-AREA-PART"
        else if (mapObject instanceof shared.Area)
            return "AREA";
        else if (mapObject instanceof shared.ComplexArea)
            return "COMPLEX-AREA";
        else
            return "GENERIC";
    }
}

shared.MapGridCache = class MapGridCache {
    /** Maps objects onto a grid made of 10x10 squares so can be queried more quickly */
    mapObjectsGridCache = new Map();
    /** Grid square size */
    gridSquareSize = 10;
    /** Pointer to database from which to cache map data */
    database

    constructor(database) {
        this.database = database;
    }

    get(squareRef) {
        return this.mapObjectsGridCache.get(squareRef);
    }

    xGridCoord(value) {
        let x;
        if (value.x != undefined) x = value.x;
        else x = value;

        return Math.floor(x/this.gridSquareSize) * this.gridSquareSize;
    } 

    yGridCoord(value) {
        let y;
        if (value.y != undefined) y = value.y;
        else y = value;

        return Math.floor(y/this.gridSquareSize) * this.gridSquareSize;
    }

    getSquareRef(mapObj, xGridCoord=this.xGridCoord(mapObj), yGridCoord=this.yGridCoord(mapObj)) {
        return `${xGridCoord}x${yGridCoord}`;
    }

    getSquare(mapObj, xGridCoord=this.xGridCoord(mapObj), yGridCoord=this.yGridCoord(mapObj)) {
        return this.get(this.getSquareRef(mapObj, xGridCoord, yGridCoord));
    }

    cacheMapObjectToGrid(mapObject, xGridCoord=this.xGridCoord(mapObject), yGridCoord=this.yGridCoord(mapObject)) {
        let square = this.get(this.getSquareRef(mapObject, xGridCoord, yGridCoord));

        if (square == undefined)
            square = [];

        if (square.find(mapObjId => mapObjId == mapObject.ID) == undefined)
            square.push(mapObject.ID);
        
        this.mapObjectsGridCache.set(this.getSquareRef(mapObject, xGridCoord, yGridCoord), square);
    }

    /**
     * Caches data to a hashmap grid, so that the queries for
     * which points are on screen can be conducted faster.
     * (JS Objects are typically implemented as hashmaps, but
     * aren't explicitly referred to as such.)
     */
    cacheDataToGrid() {
        this.mapObjectsGridCache.clear();
        
        let points = this.database.getMapObjectsOfType("POINT");
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            this.cacheMapObjectToGrid(point);
        }

        let pathParts = this.database.getMapObjectsOfType("PART");
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            this.cacheMapObjectToGrid(part, 
                this.xGridCoord(part.getPoint(this.database)), 
                this.yGridCoord(part.getPoint(this.database)));
        }

        let paths = this.database.getMapObjectsOfType("PATH");
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            path.getAllPointsOnPath(this.database).forEach(point => {
                this.cacheMapObjectToGrid(path, this.xGridCoord(point), this.yGridCoord(point));
            });
        }

        let areas = this.database.getMapObjectsOfType(["AREA", "COMPLEX-AREA-PART"]);
        for (let i = 0; i < areas.length; i++) {
            const area = areas[i];
            area.getAllPoints(this.database).forEach(point => {
                this.cacheMapObjectToGrid(area, this.xGridCoord(point), this.yGridCoord(point));
            })
        }

        let complexAreas = this.database.getMapObjectsOfType("COMPLEX-AREA");
        for (let i = 0; i < complexAreas.length; i++) {
            const complexArea = complexAreas[i];
            let areas = complexArea.innerAreaIDs.map(id => this.database.db.get(id));
            areas.push(this.database.db.get(complexArea.outerAreaID));

            for (let j = 0; j < areas.length; j++) {
                const area = areas[j];
                if (area != undefined)
                area.getAllPoints(this.database).forEach(point => {
                    this.cacheMapObjectToGrid(complexArea, this.xGridCoord(point), this.yGridCoord(point));
                })
            }
        }
    }

    getSurroundingSquareContent(mapObj, margin) {
        let xGridCoord = this.xGridCoord(mapObj);
        let yGridCoord = this.yGridCoord(mapObj);

        let returnSquare = [];

        let squares = [this.getSquare(mapObj, xGridCoord, yGridCoord)];
        let currentDistanceFromRootSquare = 1;
        while (currentDistanceFromRootSquare <= margin) {
            let offset = this.gridSquareSize * currentDistanceFromRootSquare;
            squares = squares.concat([
                this.getSquare(mapObj, xGridCoord, yGridCoord),
                this.getSquare(mapObj, xGridCoord, yGridCoord - offset),
                this.getSquare(mapObj, xGridCoord, yGridCoord + offset),
                this.getSquare(mapObj, xGridCoord - offset, yGridCoord),
                this.getSquare(mapObj, xGridCoord - offset, yGridCoord - offset),
                this.getSquare(mapObj, xGridCoord - offset, yGridCoord + offset),
                this.getSquare(mapObj, xGridCoord + offset, yGridCoord),
                this.getSquare(mapObj, xGridCoord + offset, yGridCoord - offset),
                this.getSquare(mapObj, xGridCoord + offset, yGridCoord + offset)
            ]);
            currentDistanceFromRootSquare++;
        }

        squares.forEach(square =>
            returnSquare = returnSquare.concat(square)
        );

        return returnSquare.filter(item => item != undefined);
    }

    static coordsFromRef(ref) {
        let xGridCoordString = ref.slice(0, ref.indexOf('x'));
        let yGridCoordString = ref.slice(ref.indexOf('x') + 1);
        let x = Number(xGridCoordString);
        let y = Number(yGridCoordString);

        return {x, y}
    }

    getSquareContentInBounds(x, y, width, height) {
        let currentCoords = {};
        let squareContent = [];
        currentCoords.y = this.yGridCoord(y);
        while (currentCoords.y < y + height) {
            currentCoords.x = this.xGridCoord(x);
            while (currentCoords.x < x + width) {
                let square = this.get(`${currentCoords.x}x${currentCoords.y}`);
                if (square != undefined)
                    square.forEach(id => squareContent.push(id));
                currentCoords.x += this.gridSquareSize;
            }
            currentCoords.y += this.gridSquareSize;
        }
        return squareContent;
    }
}

shared.MapDataObject = class MapDataObject {
    /** String for the ID of the data object */
    ID = null;
    /** Additional metadata, e.g. place name */
    metadata = {osm: {}}
}

shared.MapPoint = class MapPoint extends shared.MapDataObject {
    /** Fixed x position of point in relation to others */
    x
    /** Fixed y position of point in relation to others */
    y

    /**
     * Creates a point that can form part of a path and be displayed on a canvas.
     * @param {int} x Fixed x position of point in relation to others
     * @param {int} y Fixed y position of point in relation to others
     * @param {object} metadata Optional metadata such as name
     */
    constructor (x, y, metadata={}) {
        super();

        this.x = x;
        this.y = y;

        this.metadata = metadata;
    }

    get label() {
        let metadata = this.metadata;
        if (metadata.path != undefined && metadata.path.osm != undefined) metadata = metadata.path.osm;

        let label = `${this.ID}`;
        if (metadata.wikipedia != undefined && metadata.wikipedia.indexOf("en:") == 0)
            label = metadata.wikipedia.slice(metadata.wikipedia.indexOf("en:")+3);
        else if (metadata.name != undefined) 
            label = metadata.name;
        else if (metadata["addr:street"] != undefined && metadata["addr:housenumber"] != undefined)
            label = `${metadata["addr:housenumber"]} ${metadata["addr:street"]}`;
        else if (metadata.prow_ref != undefined)
            label = metadata.prow_ref;
        else if (metadata.ref != undefined)
            label = metadata.ref;

        return encodeHTML(label);
    }

    get metadataHTML() {
        let html = "";
        let metadata = this.metadata;
        if (metadata.path != undefined && metadata.path.osm != undefined) metadata = metadata.path.osm;

        Object.keys(metadata).forEach(key => {
            html += `<strong>${encodeHTML(key)}:</strong> ${encodeHTML(metadata[key])}<br/>`;
        })

        return html;
    }

    get locationType() {
        let metadata = this.metadata;
        let type = "Location";
        if (metadata.path != undefined && metadata.path.osm != undefined) metadata = metadata.path.osm;

        if (metadata.highway != undefined && this.metadata.path != undefined)
            type = `Road: ${metadata.highway}`;
        else if (metadata.highway != undefined && this.metadata.path == undefined)
            type = `${metadata.highway}`;
        else if (metadata.waterway != undefined)
            type = `Waterway: ${metadata.waterway}`
        else if (metadata.railway == "site")
            type = `Rail station`;
        else if (metadata.tourism != undefined)
            type = `${metadata.tourism}`;
        else if (metadata.leisure != undefined)
            type = `${metadata.leisure}`;
        else if (metadata.place != undefined)
            type = `${metadata.place}`;
        else if (metadata.shop != undefined)
            type = `${metadata.shop}`;
        else if (metadata.amenity != undefined)
            type = `${metadata.amenity}`;
        else if (metadata.public_transport != undefined)
            type = `Transport ${metadata.public_transport}`;
        else if (metadata.barrier)
            type = `${metadata.barrier}`;
        else if (metadata["addr:housenumber"] != undefined)
            type = `House`
        
        return (type[0].toUpperCase() + type.slice(1)).replaceAll("_", " ");
    }

    /**
     * Converts a simple object representing a MapPoint (such as that returned from an API)
     * to a MapPoint.
     * @param {Object} object the MapPoint represented as a simple object to convert
     * @returns MapPoint
     */
    static mapPointFromObject(object) {
        var mapPoint = new shared.MapPoint(object.x, object.y, object.metadata);
        mapPoint.ID = object.ID;
        mapPoint.metadata = object.metadata;

        return mapPoint;
    }

    distanceToPoint(pointB) {
        let pointA = this;
        let distance = Math.sqrt( Math.abs(pointB.x - pointA.x)**2 + Math.abs(pointB.y - pointA.y)**2);
        return distance;
    }
}

/**
 * Defines a "edge" between two nodes
 */
shared.PathPart = class PathPart extends shared.MapDataObject {
    /** The id of the {Point} referenced by this path part */
    pointID
    /** The IDs of the path parts this connects to */
    nextPathPartIDs = []

    /**
     * @param {string} pointID The ID of the point referenced by this path part
     * @param {string[]} nextPathPartIDs Array of next part IDs in the path
     */
    constructor (pointID=null, nextPathPartIDs=[], metadata={}) {
        super();
        
        this.pointID = pointID;
        this.nextPathPartIDs = nextPathPartIDs;
        this.metadata = metadata
    }

    /**
     * Converts a simple object representing a PathPart (such as that returned from an API)
     * to a PathPart.
     * @param {Object} object the path part represented as a simple object to convert
     * @returns PathPart
     */
    static pathPartFromObject (object) {
        var pathPart = new shared.PathPart(object.pointID, object.nextPathPartIDs, object.metadata);
        pathPart.ID = object.ID;
        pathPart.metadata = object.metadata;
        return pathPart;
    }

    static getPartByStepsAway(database, pathPart, steps) {
        // Base case 
        if (steps == 0 || pathPart.nextPathPartIDs.length == 0)
            return pathPart;
        else {
            var nextPathPart = database.db.get(pathPart.nextPathPartIDs[0]);
            return this.getPartByStepsAway(database, nextPathPart, steps-1);
        }
    }

    connectingTo(IDofPointConnectingTo, database) {
        var connectingPathPart = new PathPart(IDofPointConnectingTo);
        var pathPart = database.addMapObject(IDofPointConnectingTo);
        this.nextPathPartIDs.push(pathPart.ID);

        return pathPart;
    }

    getPoint(database) {
        return database.db.get(this.pointID);
    }

    getNextPart(database) {
        if (this.nextPathPartIDs.length == 0) return false;
        return database.db.get(this.nextPathPartIDs[0]);
    }

    getNextPoint(database) {
        let nextPathPart = this.getNextPart(database);
        if (!nextPathPart) return false;
        return nextPathPart.getPoint(database);
    }
}

shared.Path = class Path extends shared.MapDataObject {
    /** The {PathPart} object ID that begins the path */
    startingPathPartID

    /**
     * Creates a path using a starting points
     * @param {string} startingPathPartID The ID of {PathPart} object that begins the path
     * @param {object} data Data, including options for the path when drawing to screen
     */
    constructor (startingPathPartID) {
        super();

        this.startingPathPartID = startingPathPartID;
    }

    /**
     * Converts a simple object representing a Path (such as that returned from an API)
     * to a Path.
     * @param {Object} object the path represented as a simple object to convert
     * @returns Path
     */
    static pathFromObject(object) {
        var path = new shared.Path(object.startingPathPartID, object.data);
        path.ID = object.ID;
        path.metadata = object.metadata;

        return path;
    }

    /**
     * Converts a tree of connecting points to a array of all points (for drawing individual points unconnectedly).
     * @returns {MapPoint[]} 
     */
    getAllPointsOnPath(database) {
        let pointArray = [];
        let currentPathPartID = this.startingPathPartID;
        while (database.db.get(currentPathPartID) != undefined) {
            pointArray.push(database.db.get(currentPathPartID).getPoint(database));
            currentPathPartID = database.db.get(currentPathPartID).nextPathPartIDs[0];
        }
        return pointArray;
    }

    copyPathContentsToDB(fromDB, toDB, currentPathPartID=this.startingPathPartID) {
        var currentPathPart = fromDB.db.get(currentPathPartID);

        toDB.addMapObject(currentPathPart);
        toDB.addMapObject(fromDB.db.get(fromDB.db.get(currentPathPartID).pointID));

        if (currentPathPart.nextPathPartIDs != null && currentPathPart.nextPathPartIDs.length != 0)
            for (var i=0; i < currentPathPart.nextPathPartIDs.length; i++)
                this.copyPathContentsToDB(fromDB, toDB, currentPathPartID=currentPathPart.nextPathPartIDs[i]);
    }

    /**
     * Converts a sequential array of points to a path
     * @param {MapPoint[]} pathArray A sequential array of {MapPoint}s
     * @returns {Path} {Path} of connecting points
     */ 
    static connectSequentialPoints(pathArray, database) {
        var pathIdArray = [];
        
        for (let i = 0; i < pathArray.length; i++) {
            const point = pathArray[i];
            database.addMapObject(point);
            pathIdArray.push(point.ID);
        }

        // Set up path parts
        var startingPathPart;
        var previousPathPart;

        for (let i = 0; i < pathArray.length; i++) {
            var currentPathPart = new shared.PathPart(pathIdArray[i]);
            
            database.addMapObject(currentPathPart);

            if (i == 0)
                startingPathPart = currentPathPart;
            if (previousPathPart != undefined)
                previousPathPart.nextPathPartIDs = [currentPathPart.ID];
                
            previousPathPart = currentPathPart;
        }
        var newPath = new shared.Path(startingPathPart.ID);
        return newPath;
    }
}

/**
 * Used to define polygons to drawn on map, such as bodies of water, and
 * buildings.
 */
shared.Area = class Area extends shared.MapDataObject {
    /** Sequential list of map point IDs that make up area */
    mapPointIDs

    /** Contains optional data
     * Such as borderStyle, fillStyle
    */
    data 

    metadata = {
        areaType: {
            "first_level_descriptor": "land",
            "second_level_descriptor": ""
        }
    }

    constructor (mapPointIDs, data={}) {
        super();
        
        this.mapPointIDs = mapPointIDs;
        this.data = data;
    }

    getAllPoints(database) {
        return this.mapPointIDs.map(id => database.db.get(id));
    }

    static areaFromObject(object) {
        let area = new shared.Area(object.mapPointIDs, object.data);
        area.ID = object.ID;
        area.metadata = object.metadata;
        return area;
    }
}

shared.ComplexAreaPart = class ComplexAreaPart extends shared.Area {
    /**
     * {string} indicating whether the complex area part is an inner or outer part
     * of a complex area.
     */
    outerOrInner = "unknown"
    
    constructor (mapPointIDs, outerOrInner, data={}) {
        super();

        this.mapPointIDs = mapPointIDs;
        this.outerOrInner = outerOrInner;

        if (this.outerOrInner == "inner")
            this.metadata.areaType["second_level_descriptor"] =  "none";

        this.data = data;
    }

    static complexAreaPartFromObject(object) {
        let complexAreaPart = new shared.ComplexAreaPart(object.mapPointIDs, object.outerOrInner, object.data);
        complexAreaPart.ID = object.ID;
        complexAreaPart.metadata = object.metadata;
        return complexAreaPart;
    }
}

/** 
 * Used to define area made of multiple areas
 */
shared.ComplexArea = class ComplexArea extends shared.MapDataObject {
    outerAreaID
    innerAreaIDs

    constructor(outerAreaID, innerAreaIDs) {
        super();

        this.outerAreaID = outerAreaID;
        this.innerAreaIDs = innerAreaIDs;
    }

    static complexAreaFromObject(object) {
        let complexArea = new shared.ComplexArea(object.outerAreaID, object.innerAreaIDs);
        complexArea.ID = object.ID;
        complexArea.metadata = object.metadata;
        return complexArea;
    }
}

// Used to sanitize labels, etc for adding to DOM https://stackoverflow.com/a/2794366
function encodeHTML(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

shared.getPathMidpoint = (path, database) => {
    let pathPoints = path.getAllPointsOnPath(database);

    // Sum distance of path so we can find mid point
    let distanceTotal = 0;
    let lastPoint = pathPoints[0];
    pathPoints.forEach(pathPoint => {
        distanceTotal += Math.sqrt( Math.abs(pathPoint.x - lastPoint.x)**2 + Math.abs(pathPoint.y - lastPoint.y)**2)
        lastPoint = pathPoint;
    });

    // Find point nearest to midpoint, use this as point
    let distanceTraversed = 0;
    lastPoint = pathPoints[0];
    for (let j = 0; j < pathPoints.length; j++) {
        const pathPoint = pathPoints[j];
        distanceTraversed += Math.sqrt( Math.abs(pathPoint.x - lastPoint.x)**2 + Math.abs(pathPoint.y - lastPoint.y)**2);
        if (distanceTraversed >= distanceTotal/2) {
            return pathPoint;
        }
        lastPoint = pathPoint;
    }
}

shared.getBoundsOfPointArray = (pointArray) => {
    let minX;
    let minY;
    let maxX;
    let maxY;
    pointArray.forEach(point => {
        if (minY == undefined || point.y < minY) minY = point.y;
        if (minX == undefined || point.x < minX) minX = point.x;
        if (maxY == undefined || point.y > maxY) maxY = point.y;
        if (maxX == undefined || point.x > maxX) maxX = point.x;
    });
    let maxDistance = Math.sqrt( Math.abs(maxX - minX)**2 + Math.abs(maxY - minY)**2 );
    let zoomLevel = (400/maxDistance < 10) ? 400/maxDistance : 10;
    return {minX, minY, maxX, maxY, maxDistance, zoomLevel};
}