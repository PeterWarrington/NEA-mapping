const canvasLib = require('canvas');
const fs = require('fs');
const shared = require('./shared/sharedStructures.js').shared;

debug_displayAreasDrawn = false;
debug_drawAllHighwayLabelsTest = true;
debug_drawHighwayLabels_smart = true;
debug_testDB = false;

function displayedX(x) {
    return (x + canvasState.xTranslation) * 1.5 * canvasState.zoomLevel;
}

function displayedY(y) {
    return (y + canvasState.yTranslation) * canvasState.zoomLevel;
}

/**
 * Basic version of the index.js CanvasState, just containing properties
 * needed to draw areas to screen.
 */
class CanvasState {
    ctx
    canvas
    database
    zoomLevel = 1
    xTranslation = 0
    yTranslation = 0
    stokeOn = false
    /** Drawn labels */
    labelsDrawn = [];

    /**
     * Returns an array of the path types to display based on zoom level
     */
     getPathTypes() {
        let pathsToDisplay = ["motorway", "primary", "trunk", "primary_link", "trunk_link", "river"];
        if (this.zoomLevel > 0.05)
            pathsToDisplay = pathsToDisplay.concat(["secondary", "secondary_link"]);
        if (this.zoomLevel > 0.2)
            pathsToDisplay = pathsToDisplay.concat(["tertiary", "tertiary_link"]);
        if (this.zoomLevel > 0.4)
            pathsToDisplay = pathsToDisplay.concat(["unclassified", "residential"]);
        
        return pathsToDisplay;
    }
}

class Path extends shared.Path {
    /** The {canvasState} instance */
    canvasState

    /** Data, including options for the path when drawing to screen */
    data = {
        borderWidth: 0,
        lineWidth: 0,
        borderStyle: "none",
        fillStyle: "none"
    }

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
     plotLine() {
        if (canvasState == null) {
            console.warn("Canvas state not defined, unable to plot path.");
            return;
        }

        this.getPathStyle();
        
        // Initialize array containing the  initial PathParts to draw
        let startingPathPartsToDraw = [canvasState.database.db.get(this.startingPathPartID)];

        const skipOneInEveryNo = 1;

        // Iterate through startingPathPartsToDraw
        for (let i = 0; i < startingPathPartsToDraw.length; i++) {
            const startingPathPart = startingPathPartsToDraw[i];
            canvasState.database.db.get(startingPathPart.pointID).canvasState = canvasState;

            // Move to the starting point
            let startX = displayedX(canvasState.database.db.get(startingPathPart.pointID).x);
            let startY = displayedY(canvasState.database.db.get(startingPathPart.pointID).y);

            // If we get to a branch, push the other branches to startingPathPartsToDraw to iterate through later
            let currentPathPart = startingPathPart;
            while (currentPathPart.nextPathPartIDs.length >= 0) {
                canvasState.database.db.get(currentPathPart.pointID).canvasState = canvasState;
                
                // Advance pointer to next connecting point in the closest branch
                // Or if skipping, skip to the one after that if not at the end of the path
                let nextPointer = shared.PathPart.getPartByStepsAway(canvasState.database, currentPathPart, 3);

                let endX = displayedX(canvasState.database.db.get(currentPathPart.pointID).x);
                let endY = displayedY(canvasState.database.db.get(currentPathPart.pointID).y);

                // Plot a line from the last plotted point to the point at currentPathPart
                canvasState.ctx.beginPath();

                canvasState.ctx.lineWidth = this.data.borderWidth + this.data.lineWidth;
                canvasState.ctx.strokeStyle = this.data.borderStyle;

                canvasState.ctx.moveTo(startX, startY);
                canvasState.ctx.lineTo(endX, endY);

                canvasState.ctx.stroke();

                canvasState.ctx.beginPath();

                canvasState.ctx.lineWidth = this.data.lineWidth;
                canvasState.ctx.strokeStyle = this.data.fillStyle;

                canvasState.ctx.moveTo(startX, startY);
                canvasState.ctx.lineTo(endX, endY);

                canvasState.ctx.stroke();

                startX = endX;
                startY = endY;
                
                for (let j = 1; j < currentPathPart.nextPathPartIDs.length; j++) {
                    startingPathPartsToDraw.push(canvasState.database.db.get(currentPathPart).nextPathPartIds[j]);
                }

                if (currentPathPart.nextPathPartIDs.length == 0) break;

                currentPathPart = nextPointer;
            }
        }
    }

    /**
     * Plots points contained in tree.
     */
    plotPoints(canvasState=canvasState) {
        this.getAllPointsOnPath().forEach(point => point.drawPoint(canvasState));
    }

