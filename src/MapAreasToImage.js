const canvasLib = require('canvas');
const fs = require('fs');
const shared = require('./shared/sharedStructures.js').shared;

function displayedX(x) {
    return (x * 1.5 * canvasState.zoomLevel) + canvasState.xTranslation;
}

function displayedY(y) {
    return (y * canvasState.zoomLevel) + canvasState.yTranslation;
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
}

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

let zoomLevels = [0.05, 0.1, 0.2, 0.5, 1, 2, 3];

for (let i = 0; i < zoomLevels.length; i++) {
    canvasState.zoomLevel = zoomLevels[i];

    // Find maximum and minimum coords in database to set canvas bounds
    var minYdisplayed;
    var minXdisplayed;
    var maxYdisplayed;
    var maxXdisplayed;
    var minY;
    var minX;
    var maxY;
    var maxX;

    canvasState.database.getMapObjectsOfType("POINT").forEach(point => {
        let x = displayedX(point.x);
        let y = displayedY(point.y);
    
        if (minY == undefined || y < minYdisplayed) {minYdisplayed = y; minY = point.y}
        if (minX == undefined || x < minXdisplayed) {minXdisplayed = x; minX = point.x}
        if (maxY == undefined || y > maxYdisplayed) {maxYdisplayed = y; maxY = point.y}
        if (maxX == undefined || x > maxXdisplayed) {maxXdisplayed = x; maxX = point.x}
    });

    canvasState.yTranslation = -minYdisplayed;

    var currentSquareY = minY;
    
    while (-canvasState.yTranslation < maxYdisplayed) {
        var currentSquareX = minX;
        canvasState.xTranslation = -minXdisplayed;
        while (-canvasState.xTranslation < maxXdisplayed) {
            // Draw areas
            canvasState.ctx.clearRect(0, 0, squareLength, squareLength);
            canvasState.database.getMapObjectsOfType("AREA").forEach(area => area.draw());
    
            // Write canvas to png
            let fileName = `./mapAreaImages/${currentSquareX}x${currentSquareY}_${canvasState.zoomLevel}x.png`;
            let buffer = canvasState.canvas.toBuffer();
            fs.writeFileSync(fileName, buffer);
            console.log(`Canvas has been written to "${fileName}".`);
    
            currentSquareX += (squareLength * canvasState.zoomLevel);
            canvasState.xTranslation -=  squareLength;
        }
        currentSquareY += (squareLength * canvasState.zoomLevel);
        canvasState.yTranslation -= squareLength;
    }
}