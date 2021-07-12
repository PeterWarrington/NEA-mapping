/** A {int} multiplier to represent the zoom level */
var zoomLevel = 1;
/** A {Path} displayed on the map */
var path;
/** The {CanvasRenderingContext2D} that is used on the canvas */
var ctx;
/** The canvas element that displays the map */
var canvas;

class MapPoint {
    /** Fixed x position of point in relation to others */
    x
    /** Fixed y position of point in relation to others */
    y

    /** Gets the x position relative to the canvas */
    get displayedX() {
        return this.x * zoomLevel;
    }

    /** Gets the y position relative to the canvas */
    get displayedY() {
        return this.y * zoomLevel;
    }

    /** Gets the x position of where the path should be drawn relative to canvas */
    get pathPointDisplayX() {
        return this.displayedX + this.options.pathDrawPointX;
    }

    /** Gets the y position of where the path should be drawn relative to canvas */
    get pathPointDisplayY() {
        return this.displayedY + this.options.pathDrawPointY;
    }

    /** The {CanvasRenderingContext2D} that is used on the canvas */
    ctx

    /** Options for the point when drawing to screen */
    options = {
        pointDrawMethod: "text",
        pointText: "📍",
        pointFont: "sans-serif",
        pointFontWidth: 16,
        pointFillStyle: "#F6CA02",
        pathDrawPointX: 5,
        pathDrawPointY: 1
    }

    /** The sequential {MapPoint} that follows this one. Can be undefined. */
    pointConnectingTo
    /**
     * Creates a point that can form part of a path and be displayed on a canvas.
     * @param {int} x Fixed x position of point in relation to others
     * @param {int} y Fixed y position of point in relation to others
     * @param {CanvasRenderingContext2D} ctx The {CanvasRenderingContext2D} that is used on the canvas
     * @param {MapPoint} pointConnectingTo The sequential {MapPoint} that follows this one. Can be undefined.
     * @param {object} options Options for the point when drawing to screen
     */
    constructor (x, y, ctx, pointConnectingTo=undefined, options={}) {
        this.x = x;
        this.y = y;
        this.ctx = ctx;
        this.pointConnectingTo = pointConnectingTo;

        this.options = {...this.options, ...options};
    }

    /**
     * Function to draw the point to the screen
     */
    drawPoint() {
        this.ctx.fillStyle = this.options.pointFillStyle;
        this.ctx.font = `${this.options.pointFontWidth}px ${this.options.pointFont}`;
        this.ctx.fillText(this.options.pointText, this.displayedX, this.displayedY);
    }

    /** Returns wether this is the last point of a path */
    get isEndOfPath() {
        return this.pointConnectingTo == undefined;
    }
}

class Path {
    /** The {MapPoint} object that starts the path */
    startingPoint
    /** The {CanvasRenderingContext2D} that is used on the canvas */
    ctx
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
    constructor (startingPoint, ctx, options={}) {
        this.startingPoint = startingPoint;
        this.ctx = ctx;
        this.options = {...this.options, ...options};
    }

    /**
     * Converts a tree of connecting points to a sequential array of points
     * @param {MapPoint} startingPoint The {MapPoint} object that starts the path
     * @param {MapPoint[]} pathArray A sequential array of {MapPoint}s
     * @returns 
     */
    static nodeTreeToFlatArray(startingPoint, pathArray=[]) {
        pathArray.push(startingPoint);
        if (startingPoint.isEndOfPath) {
            return pathArray;
        } else {
            return Path.nodeTreeToFlatArray(startingPoint.pointConnectingTo, pathArray);
        }
    }

    /**
     * Converts a sequential array of points to a tree of connecting points
     * @param {MapPoint[]} pathArray A sequential array of {MapPoint}s
     * @returns The {MapPoint} object that starts the path
     */ 
    static connectSequentialPoints(pathArray) {
        pathArray = pathArray.reverse();
        for (let i = 1; i < pathArray.length; i++) {
            pathArray[i].pointConnectingTo = pathArray[i-1];
        }
        return pathArray[pathArray.length - 1];
    }

    /**
     * Plots line connecting points in this.startingPoint to screen.
     */
    plotLine() {
        // Convert node tree to flat array
        if (this.pathPointArray == undefined || this.options.recalculatePathFlag == true) {
            this.pathPointArray = Path.nodeTreeToFlatArray(this.startingPoint);
            this.options.recalculatePathFlag = false;
        }

        this.ctx.lineWidth = this.lineWidth;
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.options.pathFillStyle;
        
        // We need to plot the first point differently to the other points
        let firstPoint = this.pathPointArray[0];
        this.ctx.moveTo(firstPoint.pathPointDisplayX, firstPoint.pathPointDisplayY);
        this.pathPointArray.shift();

        // Plot other points
        this.pathPointArray.forEach(point => {
            this.ctx.lineTo(point.pathPointDisplayX, point.pathPointDisplayY);
        });

        // Draw line to canvas
        this.ctx.stroke();
    }

    /**
     * Plots markers for points in this.startingPoint
     */
    plotPoints() {
        Path.nodeTreeToFlatArray(this.startingPoint).forEach(point => point.drawPoint());
    }
}

/**
 * Function called at page load to test some points on canvas
 */
function MapTest() {
    canvas = document.getElementById("mapCanvas");
    ctx = canvas.getContext('2d');

    // Resize to 100% (html decleration does not work)
    canvas.width = document.getElementById("mapContainer").clientWidth;

    draw();

    document.getElementById("zoom-in").onclick = (event) => {
        zoomLevel += 0.1;
        draw();
    };

    document.getElementById("zoom-out").onclick = (event) => {
        zoomLevel -= 0.1;
        draw();
    };
}

/**
 * Updates data structures for points
 */
function updatePath() {
    // Create array of points to plot in sequential order
    pathPointArray = [
        new MapPoint(50, 50, ctx),
        new MapPoint(60, 55, ctx),
        new MapPoint(100, 70, ctx),
        new MapPoint(110, 100, ctx)
    ];

    // Convert points to a connecting set of points
    startingPoint = Path.connectSequentialPoints(pathPointArray);

    path = new Path(startingPoint, ctx);
}

/**
 * Calls functions to draw path to screen
 */
function draw() {
    updatePath();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill background
    ctx.fillStyle = "#e6e6e6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    path.plotPoints();
    path.plotLine();
}

document.addEventListener('DOMContentLoaded', MapTest, false);