    /**
     * Apply a key to the style of the path. Called while drawing.
     */
    getPathStyle() {
        switch (this.metadata.pathType["first_level_descriptor"]) {
            case "water_way":
                this.data.borderWidth = 0;
                this.data.lineWidth = 4;
                this.data.borderStyle = "none"; 
                this.data.fillStyle = "#b0e1f7";
                break;
            default:
                break;
        }
        switch (this.metadata.pathType["second_level_descriptor"]) {
            case "motorway":
              this.data.borderWidth = 4;
              this.data.lineWidth = 1;
              this.data.borderStyle = "#347aeb"; // Blue
              this.data.fillStyle = "#2b2b2b";
              break;
            case "motorway_link":
              this.data.borderStyle = "#347aeb";
              this.data.fillStyle = "#2b2b2b";
              break;
            case "trunk":
              this.data.borderWidth = 2;
              this.data.lineWidth = 2;
              this.data.borderStyle = "#d622a0"; // Pink
              this.data.fillStyle = "#347aeb"; // Blue
              break;
            case "trunk_link":
              this.data.borderWidth = 2;
              this.data.lineWidth = 3;
              this.data.borderStyle = "#2b2b2b";
              this.data.fillStyle = "#d622a0"; 
              break;
            case "primary":
              this.data.borderWidth = 4;
              this.data.lineWidth = 0;
              this.data.borderStyle = "#d622a0"; // Pink
              break;
            case "primary_link":
              this.data.lineWidth = 0;
              this.data.borderStyle = "#d622a0";
              break;
            case "secondary":
              this.data.borderWidth = 0;
              this.data.lineWidth = 5;
              this.data.fillStyle = "#e6a31e"; // Orange
              break;
            case "secondary_link":
              this.data.borderWidth = 1;
              this.data.lineWidth = 4;
              this.data.borderStyle = "#2b2b2b";
              this.data.fillStyle = "#e6a31e";
              break;
            case "tertiary_link":
            case "tertiary":
            case "unclassified":
            case "residential":
                this.data.borderWidth = 1,
                this.data.lineWidth = 3,
                this.data.borderStyle = "#adadad",
                this.data.fillStyle = "#e6e6e6" // Gray 
              break;
            default:
              break;
          }

          if (this.data.borderWidth == 0 && this.data.lineWidth == 0) {
            this.data.borderWidth = 1,
            this.data.lineWidth = 3,
            this.data.borderStyle = "#adadad",
            this.data.fillStyle = "#e6e6e6" // Gray 
          }
    }

    drawLabel() {
        canvasState.ctx.font = '10px sans-serif';
        canvasState.ctx.fillStyle = "black";
        canvasState.ctx.strokeStyle = "white";

        if (!debug_drawHighwayLabels_smart && debug_drawAllHighwayLabelsTest && this.metadata.osm.ref != undefined) {
            let startingPoint = canvasState.database.db.get(canvasState.database.db.get(this.startingPathPartID).pointID);
            canvasState.ctx.fillText(this.metadata.osm.ref, displayedX(startingPoint.x), displayedY(startingPoint.y));
        }

        if (debug_drawHighwayLabels_smart) {
            let startingPathPart = canvasState.database.db.get(this.startingPathPartID);
            let startingPoint = startingPathPart.getPoint(canvasState.database);
            
            // Get label text
            let labelText;
            if (this.metadata.osm.ref != undefined) labelText = this.metadata.osm.ref;
            else if (this.metadata.osm.name != undefined) labelText = this.metadata.osm.name;

            if (labelText == undefined) return;

            let textWidth = labelText.length * 6.5;
            let nextPart = startingPathPart.getPartByDistanceAway(canvasState.database, textWidth);
            if (!nextPart) return; // Don't draw if there isn't a suitable point to measure angle for
            let nextPoint = nextPart.getPoint(canvasState.database);

            // Get angle between startingPoint and nextPoint
            let changeInX = startingPoint.x - nextPoint.x;
            let changeInY = startingPoint.y - nextPoint.y;
            let angle = Math.atan(changeInY/changeInX);

            let newLabel = {text: labelText, 
                        x: displayedX(startingPoint.x) + 3, 
                        y: displayedY(startingPoint.y) + 3, 
                        angle: angle};

            // Only draw if there isn't another label close by and the coords are on screen.
            // Check by iterating through labels drawn
            for (let i = 0; i < canvasState.labelsDrawn.length; i++) {
                const oldLabel = canvasState.labelsDrawn[i];
                let minDistanceAwayFromOtherLabels = textWidth;
                if (Math.abs(newLabel.x - oldLabel.x) < minDistanceAwayFromOtherLabels || Math.abs(newLabel.y - oldLabel.y) < minDistanceAwayFromOtherLabels)
                    return;
            }

            // Move origin to starting point (rotation is done about origin)
            canvasState.ctx.translate(newLabel.x, newLabel.y);
            // Set angle of label drawing
            canvasState.ctx.rotate(newLabel.angle);

            // Draw label
            canvasState.ctx.strokeText(newLabel.text, 0, 0);
            canvasState.ctx.fillText(newLabel.text, 0, 0);

            // Reset angle and translation
            canvasState.ctx.setTransform(1, 0, 0, 1, 0, 0);

            // Add label to labels drawn
            if (!canvasState.labelsDrawn.includes(newLabel))
                canvasState.labelsDrawn.push(newLabel);
        }
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

    /**
     * Get the nearest part at least distance away
     * @param {MapDataObjectDB} database 
     * @param {Number} distance 
     * @returns {PathPart} or false if not found.
     */
     getPartByDistanceAway(database, distance) {
        let possiblePart = this;
        let getDistance = () => 
            MapPoint.displayedDistanceBetweenPoints(
            possiblePart.getPoint(database),
            this.getPoint(database));

        while (getDistance() < distance) {
            let nextPart = possiblePart.getNextPart(database);
            if (!nextPart) return false;
            else possiblePart = nextPart;
        }

        return possiblePart;
    }
}

shared.PathPart = PathPart;

class MapPoint extends shared.MapPoint {
    canvasState

