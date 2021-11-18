shared = {};

// If running on backend, make accessible
try {
    module.exports.shared = shared;
} catch {}

shared.MapPoint = class MapPoint {
    /** Fixed x position of point in relation to others */
    x
    /** Fixed y position of point in relation to others */
    y

    /** Options for the point when drawing to screen */
    options = {
        pointDrawMethod: "text",
        pointText: "•",
        pointFont: "sans-serif",
        pointFontWidth: 16,
        pointFillStyle: "#878787",
        pathDrawPointX: 5,
        pathDrawPointY: 1
    }

    /** {MapPoint[]} array containing the {MapPoint}s that this point connects to. Can be undefined. */
    pointsConnectingTo

    /**
     * Creates a point that can form part of a path and be displayed on a canvas.
     * @param {int} x Fixed x position of point in relation to others
     * @param {int} y Fixed y position of point in relation to others
     * @param {MapPoint} pointsConnectingTo The sequential {MapPoint} that follows this one. Can be undefined.
     * @param {object} options Options for the point when drawing to screen
     */
    constructor (x, y, options={}, pointsConnectingTo=undefined) {
        this.x = x;
        this.y = y;

        this.options = {...this.options, ...options};
    }

    /**
     * Converts a simple object representing a MapPoint (such as that returned from an API)
     * to a MapPoint.
     * @param {Object} object the MapPoint represented as a simple object to convert
     * @returns MapPoint
     */
    static mapPointFromObject(object) {
        var mapPoint = new shared.MapPoint(null, null, null);
        mapPoint.x = object.x;
        mapPoint.y = object.y;
        mapPoint.options = object.options;

        return mapPoint;
    }
}

/**
 * Defines 2 connecting points as part of a path and what these connect to.
 */
shared.PathPart = class PathPart {
    /** The {Point} referenced by this path part */
    point
    /** The {Point} the first point connects to */
    nextPathParts = []
    /** {String} used to identify this {PathPart} */
    data

    /**
     * @param {Point} point The point referenced by this path part
     * @param {PathPart[]} nextPathParts Array of next part(s) in the path
     * @param {Object} data Object storing additional parameters (optional)
     */
    constructor (point=null, nextPathParts=[], data={}) {
        this.point = point;
        this.nextPathParts = nextPathParts;
        this.data = data;
    }

    /**
     * Converts a simple object representing a PathPart (such as that returned from an API)
     * to a PathPart.
     * @param {Object} object the path part represented as a simple object to convert
     * @returns PathPart
     */
    static pathPartFromObject (object) {
        var pathPart = new shared.PathPart();

        pathPart.point = shared.MapPoint.mapPointFromObject(object.point);
        pathPart.nextPathParts = [];
        object.nextPathParts.forEach((pathPartObject) => {
            var pathPartToAdd = shared.PathPart.pathPartFromObject(pathPartObject);
            pathPart.nextPathParts.push(pathPartToAdd);
        });
        pathPart.data = object.data;

        return pathPart;
    }

    connectingTo(pointConnectingTo) {
        var connectingPathPart = new PathPart(pointConnectingTo, []);
        this.nextPathParts.push(connectingPathPart);
        return connectingPathPart;
    }
}

shared.Path = class Path {
    /** The {PathPart} object that begins the path */
    startingPathPart
    /** Data, including options for the path when drawing to screen */
    data = {
        pathFillStyle: "#e8cc4a",
        pathLineWidth: 4
    }

    /** Returns the line width to be displayed on the canvas */
    get lineWidth() {
        return this.data.pathLineWidth;
    }

    /**
     * Creates a path using a starting points
     * @param {PathPart} startingPathPart The {PathPart} object that begins the path
     * @param {object} data Data, including options for the path when drawing to screen
     */
    constructor (startingPathPart, pathId, data={}) {
        this.startingPathPart = startingPathPart;
        this.data = {...this.data, ...data};
        this.pathId = pathId;
    }

    /**
     * Converts a simple object representing a Path (such as that returned from an API)
     * to a Path.
     * @param {Object} object the path represented as a simple object to convert
     * @returns Path
     */
    static pathFromObject(object) {
        var path = new shared.Path(null, null);

        path.startingPathPart = shared.PathPart.pathPartFromObject(object.startingPathPart);
        path.data = object.data;
        path.pathId = object.pathId;

        return path;
    }

    /**
     * Converts a tree of connecting points to a array of all points (for drawing individual points unconnectedly).
     * @returns {MapPoint[]} 
     */
    getAllPointsOnPath(currentPathPart=this.startingPathPart, pathArray=[]) {
        if (currentPathPart.nextPathParts != null && currentPathPart.nextPathParts.length != 0) {
            for (var i=0; i < currentPathPart.nextPathParts.length; i++) {
                if (i==0)
                    pathArray.push(currentPathPart.point);
                pathArray.push(currentPathPart.nextPathParts[i].point);
                this.getAllPointsOnPath(currentPathPart=currentPathPart.nextPathParts[i], pathArray);
            }
        }
        return pathArray;
    }

    /**
     * Converts a sequential array of points to a path
     * @param {MapPoint[]} pathArray A sequential array of {MapPoint}s
     * @returns {Path} The {MapPoint} object that starts the path
     */ 
    static connectSequentialPoints(pathArray) {
        // Copy pathArray
        var pathArrayCopy = Object.values(Object.assign({}, pathArray)).reverse();
        // Set up path parts
        var startingPathPart;
        var previousPathPart;

        for (let i = 0; i < pathArray.length; i++) {
            var currentPathPart = new PathPart(pathArray[i], []);

            if (i == 0)
                startingPathPart = currentPathPart;
            if (previousPathPart != undefined)
                previousPathPart.nextPathParts = [currentPathPart];
                
            previousPathPart = currentPathPart;
        }
        var newPath = new Path(startingPathPart, "path");
        return newPath;
    }
}