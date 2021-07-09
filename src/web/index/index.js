var zoomLevel = 1;

class MapPoint {
    x
    y

    get displayedX() {
        return this.x * zoomLevel;
    }

    get displayedY() {
        return this.y * zoomLevel;
    }

    get pathPointDisplayX() {
        return this.displayedX + this.options.pathDrawPointX;
    }

    get pathPointDisplayY() {
        return this.displayedY + this.options.pathDrawPointY;
    }

    ctx
    options = {
        pointDrawMethod: "text",
        pointText: "📍",
        pointFont: "sans-serif",
        pointFontWidth: 16,
        pointFillStyle: "#F6CA02",
        pathDrawPointX: 5,
        pathDrawPointY: 1
    }

    pointConnectingTo
    constructor (x, y, ctx, pointConnectingTo=undefined, options={}) {
        this.x = x;
        this.y = y;
        this.ctx = ctx;
        this.pointConnectingTo = pointConnectingTo;

        this.options = {...this.options, ...options};
    }

    drawPoint() {
        this.ctx.fillStyle = this.options.pointFillStyle;
        this.ctx.font = `${this.options.pointFontWidth}px ${this.options.pointFont}`;
        this.ctx.fillText(this.options.pointText, this.displayedX, this.displayedY);
    }

    get isEndOfPath() {
        return this.pointConnectingTo == undefined;
    }
}

class Path {
    startingPoint
    ctx
    options = {
        pathFillStyle: "#e8cc4a",
        pathLineWidth: 4,
        recalculatePathFlag: false
    }

    get lineWidth() {
        return this.options.pathLineWidth;
    }

    constructor (startingPoint, ctx, options={}) {
        this.startingPoint = startingPoint;
        this.ctx = ctx;
        this.options = {...this.options, ...options};
    }

    // Converts a tree of connecting points to a sequential array of points
    static nodeTreeToFlatArray(startingPoint, pathArray=[]) {
        pathArray.push(startingPoint);
        if (startingPoint.isEndOfPath) {
            return pathArray;
        } else {
            return Path.nodeTreeToFlatArray(startingPoint.pointConnectingTo, pathArray);
        }
    }

    // Converts a sequential array of points to a tree of connecting points
    static connectSequentialPoints(pathArray) {
        pathArray = pathArray.reverse();
        for (let i = 1; i < pathArray.length; i++) {
            pathArray[i].pointConnectingTo = pathArray[i-1];
        }
        return pathArray[pathArray.length - 1];
    }

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

    plotPoints() {
        Path.nodeTreeToFlatArray(this.startingPoint).forEach(point => point.drawPoint());
    }
}

function MapTest() {
    var canvas = document.getElementById("mapCanvas");

    // Resize to 100% (html decleration does not work)
    canvas.width = document.getElementById("mapContainer").clientWidth;

    var ctx = canvas.getContext("2d");

    // Fill background
    ctx.fillStyle = "#e6e6e6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    path.plotPoints();
    path.plotLine();
}

document.addEventListener('DOMContentLoaded', MapTest, false);