    /** Options for the point when drawing to screen */
    options = {
        pointDrawMethod: "none",
        pointText: "•",
        pointFont: "sans-serif",
        pointFontWidth: 16,
        pointFillStyle: "#878787",
        pathDrawPointX: 3,
        pathDrawPointY: -6
    }

    /**
     * Creates a point that can form part of a path and be displayed on a canvas.
     * @param {int} x Fixed x position of point in relation to others
     * @param {int} y Fixed y position of point in relation to others
     * @param {object} options Options for the point when drawing to screen
     * @param {object} metadata Optional metadata
     */
     constructor (x, y, metadata={}) {
        super();

        this.x = x;
        this.y = y;

        this.metadata = metadata;
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
            canvasState.ctx.fillText(this.options.pointText, displayedX(this.x), displayedY(this.y));
        }
    }

    static displayedDistanceBetweenPoints(a, b) {
        return Math.sqrt((displayedX(a.x) - displayedY(b.y))**2 + (displayedX(a.x) - displayedY(b.y))**2);
    }
}

// This is needed so that references to MapPoints in shared.js references MapPoints with the client functionality defined here
shared.MapPoint = MapPoint;

class Area extends shared.Area {
    constructor (mapPointIDs, data={}) {
        super();
        
        this.mapPointIDs = mapPointIDs;
        this.data = data;
    }

    draw() {
        this.setAreaDrawStyle(canvasState);
        canvasState.ctx.beginPath();

        this.plotPath();

        Area.finishFillArea();
    }

    plotPath(reverse=false) {
        /** Might need to reverse in order to plot hole.
         * This is because JS canvas only draws a hole
         * if one polygon is drawn in opposite direction
         * to the other (e.g. anticlockwise and clockwise).
        */
       let mapPointIDs = this.mapPointIDs.slice(0); // Clone array
       if (reverse) mapPointIDs = mapPointIDs.reverse();

        for (let i = 0; i < mapPointIDs.length; i++) {
            const mapPointID = mapPointIDs[i];
            const mapPoint = canvasState.database.db.get(mapPointID);

            let x = displayedX(mapPoint.x);
            let y = displayedY(mapPoint.y);

            if (i==0) canvasState.ctx.moveTo(x, y);
            else canvasState.ctx.lineTo(x, y);
        }

        canvasState.ctx.closePath();
    }

    static finishFillArea() {
        canvasState.ctx.fill();
        if (canvasState.strokeOn) {
            canvasState.ctx.stroke();
            canvasState.strokeOn = false;
        }
    }

    static isClockwise(pointIDs) {
        // https://stackoverflow.com/a/1165943
        let areaSum = 0;
        for (let i = 0; i < pointIDs.length - 1; i++) {
            const point = canvasState.database.db.get(pointIDs[i]);
            const pointAfter = canvasState.database.db.get(pointIDs[i+1]);
            areaSum += (pointAfter.x - point.x) * (pointAfter.y + pointAfter.y);
        }
        return areaSum >= 0;
    }

