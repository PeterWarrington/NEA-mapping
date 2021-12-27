testPointsMode = false;
canvasState = undefined;

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
    /** The database containing map points */
    database
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
        this.xTranslation += (translateX / this.zoomLevel);
        this.yTranslation += (translateY / this.zoomLevel);
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

        for (let i = 0; i < this.database.pathIDs.length; i++) {
            const pathID = this.database.pathIDs[i];
            this.database.db[pathID].plotLine(this);
        }
        // this.database.getMapObjectsOfType("POINT").forEach(point => point.drawPoint(this));
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
     * @param {string} startingPathPartID The ID of the path part that starts the path
     * @param {CanvasState} canvasState 
     * @param {object} data Options, etc
     */
    constructor (startingPathPartID=null, data={}) {
        super();
        this.startingPathPartID = startingPathPartID;
        this.data = {...this.data, ...data};
    }

    /**
     * Plots line by traversing tree.
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
        let startingPathPartsToDraw = [database.db[this.startingPathPartID]];

        const skipOneInEveryNo = 1;

        // Iterate through startingPathPartsToDraw
        for (let i = 0; i < startingPathPartsToDraw.length; i++) {
            const startingPathPart = startingPathPartsToDraw[i];
            database.db[startingPathPart.pointID].canvasState = canvasState;

            // Move to the starting point
            canvasState.ctx.moveTo(database.db[startingPathPart.pointID].pathPointDisplayX, 
                database.db[startingPathPart.pointID].pathPointDisplayY);

            // If we get to a branch, push the other branches to startingPathPartsToDraw to iterate through later
            let currentPathPart = startingPathPart;
            var counter = 0;
            while (currentPathPart.nextPathPartIDs.length != 0) {
                database.db[currentPathPart.pointID].canvasState = canvasState;
                
                // Advance pointer to next connecting point in the closest branch
                // Or if skipping, skip to the one after that if not at the end of the path
                let nextPointer = shared.PathPart.getPartByStepsAway(database, currentPathPart, 3);

                // Draw point if this point is on screen, or the next point is on screen
                if (
                    areCoordsOnScreen(database.db[currentPathPart.pointID].pathPointDisplayX, 
                    database.db[currentPathPart.pointID].pathPointDisplayY, canvasState)
                        ||
                    areCoordsOnScreen(database.db[nextPointer.pointID].pathPointDisplayX, 
                        database.db[nextPointer.pointID].pathPointDisplayY, canvasState)
                ) {
                    // Plot a line from the last plotted point to the point at currentPathPart
                    canvasState.ctx.lineTo(database.db[currentPathPart.pointID].pathPointDisplayX, 
                        database.db[currentPathPart.pointID].pathPointDisplayY);
                }
                
                for (let j = 1; j < currentPathPart.nextPathPartIDs.length; j++) {
                    startingPathPartsToDraw.push(database.db[currentPathPart.nextPathPartIds[j]]);
                }

                currentPathPart = nextPointer;

                counter++;
            }
            canvasState.ctx.lineTo(database.db[currentPathPart.pointID].pathPointDisplayX, 
                database.db[currentPathPart.pointID].pathPointDisplayY);
            
            // Draw line to canvas
            canvasState.ctx.stroke();
        }
    }

    /**
     * Plots points contained in tree.
     */
    plotPoints(canvasState=canvasState) {
        this.getAllPointsOnPath().forEach(point => point.drawPoint(canvasState));
    }
}

// This is needed so that references to Paths in shared.js reference Paths with the client functionality defined here
shared.Path = Path;

class PathPart extends shared.PathPart {
    /**
     * @param {string} pointID The ID of the point referenced by this path part
     * @param {string} nextPathPartIDs Array of IDs of the next part(s) in the path
     */
     constructor (pointID=null, nextPathPartIDs=[], metadata={}) {
        super();
        
        this.pointID = pointID;
        this.nextPathPartIDs = nextPathPartIDs;
        this.metadata = metadata
    }
}

shared.PathPart = PathPart;

class MapPoint extends shared.MapPoint {
    canvasState

    /**
     * Creates a point that can form part of a path and be displayed on a canvas.
     * @param {int} x Fixed x position of point in relation to others
     * @param {int} y Fixed y position of point in relation to others
     * @param {object} options Options for the point when drawing to screen
     * @param {object} metadata Optional metadata
     */
     constructor (x, y, options={}, metadata={}) {
        super();

        this.x = x;
        this.y = y;

        this.metadata = metadata;

        this.options = {...this.options, ...options};
    }

    /** Gets the x position relative to the canvas */
    get displayedX() {
        return (this.x + canvasState.xTranslation) * canvasState.zoomLevel;
    }

    /** Gets the y position relative to the canvas */
    get displayedY() {
        return (this.y + canvasState.yTranslation) * canvasState.zoomLevel;
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

        if (this.options.pointDrawMethod == "text") {
            canvasState.ctx.fillStyle = this.options.pointFillStyle;
            canvasState.ctx.font = `${this.options.pointFontWidth}px ${this.options.pointFont}`;
            canvasState.ctx.fillText(this.options.pointText, this.displayedX, this.displayedY);
        }
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

    // Drawing test overrides
    canvasState.xTranslation =  -5474.999999999993;
    canvasState.yTranslation = -3806.499999999995;
    canvasState.zoomLevel =  0.5000000000000001;

    // Display loading message.
    canvasState.updateCanvasWidth();
    canvasState.ctx.fillStyle = "#878787";
    canvasState.ctx.font = `20pt sans-serif`;
    canvasState.ctx.fillText("Loading map data...", 70, 110);

    // Get test db from server
    var httpReq = new XMLHttpRequest();
    httpReq.addEventListener("load", () => {
        // Request returns db as uninstanciated object
        // we need to convert this
        simpleDB = JSON.parse(httpReq.response);
        database = shared.MapDataObjectDB.MapDataObjectDBFromObject(simpleDB);
        
        canvasState.database = database;

        // Draw
        canvasState.draw();
    });
    httpReq.open("GET", "http://localhost/api/GetDBfromQuery");
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
    httpReq.open("GET", `http://localhost/api/GetDBfromQuery?highways=[%22motorway%22]`);
    httpReq.send();
}

function areCoordsOnScreen(x, y, canvasState) {
    return (x + canvasState.xTranslation) > 0 && (x + canvasState.xTranslation) < canvasState.canvas.width
            && (y + canvasState.yTranslation) > 0 && (y + canvasState.yTranslation) < canvasState.canvas.height;
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