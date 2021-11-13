testPointsMode = true;

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
    /** An array of test nodes that should be drawn to screen, and nothing else, when draw() is called if not null */
    testMapPoints = null

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

        this.mapTranslate(relativeMouseX, relativeMouseY);

        this.lastPageX = pageX;
        this.lastPageY = pageY;

        this.draw();
    }

    mapTranslate(translateX, translateY) {
        this.xTranslation += translateX;
        this.yTranslation += translateY;
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
        
        if (this.testMapPoints != null) {
            // Halt drawing, call test draw function instead, typical drawing will not be executed
            this.#testDraw();
            return;
        }

        this.paths.forEach(path => path.plotPoints(this));
        this.paths.forEach(path => path.plotLine(this));
    }
    
    #testDraw() {
        this.testMapPoints.forEach(mapPoint => {
            mapPoint.drawPoint(this);
        });
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

class Path extends shared.Path {
    /** The {canvasState} instance */
    canvasState

    /**
     * 
     * @param {PathPart} startingPathPart The path part that starts the path
     * @param {CanvasState} canvasState 
     * @param {string} pathId 
     * @param {object} data Options, etc
     */
    constructor (startingPathPart=null, canvasState=null, pathId=null, data={}) {
        super();
        this.startingPathPart = startingPathPart;
        this.canvasState = canvasState;
        this.data = {...this.data, ...data};
        this.pathId = pathId;
    }

    /**
     * Plots line connecting points in this.startingPathPart to screen.
     */
     plotLine(canvasState=canvasState) {
        if (canvasState == null) {
            console.warn("Canvas state not defined, unable to plot path.");
            return;
        }

        // Set properties
        canvasState.ctx.lineWidth = this.lineWidth;
        canvasState.ctx.strokeStyle = this.data.pathFillStyle;

        canvasState.ctx.beginPath();
        
        // Initialize array containing the  initial PathParts to draw
        let startingPathPartsToDraw = [this.startingPathPart];

        // Iterate through startingPathPartsToDraw
        for (let i = 0; i < startingPathPartsToDraw.length; i++) {
            const startingPathPart = startingPathPartsToDraw[i];
            startingPathPart.point.canvasState = canvasState;

            // Move to the starting point
            canvasState.ctx.moveTo(startingPathPart.point.pathPointDisplayX, 
                startingPathPart.point.pathPointDisplayY);

            // If we get to a branch, push the other branches to startingPathPartsToDraw to iterate through later
            let currentPathPart = startingPathPart;
            while (currentPathPart.nextPathParts.length != 0) {
                currentPathPart.point.canvasState = canvasState;

                // Plot a line from the last plotted point to the point at currentPathPart
                canvasState.ctx.lineTo(currentPathPart.point.pathPointDisplayX, 
                    currentPathPart.point.pathPointDisplayY);
                for (let j = 1; j < currentPathPart.nextPathParts.length; j++) {
                    startingPathPartsToDraw.push(currentPathPart.nextPathParts[j]);
                }
                
                // Advance pointer to next connecting point in the closest branch
                currentPathPart = currentPathPart.nextPathParts[0];
            }
            canvasState.ctx.lineTo(currentPathPart.point.pathPointDisplayX, currentPathPart.point.pathPointDisplayY);
            
            // Draw line to canvas
            canvasState.ctx.stroke();
        }
    }

    /**
     * Plots markers for points in this.startingPoint
     */
    plotPoints(canvasState=canvasState) {
        this.getAllPointsOnPath().forEach(point => point.drawPoint(canvasState));
    }
}

// This is needed so that references to Paths in shared.js reference Paths with the client functionality defined here
shared.Path = Path;

class PathPart extends shared.PathPart {
    /**
     * @param {Point} point The point referenced by this path part
     * @param {PathPart[]} nextPathParts Array of next part(s) in the path
     * @param {Object} data Object storing additional parameters (optional)
     */
     constructor (point=null, nextPathParts=[], data={}) {
        super();
        this.point = point;
        this.nextPathParts = nextPathParts;
        this.data = data;
    }
}