    isClockwise() {
        return Area.isClockwise(this.mapPointIDs);
    }

    /**
     * Sets properties of how an area should be drawn to screen (such as fill colour) 
     * to be called before drawing this area.
     * @param {2D canvas context thing from HTML standard} ctx 
     */
    setAreaDrawStyle(canvasState) {
        let ctx = canvasState.ctx;

        if (this.metadata.areaType != undefined && this.metadata.areaType["first_level_descriptor"] != undefined)
        switch (this.metadata.areaType["first_level_descriptor"]) {
            case "water_area":
                ctx.fillStyle = "#8fafe3"; 
                break;
            case "land":
                ctx.fillStyle = "#bfbfbf";
                break;
            default:
                ctx.fillStyle = "#ffffff";
                break;
        }

        if (this.metadata.areaType != undefined && this.metadata.areaType["second_level_descriptor"] != undefined)
        switch (this.metadata.areaType["second_level_descriptor"]) {
            case "allotments":
            case "farmland":
            case "farmyard":
            case "flowerbed":
            case "forest":
            case "meadow":
            case "orchard":
            case "vineyard":
            case "grass":
            case "recreation_ground":
            case "village_green":
            case "plant_nursery":
                ctx.fillStyle = "#ace0a1";
                break;
            case "basin":
            case "reservoir":
            case "salt_pond":
                ctx.fillStyle = "#8fafe3";
                break;
            case "none":
                ctx.fillStyle = "rgba(255, 255, 255, 0)";
                break;
            default:
                break;
        }
    }
}

shared.Area = Area;

// Initialize CanvasState
canvasState = new CanvasState();

// Read file
console.log("Reading from db.json...");
data = fs.readFileSync('db.json', 'utf8');

// Convert from JSON to MapDataObjectDB
let simpleDB = JSON.parse(data);
canvasState.database = shared.MapDataObjectDB.MapDataObjectDBFromObject(simpleDB);

console.log("DB read complete.");

// Set up canvas on canvasState

let squareLength = 1000;
canvasState.canvas = canvasLib.createCanvas(squareLength, squareLength);
canvasState.ctx = canvasState.canvas.getContext('2d');

// let zoomLevels = [0.05, 0.1, 0.2, 0.5, 1, 2, 3];

let zoomLevels = [0.5];

for (let i = 0; i < zoomLevels.length; i++) {
    canvasState.zoomLevel = zoomLevels[i];

    // Find maximum and minimum coords in database to set canvas bounds
    var minY;
    var minX;
    var maxY;
    var maxX;

    canvasState.database.getMapObjectsOfType("POINT").forEach(point => {
        if (minY == undefined || point.y < minY) {minY = point.y}
        if (minX == undefined || point.x < minX) {minX = point.x}
        if (maxY == undefined || point.y > maxY) {maxY = point.y}
        if (maxX == undefined || point.x > maxX) {maxX = point.x}
    });

    canvasState.yTranslation = -(minY * canvasState.zoomLevel);

    var currentSquareY = minY;
    
    while (-canvasState.yTranslation < maxY * canvasState.zoomLevel) {
        var currentSquareX = minX;
        canvasState.xTranslation = -(minX * 1.5 * canvasState.zoomLevel);
        while (-canvasState.xTranslation < maxX * canvasState.zoomLevel * 1.5) {
            // Draw objects
            canvasState.ctx.clearRect(0, 0, squareLength, squareLength);
            canvasState.database.getMapObjectsOfType("AREA").forEach(area => area.draw());

            let acceptedPathTypes = canvasState.getPathTypes();

            canvasState.database.getMapObjectsOfType("PATH").forEach(path => {
                // Only plot line if is one of accepted path types for zoom level
                if (acceptedPathTypes.includes(path.metadata.pathType["second_level_descriptor"])
                || acceptedPathTypes.includes(path.metadata.pathType["first_level_descriptor"]))
                    path.plotLine(this);
            });
            
            // Write canvas to png
            let fileName = `./mapAreaImages/${currentSquareX}x${currentSquareY}_${canvasState.zoomLevel}x.png`;
            let buffer = canvasState.canvas.toBuffer();
            fs.writeFileSync(fileName, buffer);
            console.log(`Canvas has been written to "${fileName}".`);
    
            currentSquareX += squareLength * 1.5 * canvasState.zoomLevel;
            canvasState.xTranslation -= squareLength;
        }
        currentSquareY += squareLength * canvasState.zoomLevel;
        canvasState.yTranslation -= squareLength;
    }
}