const canvasLib = require('canvas');
const fs = require('fs');
const shared = require('./shared/sharedStructures.js').shared;

debug_displayAreasDrawn = false;
debug_drawAllHighwayLabelsTest = true;
debug_drawHighwayLabels_smart = true;
debug_testDB = false;

/**
 * Basic version of the index.js CanvasState, just containing properties
 * needed to draw areas to screen.
 */
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
    database = new shared.MapDataObjectDB()
    /** A {int} multiplier to represent the zoom level */
    zoomLevel = 1
    /** {int} representing how the map has been translated in x */
    xTranslation = 0
    /** {int} representing how the map has been translated in y */
    yTranslation = 0
    touchDevice = false
    /** An array of test nodes that should be drawn to screen, and nothing else, when draw() is called if not null */
    testMapPoints = null
    /** Http request */
    httpReq
    /** Time of last map data update */
    timeOfLastMapDataUpdate = 0;
    /** Map data update ongoing flag */
    mapDataUpdateOngoing = false
    /** Map data update queued flag */
    mapDataUpdateQueued = false;
    /** Contains details about last/current area drawn to screen */
    area
    /** Indicates wether stroke is on */
    stokeOn = false;
    /** Stores the value of the last number of path types drawn */
    pathTypeCountLast = 0;
    /** Maps objects onto a grid made of 10x10 squares so can be queried more quickly */
    mapObjectsGridCache;
    /** Array of points to draw (e.g, search markers are added to this) */
    pointsToDraw = []
    /** Array of paths to draw over other paths (e.g. routes) */
    pathsToDraw = []
    /** Stores Events for pinch gestures */
    pointEvents = []
    /** Store previous distance between digits */
    lastPinchDistance = 0;
    /** Indicates wether a pinch zoom is in progress */
    pinchZoomInProgress = false;

    /** Stores details of areas drawn to screen */
    areasDrawn = [];
    /** Drawn labels */
    labelsDrawn = [];

    constructor () {
        // Set up map grid cache
        this.mapObjectsGridCache = new shared.MapGridCache(this.database)
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
        let zoomChange = 1 + (0.3 * multiplier);
        if (this.zoomLevel + zoomChange < 0)
            return;
        this.zoomLevel *= zoomChange;

        this.draw();
    }

    /**
     * Calls functions to draw path to screen
     */
    draw(drawBlankCanvasOnly=false) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
        // Fill background
        this.ctx.fillStyle = "#e6e6e6";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (drawBlankCanvasOnly) return;

        let objectsOnScreen = this.getObjectsOnScreen();

        let topLayerAreas = [];
        let areas = objectsOnScreen["AREA"];
        
        // Draw lower layer areas, adding lower layer areas to topLayerAreas to draw later
        if (areas != undefined)
        for (let i = 0; i < areas.length; i++) {
            const area = areas[i];
            if (area.metadata.areaType["first_level_descriptor"] == "land") // TODO: Create "layer" property and read from this instead
                area.draw(this);
            else
                topLayerAreas.push(area);
        }

        for (let i = 0; i < topLayerAreas.length; i++) {
            const area = topLayerAreas[i];
            area.draw(this);
        }

        let complexAreas = objectsOnScreen["COMPLEX-AREA"];

        if (complexAreas != undefined)
        for (let i = 0; i < complexAreas.length; i++) {
            const complexArea = complexAreas[i];
            complexArea.draw();
        }
        
        if (this.testMapPoints != null) {
            // Halt drawing, call test draw function instead, typical drawing will not be executed
            this.#testDraw();
            return;
        }

        let paths = objectsOnScreen["PATH"];
        if (paths != undefined)
        for (let i = 0; i < paths.length; i++) {
            let path = paths[i];
            let acceptedPathTypes = this.getPathTypes();

            // Only plot line if is one of accepted path types for zoom level
            if (acceptedPathTypes.includes(path.metadata.pathType["second_level_descriptor"])
            || acceptedPathTypes.includes(path.metadata.pathType["first_level_descriptor"]))
                path.plotLine(this);
        }
        // this.database.getMapObjectsOfType("POINT").forEach(point => point.drawPoint(this));

        // Clear drawn labels
        this.labelsDrawn = [];

        // Draw highway labels
        if (paths != undefined)
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            path.drawLabel();
        }

        // Draw points and paths to draw
        this.pointsToDraw.forEach(point => point.drawPoint());
        this.pathsToDraw.forEach(path => path.plotLine());

        if (debug_displayAreasDrawn) debug_displayAreasDrawnFunc();
    }
    
    #testDraw() {
        this.testMapPoints.forEach(mapPoint => {
            mapPoint.drawPoint(this);
        });
    }

    /**
     * Returns those map objects on screen as per mapObjectsGridCache.
     */
    getObjectsOnScreen() {
        var objectsOnScreen = {};
        let xTranslation = canvasState.xTranslation;
        let yTranslation = canvasState.yTranslation;
        let zoomLevel = canvasState.zoomLevel;

        let gridSquareSize = canvasState.mapObjectsGridCache.gridSquareSize;

        let xInitial = Math.floor((-xTranslation)/gridSquareSize)*gridSquareSize - 2*gridSquareSize;
        let xIncrement = gridSquareSize;
        let xLimit = Math.floor(((canvasState.canvas.width/(zoomLevel*1.5)) - xTranslation)/gridSquareSize)*gridSquareSize + 2*gridSquareSize;

        let yInitial = Math.floor((-yTranslation)/gridSquareSize)*gridSquareSize - 2*gridSquareSize;
        let yIncrement = gridSquareSize;
        let yLimit = Math.floor(((canvasState.canvas.height/zoomLevel) - yTranslation)/gridSquareSize)*gridSquareSize + 2*gridSquareSize;

        var objectIDsAdded = new Map();

        for (let x = xInitial; 
        x < xLimit; 
        x += xIncrement) {
            for (let y = yInitial; 
            y < yLimit; 
            y += yIncrement) {
                let square = canvasState.mapObjectsGridCache.get(`${x}x${y}`);
                if (square != undefined) {
                    for (let i = 0; i < square.length; i++) {
                        const mapObjectID = square[i];
                        if (!objectIDsAdded.get(mapObjectID)) {
                            let type = mapObjectID.slice(0, mapObjectID.indexOf("_"));

                            if (objectsOnScreen[type] == undefined) objectsOnScreen[type] = [];

                            objectsOnScreen[type].push(this.database.db.get(mapObjectID));
                            objectIDsAdded.set(mapObjectID, true);
                        }
                    }
                }
            }
        }

        return objectsOnScreen;
    }

    translateToCoords(x,y,zoom=true) {
        if (zoom) canvasState.zoomLevel = 4;

        canvasState.xTranslation = -x + (75 / canvasState.zoomLevel);
        canvasState.yTranslation = -y + (200 / canvasState.zoomLevel);

        canvasState.draw();
    }

    /**
     * Returns an array of the path types to display based on zoom level
     */
    getPathTypes() {
        let pathsToDisplay = ["motorway", "primary", "trunk", "primary_link", "trunk_link", "river", "returned_route"];
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
            let startX = canvasState.database.db.get(startingPathPart.pointID).displayedX;
            let startY = canvasState.database.db.get(startingPathPart.pointID).displayedY;

            // If we get to a branch, push the other branches to startingPathPartsToDraw to iterate through later
            let currentPathPart = startingPathPart;
            while (currentPathPart.nextPathPartIDs.length >= 0) {
                canvasState.database.db.get(currentPathPart.pointID).canvasState = canvasState;
                
                // Advance pointer to next connecting point in the closest branch
                // Or if skipping, skip to the one after that if not at the end of the path
                let nextPointer = shared.PathPart.getPartByStepsAway(canvasState.database, currentPathPart, 3);

                let endX = canvasState.database.db.get(currentPathPart.pointID).displayedX;
                let endY = canvasState.database.db.get(currentPathPart.pointID).displayedY;

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
            case "returned_route":
                this.data.borderWidth = 0;
                this.data.lineWidth = 6;
                this.data.borderStyle = "none";
                this.data.fillStyle = "#ff293b"; // Red
                break;
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
            canvasState.ctx.fillText(this.metadata.osm.ref, startingPoint.displayedX, startingPoint.displayedY);
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
                        x: startingPoint.displayedX + 3, 
                        y: startingPoint.displayedY + 3, 
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
        pointText: "📍",
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

    /** Gets the x position relative to the canvas */
    get displayedX() {
        return (this.x + canvasState.xTranslation) * 1.5 * canvasState.zoomLevel;
    }

    /** Gets the y position relative to the canvas */
    get displayedY() {
        return (this.y + canvasState.yTranslation) * canvasState.zoomLevel;
    }

    /**
     * Function to draw the point to the screen
     */
     drawPoint() {
        if (canvasState == null) {
            console.warn("Canvas state not defined, unable to draw point.");
            return;
        }

        if (this.options.pointDrawMethod == "text") {
            // Draw point
            canvasState.ctx.fillStyle = this.options.pointFillStyle;
            canvasState.ctx.font = `${this.options.pointFontWidth}px ${this.options.pointFont}`;
            canvasState.ctx.fillText(this.options.pointText, this.displayedX, this.displayedY);

            // Draw label
            let xOffset = canvasState.ctx.measureText(this.options.pointText).width + 3;
            canvasState.ctx.fillStyle = this.options.pointFillStyle;
            canvasState.ctx.strokeStyle = this.options.labelBorderStyle;
            canvasState.ctx.font = `${this.options.labelFontWidth}px ${this.options.pointFont}`;
            canvasState.ctx.strokeText(this.options.labelText, this.displayedX + xOffset, this.displayedY);
            canvasState.ctx.fillText(this.options.labelText, this.displayedX + xOffset, this.displayedY);
        }
    }

    static displayedDistanceBetweenPoints(a, b) {
        return Math.sqrt((a.displayedX - b.displayedX)**2 + (a.displayedY - b.displayedY)**2);
    }

    static generatePointWithLabel(x, y, label) {
        let point = new MapPoint(x, y);
        point.options = {
            pointDrawMethod: "text",
            pointText: `📌`,
            labelText: `${label}`,
            labelFontWidth: 20,
            pointFont: "sans-serif",
            pointFontWidth: 25,
            pointFillStyle: "#878787",
            labelBorderStyle: "white",
            pathDrawPointX: 3,
            pathDrawPointY: -6
        }
        return point;
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

            if (i==0) canvasState.ctx.moveTo(mapPoint.displayedX, mapPoint.displayedY);
            else canvasState.ctx.lineTo(mapPoint.displayedX, mapPoint.displayedY);
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

class ComplexArea extends shared.ComplexArea {
    constructor(outerAreaID, innerAreaIDs) {
        super();

        this.outerAreaID = outerAreaID;
        this.innerAreaIDs = innerAreaIDs;
    }

    get outerArea() {
        return canvasState.database.db.get(this.outerAreaID);
    }

    get innerAreas() {
        return this.innerAreaIDs.map(id => canvasState.database.db.get(id));
    }

    draw() {
        if (this.outerArea == undefined) return;

        this.outerArea.setAreaDrawStyle(canvasState);
        canvasState.ctx.beginPath();

        this.outerArea.plotPath();
        let isOuterAreaClockwise = this.outerArea.isClockwise();

        // Draw inner areas that require empty hole, electing those
        // that are filled to simply be draw over the larger shape
        let innerAreasFilled = [];
        this.innerAreas.forEach(innerArea => {
            if (innerArea != undefined)
            if (innerArea.metadata.areaType["second_level_descriptor"] != "none") 
                innerAreasFilled.push(innerArea); 
            else {
                let drawInReverse = isOuterAreaClockwise == innerArea.isClockwise();
                innerArea.plotPath(drawInReverse);
            }
        });

        Area.finishFillArea();

        // Draw filled inner areas
        innerAreasFilled.forEach(area => area.draw());
    }
}

shared.ComplexArea = ComplexArea;

/** Unfortunately this class has to be fully duplicated from
 * sharedStructures unlike the other classes, otherwise it 
 * inherits shared.Area (without drawing functions) not Area
 * (with drawing functions).
 */
 ComplexAreaPart = class ComplexAreaPart extends Area {
    /**
     * {string} indicating whether the complex area part is an inner or outer part
     * of a complex area.
     */
    outerOrInner = "unknown"
    
    constructor (mapPointIDs, outerOrInner, data={}) {
        super();

        this.mapPointIDs = mapPointIDs;
        this.outerOrInner = outerOrInner;
        this.data = data;
    }

    static complexAreaPartFromObject(object) {
        let complexAreaPart = new shared.ComplexAreaPart(object.mapPointIDs, object.outerOrInner, object.data);
        complexAreaPart.ID = object.ID;
        complexAreaPart.metadata = object.metadata;
        return complexAreaPart;
    }
}

shared.ComplexAreaPart = ComplexAreaPart;

// Initialize CanvasState
canvasState = new CanvasState();

// Read file
console.log("Reading from db.json...");
data = fs.readFileSync('db.json', 'utf8');

// Convert from JSON to MapDataObjectDB
let simpleDB = JSON.parse(data);
canvasState.database = shared.MapDataObjectDB.MapDataObjectDBFromObject(simpleDB);

console.log("DB read complete.");

// Update map grid cache so that getObjectsOnScreen() works
canvasState.mapObjectsGridCache.database = canvasState.database
canvasState.mapObjectsGridCache.cacheDataToGrid();

// Set up canvas on canvasState
let squareLength = 1000;
canvasState.canvas = canvasLib.createCanvas(squareLength, squareLength);
canvasState.ctx = canvasState.canvas.getContext('2d');

// Find maximum and minimum coords in database to set canvas bounds
var minY;
var minX;
var maxY;
var maxX;

let points = canvasState.database.getMapObjectsOfType("POINT");
for (let i = 0; i < points.length; i++) {
    let point = points[i];
    if (minY == undefined || point.y < minY) {minY = point.y}
    if (minX == undefined || point.x < minX) {minX = point.x}
    if (maxY == undefined || point.y > maxY) {maxY = point.y}
    if (maxX == undefined || point.x > maxX) {maxX = point.x}
}

console.log(`minx: ${minX} miny: ${minY} maxx: ${maxX} maxy: ${maxY}`)

let zoomLevels = [0.05, 0.1, 0.2, 0.5, 1, 2, 3];

for (let i = 0; i < zoomLevels.length; i++) {
    canvasState.zoomLevel = zoomLevels[i];

    console.log(`zoomLevel: ${canvasState.zoomLevel}`);

    canvasState.yTranslation = -minY;
    
    while (-canvasState.yTranslation < maxY) {
        canvasState.xTranslation = -minX;
        while (-canvasState.xTranslation < maxX) {
            console.log(`xTranslation: ${canvasState.xTranslation}`);

            if (canvasState.getObjectsOnScreen()["AREA"] != undefined) {
                // Draw objects
                canvasState.draw()
                
                // Write canvas to png
                let fileName = `./mapAreaImages/${-canvasState.xTranslation}x${-canvasState.yTranslation}_${canvasState.zoomLevel}x.png`;
                let buffer = canvasState.canvas.toBuffer();
                fs.writeFileSync(fileName, buffer);
                console.log(`Canvas has been written to "${fileName}".`);
            }
            canvasState.xTranslation -= squareLength / (canvasState.zoomLevel * 1.5);
        }
        console.log(`yTranslation: ${canvasState.yTranslation}`);

        canvasState.yTranslation -= squareLength / canvasState.zoomLevel;
    }
}