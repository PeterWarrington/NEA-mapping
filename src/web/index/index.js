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

    constructor () {
        this.canvas = document.getElementById("mapCanvas");
        this.ctx = this.canvas.getContext('2d');

        // Zoom functionality
        document.getElementById("zoom-in").onclick = (event) => {
            this.zoom(1);
        };

        document.getElementById("zoom-out").onclick = (event) => {
            this.zoom(-1);
        };

        // Translation functionality
        this.canvas.onmousedown = (event) => {
            this.lastPageX = event.pageX;
            this.lastPageY = event.pageY;
            this.canvasMouseDown = true;
            if (this.canvas.style.cursor == "grab")
                this.canvas.style.cursor = "grabbing";
        }
        
        this.canvas.onmouseup = (event) => {
            this.lastPageX = -1;
            this.lastPageY = -1;
            this.canvasMouseDown = false;
            if (this.canvas.style.cursor == "grabbing")
            this.canvas.style.cursor = "grab";
        }

        this.canvas.onmousemove = (event) => {
            if (this.canvasMouseDown) {
                var relativeMouseX = event.pageX - this.lastPageX;
                var relativeMouseY = event.pageY - this.lastPageY;

                this.xTranslation += relativeMouseX;
                this.yTranslation += relativeMouseY;

                this.lastPageX = event.pageX;
                this.lastPageY = event.pageY;

                this.draw();
            }
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
        let mapContainerStyles = window.getComputedStyle(document.getElementById("mapContainer"));
    
        // Resize to 100% (html decleration does not work)
        let paddingLeft = parseInt(mapContainerStyles.getPropertyValue('padding-left'));
        let paddingRight = parseInt(mapContainerStyles.getPropertyValue('padding-right'));
        let spacing = paddingLeft + paddingRight + 5;
    
        this.canvas.width = document.getElementById("mapContainer").clientWidth - spacing;
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
        this.pointsConnectingTo = pointsConnectingTo;

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

    /** Returns wether this is the last point of a path */
    get isEndOfPath() {
        return this.pointsConnectingTo == undefined;
    }

    /**
     * Connects a point to this point
     * @param {Point} pointConnectingTo The point that you want to connect this point to
     * @returns The point that you are connecting to this point
     */
    connectingTo(pointConnectingTo) {
        if (this.pointsConnectingTo == undefined)
            this.pointsConnectingTo = [];
        this.pointsConnectingTo.push(pointConnectingTo);
        return pointConnectingTo;
    }
}

class Path {
    /** The {string} used to identify the path */
    pathId
    /** The {MapPoint} object that starts the path */
    startingPoint
    /** The {canvasState} instance */
    canvasState
    /** Options for the path when drawing to screen */
    options = {
        pathFillStyle: "#e8cc4a",
        pathLineWidth: 4,
        recalculatePathFlag: false
    }

    /** Returns the line width to be displayed on the canvas */
    get lineWidth() {
        return this.options.pathLineWidth;
    }

    /**
     * Creates a path using a starting points
     * @param {MapPoint} startingPoint The {MapPoint} object that starts the path
     * @param {CanvasRenderingContext2D} ctx The {CanvasRenderingContext2D} that is used on the canvas
     * @param {object} options Options for the path when drawing to screen
     */
    constructor (startingPoint, canvasState, pathId, options={}) {
        this.startingPoint = startingPoint;
        this.canvasState = canvasState;
        this.options = {...this.options, ...options};
        this.pathId = pathId;
    }

    /**
     * Converts a tree of connecting points to a array of all points (for drawing individual points unconnectedly)
     * @param {MapPoint} startingPoints The {MapPoint[]} object containing a starting point on a path
     * @param {MapPoint[]} pathArray A sequential array of {MapPoint}s
     * @returns {MapPoint[]} 
     */
    static getAllPointsOnPath(startingPoints, pathArray=[]) {
        startingPoints.forEach(startingPoint => {
            pathArray.push(startingPoint);
            if (startingPoint.pointsConnectingTo != undefined)
                Path.getAllPointsOnPath(startingPoint.pointsConnectingTo, pathArray);
        });
        return pathArray;
    }

    /**
     * Converts a sequential array of points to a tree of connecting points
     * @param {MapPoint[]} pathArray A sequential array of {MapPoint}s
     * @returns {MapPoint} The {MapPoint} object that starts the path
     */ 
    static connectSequentialPoints(pathArray) {
        var pathArrayCopy = Object.values(Object.assign({}, pathArray)).reverse();
        for (let i = 1; i < pathArrayCopy.length; i++) {
            pathArrayCopy[i].pointsConnectingTo = [pathArrayCopy[i-1]];
        }
        return pathArrayCopy[pathArrayCopy.length - 1];
    }

    /**
     * Plots line connecting points in this.startingPoint to screen.
     */
    plotLine() {
        // Set properties
        this.canvasState.ctx.lineWidth = this.lineWidth;
        this.canvasState.ctx.strokeStyle = this.options.pathFillStyle;

        this.canvasState.ctx.beginPath();
        
        // Initialize array containing the  initial points to draw
        let startingPointsToDraw = [...this.startingPoint.pointsConnectingTo];

        // Iterate through startingPointsToDraw
        for (let i = 0; i < startingPointsToDraw.length; i++) {
            const startingPoint = startingPointsToDraw[i];
            
            // Move to the starting point
            this.canvasState.ctx.moveTo(this.startingPoint.pathPointDisplayX, this.startingPoint.pathPointDisplayY);

            // If we get to a branch, push the other branches to startingPointsToDraw to iterate through later
            let currentPoint = startingPoint;
            while (!currentPoint.isEndOfPath) {
                // Plot a line from the last plotted point to the point at currentPoint
                this.canvasState.ctx.lineTo(currentPoint.pathPointDisplayX, currentPoint.pathPointDisplayY);

                if (currentPoint.pointsConnectingTo.length > 1) {
                    for (let j = 1; j < currentPoint.pointsConnectingTo.length; j++) {
                        startingPointsToDraw.push(currentPoint.pointsConnectingTo[j]);
                    }
                }
                
                // Advance pointer to next connecting point in the closest branch
                currentPoint = currentPoint.pointsConnectingTo[0];
            }
            this.canvasState.ctx.lineTo(currentPoint.pathPointDisplayX, currentPoint.pathPointDisplayY);
            
            // Draw line to canvas
            this.canvasState.ctx.stroke();
        }
    }

    /**
     * Plots markers for points in this.startingPoint
     */
    plotPoints() {
        Path.getAllPointsOnPath([this.startingPoint]).forEach(point => point.drawPoint());
    }
}

/**
 * Function called at page load to test some points on canvas
 */
function MapTest() {
    // Create canvas state
    canvasState = new CanvasState();

    // Create path 1
    var startingPointPath1 = new MapPoint(50, 50, canvasState, {pointText: "📍\t\tPath 1"});
    startingPointPath1.connectingTo(new MapPoint(60, 55, canvasState))
    .connectingTo(new MapPoint(100, 70, canvasState))
    .connectingTo(new MapPoint(110, 100, canvasState));

    var path1 = new Path(startingPointPath1, canvasState, "Path1");

    // Create path 2
    var startingPointPath2 = new MapPoint(30, 200, canvasState, {pointText: "📍\t\tPath 2"});
    startingPointPath2.connectingTo(new MapPoint(400, 170, canvasState))
    .connectingTo(new MapPoint(300, 250, canvasState))
    .connectingTo(new MapPoint(270, 20, canvasState))
    .connectingTo(new MapPoint(120, 100, canvasState))
    .connectingTo(new MapPoint(160, 160, canvasState));

    var path2 = new Path(startingPointPath2, canvasState, "Path2");

    canvasState.paths = [path1, path2];
        
    // Draw points
    canvasState.draw();
}

// Once the page has fully loaded, call MapTest
document.addEventListener('DOMContentLoaded', MapTest, false);