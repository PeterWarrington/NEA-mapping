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
    db = {}
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
            if (mapObject instanceof shared.MapPoint)
                ID += "POINT";
            else if (mapObject instanceof shared.PathPart)
                ID += "PART";
            else if (mapObject instanceof shared.Path)
                ID += "PATH";
            else if (mapObject instanceof shared.ComplexAreaPart)
                ID += "COMPLEX-AREA-PART"
            else if (mapObject instanceof shared.Area)
                ID += "AREA";
            else if (mapObject instanceof shared.ComplexArea)
                ID += "COMPLEX-AREA";
            else
                ID += "GENERIC";

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
        this.db[ID] = mapObject;

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
        objectIDs.forEach((objectID) => mapObjects.push(this.db[objectID]));

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
                    ids = ids.concat(Object.keys(this.db).filter(id => id.indexOf(type + "_") == 0)); // Slow fallback
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
        let otherDBitems = Object.values(otherDB.db);

        for (let i = 0; i < otherDBitems.length; i++) {
            const item = otherDBitems[i];

            if (this.db[item.ID] == undefined)
                this.addMapObject(item);
        }
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
            var nextPathPart = database.db[pathPart.nextPathPartIDs[0]];
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
        return database.db[this.pointID];
    }

    getNextPart(database) {
        if (this.nextPathPartIDs.length == 0) return false;
        return database.db[this.nextPathPartIDs[0]]
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
    getAllPointsOnPath(database, currentPathPartID=this.startingPathPartID, pathIDArray=[]) {
        if (currentPathPart.nextPathPartIDs != null && database.db[currentPathPartID].nextPathPartIDs.length != 0) {
            for (var i=0; i < database.db[currentPathPartID].nextPathPartIDs.length; i++) {
                if (i==0)
                    pathArray.push(database.db[currentPathPartID].pointID);
                pathArray.push(database.db[database.db[currentPathPartID].nextPathPartIDs[i]].pointID);
                this.getAllPointsOnPath(database, currentPathPartID=database.db[currentPathPartID].nextPathPartIDs[i], pathIDArray);
            }
        }
        return pathArray;
    }

    copyPathContentsToDB(fromDB, toDB, currentPathPartID=this.startingPathPartID) {
        var currentPathPart = fromDB.db[currentPathPartID];

        toDB.addMapObject(currentPathPart);
        toDB.addMapObject(fromDB.db[fromDB.db[currentPathPartID].pointID]);

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