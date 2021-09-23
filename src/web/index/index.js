class CanvasState {
    /** The {CanvasRenderingContext2D} that is used on the canvas */
    ctx
    /** The canvas element that displays the map */
    canvas
    /** Indicates whether the mouse button is down */
    canvasMouseDown = false
    /** Indicates the last recorded mouse position relative to the page in X */
    lastPageX = -1
    /** Indicates the last recorded mouse position relative to the page in Y */
    lastPageY = -1
    /** The array of {Path}s to be drawn to screen */
    paths = []
    /** A {int} multiplier to represent the zoom level */
    zoomLevel = 1
    /** {int} representing how the map has been translated in x */
    xTranslation = 0
    /** {int} representing how the map has been translated in y */
    yTranslation = 0
    touchDevice = false

    constructor () {
        this.canvas = document.getElementById("mapCanvas");
        this.ctx = this.canvas.getContext('2d');
        this.canvas.style.cursor = "default";

        // Zoom functionality
        document.getElementById("zoom-in").onclick = (event) => {
            this.zoom(1);
        };

        document.getElementById("zoom-out").onclick = (event) => {
            this.zoom(-1);
        };

        // Translation functionality
        this.canvas.ontouchstart = (event) => {
            this.touchDevice = true;
            this.mapInteractionBegin(event.targetTouches[0].pageX, event.targetTouches[0].pageY);
        }

        this.canvas.onmousedown = (event) => {
            if (!this.touchDevice) {
                this.mapInteractionBegin(event.pageX, event.pageY);
            }
        }
        
        this.canvas.ontouchend = () => this.mapInteractionEnd();
        this.canvas.onmouseup = () => this.mapInteractionEnd();

        this.canvas.ontouchmove = (event) => {
            this.mapDrag(event.targetTouches[0].pageX, event.targetTouches[0].pageY);
        }

        this.canvas.onmousemove = (event) => {
            if (this.canvasMouseDown)
                this.mapDrag(event.pageX, event.pageY);
        }

        this.canvas.onmouseenter = (event) => {
            this.canvas.style.cursor = "grab";
        }

        this.canvas.onmouseleave = (event) => {
            this.canvas.style.cursor = "default";
        }

        // Redraw on window resize to make sure canvas is right size
        window.addEventListener('resize', () => this.draw());
    }

    mapInteractionEnd() {
        this.lastPageX = -1;
        this.lastPageY = -1;
        this.canvasMouseDown = false;
        if (this.canvas.style.cursor == "grabbing")
        this.canvas.style.cursor = "grab";
    }

    mapInteractionBegin(pageX, pageY) {
        this.lastPageX = pageX;
        this.lastPageY = pageY;
        this.canvasMouseDown = true;
        if (this.canvas.style.cursor == "grab")
            this.canvas.style.cursor = "grabbing";
    }

    mapDrag(pageX, pageY) {
        var relativeMouseX = pageX - this.lastPageX;
        var relativeMouseY = pageY - this.lastPageY;

        this.xTranslation += relativeMouseX;
        this.yTranslation += relativeMouseY;

        this.lastPageX = pageX;
        this.lastPageY = pageY;

        this.draw();
    }

    /**
     * Method to change the zoom level of the displayed map
     * @param {int} multiplier The multiplier to change the zoom by, normally either -1 or 1
     */
    zoom(multiplier) {
        let zoomChange = 0.1 * multiplier;
        if (this.zoomLevel + zoomChange < 0.1)
            return;
        this.zoomLevel += zoomChange;
        this.draw();
    }

    /**
     * Calls functions to draw path to screen
     */
    draw() {
        // Update canvas width
        this.updateCanvasWidth();
    
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
        // Fill background
        this.ctx.fillStyle = "#e6e6e6";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.paths.forEach(path => path.plotPoints());
        this.paths.forEach(path => path.plotLine());
    }

    /**
     * Updates the width of the canvas displayed on screen
     */
    updateCanvasWidth() {
        // Resize to 100% (html decleration does not work)
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
}

class MapPoint {
    /** Fixed x position of point in relation to others */
    x
    /** Fixed y position of point in relation to others */
    y
    /** The {canvasState} instance */
    canvasState

    /** Gets the x position relative to the canvas */
    get displayedX() {
        return (this.x * this.canvasState.zoomLevel) + this.canvasState.xTranslation;
    }

    /** Gets the y position relative to the canvas */
    get displayedY() {
        return (this.y * this.canvasState.zoomLevel) + this.canvasState.yTranslation;
    }

    /** Gets the x position of where the path should be drawn relative to canvas */
    get pathPointDisplayX() {
        return this.displayedX + this.options.pathDrawPointX;
    }

    /** Gets the y position of where the path should be drawn relative to canvas */
    get pathPointDisplayY() {
        return this.displayedY + this.options.pathDrawPointY;
    }

    /** Options for the point when drawing to screen */
    options = {
        pointDrawMethod: "text",
        pointText: "📍",
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
     * @param {CanvasRenderingContext2D} ctx The {CanvasRenderingContext2D} that is used on the canvas
     * @param {MapPoint} pointsConnectingTo The sequential {MapPoint} that follows this one. Can be undefined.
     * @param {object} options Options for the point when drawing to screen
     */
    constructor (x, y, canvasState, options={}, pointsConnectingTo=undefined) {
        this.x = x;
        this.y = y;
        this.canvasState = canvasState;

        this.options = {...this.options, ...options};
    }

    /**
     * Function to draw the point to the screen
     */
    drawPoint() {
        this.canvasState.ctx.fillStyle = this.options.pointFillStyle;
        this.canvasState.ctx.font = `${this.options.pointFontWidth}px ${this.options.pointFont}`;
        this.canvasState.ctx.fillText(this.options.pointText, this.displayedX, this.displayedY);
    }
}

/**
 * Defines 2 connecting points as part of a path and what these connect to.
 */
class PathPart {
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

    connectingTo(pointConnectingTo) {
        var connectingPathPart = new PathPart(pointConnectingTo, []);
        this.nextPathParts.push(connectingPathPart);
        return connectingPathPart;
    }
}

class Path {
    /** The {PathPart} object that begins the path */
    startingPathPart
    /** The {canvasState} instance */
    canvasState
    /** Data, including options for the path when drawing to screen */
    data = {
        pathFillStyle: "#e8cc4a",
        pathLineWidth: 4,
        recalculatePathFlag: false
    }

    /** Returns the line width to be displayed on the canvas */
    get lineWidth() {
        return this.data.pathLineWidth;
    }

    /**
     * Creates a path using a starting points
     * @param {PathPart} startingPathPart The {PathPart} object that begins the path
     * @param {CanvasRenderingContext2D} ctx The {CanvasRenderingContext2D} that is used on the canvas
     * @param {object} data Data, including options for the path when drawing to screen
     */
    constructor (startingPathPart, canvasState, pathId, data={}) {
        this.startingPathPart = startingPathPart;
        this.canvasState = canvasState;
        this.data = {...this.data, ...data};
        this.pathId = pathId;
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
    static connectSequentialPoints(pathArray, canvasState) {
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
        var newPath = new Path(startingPathPart, canvasState, "path");
        return newPath;
    }

    /**
     * Plots line connecting points in this.startingPathPart to screen.
     */
    plotLine() {
        // Set properties
        this.canvasState.ctx.lineWidth = this.lineWidth;
        this.canvasState.ctx.strokeStyle = this.data.pathFillStyle;

        this.canvasState.ctx.beginPath();
        
        // Initialize array containing the  initial PathParts to draw
        let startingPathPartsToDraw = [this.startingPathPart];

        // Iterate through startingPathPartsToDraw
        for (let i = 0; i < startingPathPartsToDraw.length; i++) {
            const startingPathPart = startingPathPartsToDraw[i];
            
            // Move to the starting point
            this.canvasState.ctx.moveTo(startingPathPart.point.pathPointDisplayX, 
                startingPathPart.point.pathPointDisplayY);

            // If we get to a branch, push the other branches to startingPathPartsToDraw to iterate through later
            let currentPathPart = startingPathPart;
            while (currentPathPart.nextPathParts.length != 0) {
                // Plot a line from the last plotted point to the point at currentPathPart
                this.canvasState.ctx.lineTo(currentPathPart.point.pathPointDisplayX, 
                    currentPathPart.point.pathPointDisplayY);
                for (let j = 1; j < currentPathPart.nextPathParts.length; j++) {
                    startingPathPartsToDraw.push(currentPathPart.nextPathParts[j]);
                }
                
                // Advance pointer to next connecting point in the closest branch
                currentPathPart = currentPathPart.nextPathParts[0];
            }
            this.canvasState.ctx.lineTo(currentPathPart.point.pathPointDisplayX, currentPathPart.point.pathPointDisplayY);
            
            // Draw line to canvas
            this.canvasState.ctx.stroke();
        }
    }

    /**
     * Plots markers for points in this.startingPoint
     */
    plotPoints() {
        this.getAllPointsOnPath().forEach(point => point.drawPoint());
    }
}

/**
 * Function called at page load to test some points on canvas
 */
function MapTest() {
    // Create canvas state
    canvasState = new CanvasState();

    // Create path 1
    var startingPathPart1 = new PathPart(new MapPoint(50, 50, canvasState, {pointText: "📍\t\tPath 1"}));
    startingPathPart1.connectingTo(new MapPoint(60, 55, canvasState))
    .connectingTo(new MapPoint(100, 70, canvasState))
    .connectingTo(new MapPoint(110, 100, canvasState));

    var path1 = new Path(startingPathPart1, canvasState, "Path1");

    // Create path 2
    var startingPathPart2 = new PathPart(new MapPoint(30, 200, canvasState, {pointText: "📍\t\tPath 2"}));
    startingPathPart2.connectingTo(new MapPoint(400, 170, canvasState))
    .connectingTo(new MapPoint(300, 250, canvasState))
    .connectingTo(new MapPoint(270, 20, canvasState))
    .connectingTo(new MapPoint(120, 100, canvasState))
    .connectingTo(new MapPoint(160, 160, canvasState));

    var path2 = new Path(startingPathPart2, canvasState, "Path2");

    canvasState.paths = [path1, path2];
        
    // Draw points
    canvasState.draw();
}

// Once the page has fully loaded, call MapTest
document.addEventListener('DOMContentLoaded', MapTest, false);

// Libraries

// https://stackoverflow.com/a/23749355/
function getAbsoluteHeight(el) {
    // Get the DOM Node if you pass in a string
    el = (typeof el === 'string') ? document.querySelector(el) : el; 

    var styles = window.getComputedStyle(el);
    var margin = parseFloat(styles['marginTop']) +
                    parseFloat(styles['marginBottom']);

    return Math.ceil(el.offsetHeight + margin);
}