shared.PathPart = PathPart;

class MapPoint extends shared.MapPoint {
    canvasState

    /**
     * Creates a point that can form part of a path and be displayed on a canvas.
     * @param {int} x Fixed x position of point in relation to others
     * @param {int} y Fixed y position of point in relation to others
     * @param {MapPoint} pointsConnectingTo The sequential {MapPoint} that follows this one. Can be undefined.
     * @param {object} options Options for the point when drawing to screen
     */
     constructor (x, y, options={}, pointsConnectingTo=undefined) {
        super();
        this.x = x;
        this.y = y;

        this.options = {...this.options, ...options};
    }

    /** Gets the x position relative to the canvas */
    get displayedX() {
        return (this.x * canvasState.zoomLevel) + canvasState.xTranslation;
    }

    /** Gets the y position relative to the canvas */
    get displayedY() {
        return (this.y * canvasState.zoomLevel) + canvasState.yTranslation;
    }

    /** Gets the x position of where the path should be drawn relative to canvas */
    get pathPointDisplayX() {
        return this.displayedX + this.options.pathDrawPointX;
    }

    /** Gets the y position of where the path should be drawn relative to canvas */
    get pathPointDisplayY() {
        return this.displayedY + this.options.pathDrawPointY;
    }

    /**
     * Function to draw the point to the screen
     */
     drawPoint(canvasState=canvasState) {
        if (canvasState == null) {
            console.warn("Canvas state not defined, unable to draw point.");
            return;
        }

        canvasState.ctx.fillStyle = this.options.pointFillStyle;
        canvasState.ctx.font = `${this.options.pointFontWidth}px ${this.options.pointFont}`;
        canvasState.ctx.fillText(this.options.pointText, this.displayedX, this.displayedY);
    }
}

// This is needed so that references to MapPoints in shared.js references MapPoints with the client functionality defined here
shared.MapPoint = MapPoint;

/**
 * Function called at page load to test some points on canvas
 */
function MapTest() {
    // Create canvas state
    canvasState = new CanvasState();

    // Enter testPointsMode if flag set
    if (testPointsMode) {
        testPointsExecute(canvasState);
        return;
    }

    // Import test nodes
    // Translate graph so does not overlap header
    canvasState.mapTranslate(15, getAbsoluteHeight(document.getElementById("header")) + 15);

    // Get test points from server
    var httpReq = new XMLHttpRequest();
    httpReq.addEventListener("load", () => {
        // Request returns array of paths represented as simple objects, not as Path instances
        // we need to convert this
        pathObjectArray = JSON.parse(httpReq.response);
        pathObjectArray.forEach((pathObject) => {
            let pathToPush = Path.pathFromObject(pathObject);
            pathToPush.canvasState = canvasState;
            canvasState.paths.push(pathToPush);
        });
            
        // Draw points
        canvasState.draw();
    });
    httpReq.open("GET", "http://localhost/api/GetPaths");
    httpReq.send();
}

function testPointsExecute(canvasState) {
    // Initalise testMapPoints
    canvasState.testMapPoints = [];

    // Get test points from server
    var httpReq = new XMLHttpRequest();
    httpReq.addEventListener("load", () => {
        // Request returns 2D array of MapPoints represented as simple objects, not as Path instances
        // we need to convert this
        mapPoint2DObjectArray = JSON.parse(httpReq.response);
        mapPoint2DObjectArray.forEach((innerArray) => innerArray.forEach(mapPointObject => {
            let mapPointToPush = MapPoint.mapPointFromObject(mapPointObject);
            canvasState.testMapPoints.push(mapPointToPush);
        }));
            
        // Draw points
        canvasState.draw();
    });
    httpReq.open("GET", "http://localhost/api/GetTestOSMpoints");
    httpReq.send();
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