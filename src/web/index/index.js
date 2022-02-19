canvasState = undefined;
debug_displayAreasDrawn = false;
debug_drawAllHighwayLabelsTest = true;
debug_drawHighwayLabels_smart = true;

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

    /** Stores details of areas drawn to screen */
    areasDrawn = [];
    /** Drawn labels */
    labelsDrawn = [];

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

        this.updateMapData();
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
        let zoomChange = 1 + (0.3 * multiplier);
        if (this.zoomLevel + zoomChange < 0)
            return;
        this.zoomLevel *= zoomChange;

        this.draw();
        this.updateMapData();
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

        let topLayerAreas = [];
        // Draw lower layer areas, adding lower layer areas to topLayerAreas to draw later
        for (let i = 0; i < this.database.areaIDs.length; i++) {
            const areaID = this.database.areaIDs[i];
            const area = this.database.db[areaID];
            if (area.metadata.areaType["first_level_descriptor"] == "land") // TODO: Create "layer" property and read from this instead
                area.draw(this);
            else
                topLayerAreas.push(area);
        }
        for (let i = 0; i < topLayerAreas.length; i++) {
            const area = topLayerAreas[i];
            area.draw(this);
        }
        
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

        // Clear drawn labels
        this.labelsDrawn = [];

        // Draw highway labels
        for (let i = 0; i < this.database.pathIDs.length; i++) {
            const pathID = this.database.pathIDs[i];
            this.database.db[pathID].drawLabel();
        }

        if (debug_displayAreasDrawn) debug_displayAreasDrawnFunc();
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

    updateMapData(forceUpdate=false) {
        // Only continue if forceUpdate flag is set, or more than 500ms since last map data update and mapDataUpdateOngoing flag is not set
        if (!forceUpdate && (this.mapDataUpdateOngoing || Date.now() - this.timeOfLastMapDataUpdate < 500)) {
            if (!this.mapDataUpdateQueued) {
                // Try again in 1s time
                setTimeout(() => {
                    this.mapDataUpdateQueued = false;
                    this.updateMapData();
                }, 1000);
                this.mapDataUpdateQueued = true;
            }
            return;
        }

        this.mapDataUpdateOngoing = true;

        canvasState.area = {
            x: -canvasState.xTranslation - 500,
            y: -canvasState.yTranslation - 500,
            height: (getAbsoluteHeight(canvasState.canvas)+500)/canvasState.zoomLevel,
            width: (getAbsoluteWidth(canvasState.canvas) + 500)/canvasState.zoomLevel
        }

        // Check map area hasn't already been drawn
        let hasBeenDrawn = false;
        for (let i = 0; i < this.areasDrawn.length; i++) {
            const areaDrawn = this.areasDrawn[i];
            hasBeenDrawn = hasBeenDrawn || 
                (canvasState.area.x >= areaDrawn.x && canvasState.area.x + canvasState.area.width <= areaDrawn.x + areaDrawn.width 
                    && canvasState.area.y >= areaDrawn.y && canvasState.area.y + canvasState.area.height <= areaDrawn.y + areaDrawn.height)
            if (hasBeenDrawn) break;
        }

        if (!hasBeenDrawn) {
            let testURLnoMapArea = `http://localhost/api/GetDBfromQuery?pathTypes=[%22motorway%22,%22primary%22,%22trunk%22,%22primary_link%22,%22trunk_link%22,%22river%22]&&noMapAreaFilter=true`;
            let testURLlimitedArea = `http://localhost/api/GetDBfromQuery?pathTypes=[%22motorway%22,%22primary%22,%22trunk%22,%22primary_link%22,%22trunk_link%22,%22river%22]&x=48.1699954728&y=9784.703958946639&height=1317.4001900055023&width=1271.3921765555658&excludeAreas=[]`;
            let normalURL = `http://localhost/api/GetDBfromQuery?pathTypes=[%22motorway%22,%22primary%22,%22trunk%22,%22primary_link%22,%22trunk_link%22,%22river%22]&x=${canvasState.area.x}&y=${canvasState.area.y}&height=${canvasState.area.height}&width=${canvasState.area.width}&excludeAreas=${JSON.stringify(this.areasDrawn)}`;
            this.httpReq.open("GET", normalURL);
            this.httpReq.send();

            // Display loading indicator
            document.getElementById("loading-indicator-container").style.display = "block";
        } else {
            this.mapDataUpdateOngoing = false;
        }
    }

    mapDataReceiveFunc = () => {
        // Request returns db as uninstanciated object
        // we need to convert this
        var simpleDB = JSON.parse(canvasState.httpReq.response);

        if(shared.debug_on) 
            console.log(`Received JSON has ${Object.keys(simpleDB.db).length} items.`)

        var database = shared.MapDataObjectDB.MapDataObjectDBFromObject(simpleDB);

        canvasState.database.mergeWithOtherDB(database);

        if(shared.debug_on) 
            console.log(`Computed database currently has ${canvasState.database.getMapObjectsOfType("PATH").length} paths.`);

        // Draw
        canvasState.draw();

        // Add area drawn to list of areas drawn
        canvasState.areasDrawn.push(Object.assign({}, canvasState.area));

        // Update time since last map data update
        canvasState.timeOfLastMapDataUpdate = Date.now();
        
        // Update map data update ongoing flag
        canvasState.mapDataUpdateOngoing = false;

        // Hide loading indicator
        document.getElementById("loading-indicator-container").style.display = "none";
    }

    /**
     * Initiates a search
     * @param {string} input search term
     */
    search = (input) => {
        let http = new XMLHttpRequest();
        http.addEventListener("load", () => {
            console.log(http.responseText);
        });
        http.open("GET", `http://localhost/api/GetDBfromQuery?searchTerm="${input}"&noMapAreaFilter=true`);
        http.send();
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

        this.getPathStyle();
        
        // Initialize array containing the  initial PathParts to draw
        let startingPathPartsToDraw = [canvasState.database.db[this.startingPathPartID]];

        const skipOneInEveryNo = 1;

        // Iterate through startingPathPartsToDraw
        for (let i = 0; i < startingPathPartsToDraw.length; i++) {
            const startingPathPart = startingPathPartsToDraw[i];
            canvasState.database.db[startingPathPart.pointID].canvasState = canvasState;

            // Move to the starting point
            let startX = canvasState.database.db[startingPathPart.pointID].pathPointDisplayX;
            let startY = canvasState.database.db[startingPathPart.pointID].pathPointDisplayY;

            // If we get to a branch, push the other branches to startingPathPartsToDraw to iterate through later
            let currentPathPart = startingPathPart;
            while (currentPathPart.nextPathPartIDs.length >= 0) {
                canvasState.database.db[currentPathPart.pointID].canvasState = canvasState;
                
                // Advance pointer to next connecting point in the closest branch
                // Or if skipping, skip to the one after that if not at the end of the path
                let nextPointer = shared.PathPart.getPartByStepsAway(canvasState.database, currentPathPart, 3);

                let endX = canvasState.database.db[currentPathPart.pointID].pathPointDisplayX;
                let endY = canvasState.database.db[currentPathPart.pointID].pathPointDisplayY;

                let nextEndX = canvasState.database.db[nextPointer.pointID].pathPointDisplayX;
                let nextEndY = canvasState.database.db[nextPointer.pointID].pathPointDisplayY;

                // Draw point if this point is on screen, or the next point is on screen
                if (
                    areCoordsOnScreen(endX, endY, canvasState)
                        ||
                    areCoordsOnScreen(nextEndX, nextEndY, canvasState)
                ) {
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
                }
                
                for (let j = 1; j < currentPathPart.nextPathPartIDs.length; j++) {
                    startingPathPartsToDraw.push(canvasState.database.db[currentPathPart.nextPathPartIds[j]]);
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
                this.data.borderWidth = 4;
                this.data.lineWidth = 0;
                this.data.borderStyle = "#b0e1f7"; 
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
              this.data.borderWidth = 2;
              this.data.lineWidth = 3;
              this.data.borderStyle = "#d622a0"; // Pink
              this.data.fillStyle = "#e6a31e"; // Orange
              break;
            case "secondary_link":
              this.data.borderWidth = 1;
              this.data.lineWidth = 3;
              this.data.borderStyle = "#2b2b2b";
              this.data.fillStyle = "#e6a31e";
              break;
            case "tertiary":
              this.data.borderWidth = 1;
              this.data.lineWidth = 3;
              this.data.borderStyle = "#2b2b2b";
              this.data.fillStyle = "#adadad"; // Gray
              break;
            case "tertiary_link":
              this.data.borderWidth = 1;
              this.data.lineWidth = 3;
              this.data.borderStyle = "#2b2b2b";
              this.data.fillStyle = "#adadad";
              break;
            default:
              break;
          }
    }

    drawLabel() {
        canvasState.ctx.font = '8pt var(--bs-font-sans-serif)';
        canvasState.ctx.fillStyle = "black";
        canvasState.ctx.strokeStyle = "white";

        if (!debug_drawHighwayLabels_smart && debug_drawAllHighwayLabelsTest && this.metadata.osm.ref != undefined) {
            let startingPoint = canvasState.database.db[canvasState.database.db[this.startingPathPartID].pointID];
            canvasState.ctx.fillText(this.metadata.osm.ref, startingPoint.pathPointDisplayX, startingPoint.pathPointDisplayY);
        }

        if (debug_drawHighwayLabels_smart && this.metadata.osm.ref != undefined) {
            let startingPathPart = canvasState.database.db[this.startingPathPartID];
            let startingPoint = startingPathPart.getPoint(canvasState.database);
            let labelText = this.metadata.osm.ref;
            let textWidth = canvasState.ctx.measureText(labelText).width;
            let nextPart = startingPathPart.getPartByDistanceAway(canvasState.database, textWidth);
            if (!nextPart) return; // Don't draw if there isn't a suitable point to measure angle for
            let nextPoint = nextPart.getPoint(canvasState.database);

            // Get angle between startingPoint and nextPoint
            let changeInX = startingPoint.x - nextPoint.x;
            let changeInY = startingPoint.y - nextPoint.y;
            let angle = Math.atan(changeInY/changeInX);

            let newLabel = {text: labelText, 
                        x: startingPoint.pathPointDisplayX + 3, 
                        y: startingPoint.pathPointDisplayY + 3, 
                        angle: angle};

            // Only draw if there isn't another label close by and the coords are on screen.
            // Check by iterating through labels drawn
            if (!areCoordsOnScreen(newLabel.x, newLabel.y, canvasState)) return;
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

    /** Gets the x position relative to the canvas */
    get displayedX() {
        return (this.x + canvasState.xTranslation) * 1.5 * canvasState.zoomLevel;
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

    static displayedDistanceBetweenPoints(a, b) {
        return Math.sqrt((a.pathPointDisplayX - b.pathPointDisplayX)**2 + (a.pathPointDisplayY - b.pathPointDisplayY)**2);
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

    draw(canvasState) {
        // Only draw if a point of the area is on screen
        let isApointOnScreen = false;
        for (let i = 0; !isApointOnScreen && i < this.mapPointIDs.length; i++) {
            const mapPoint = canvasState.database.db[this.mapPointIDs[i]];
            if (!isApointOnScreen) isApointOnScreen = areCoordsOnScreen(mapPoint.displayedX, mapPoint.displayedY, canvasState);
        }

        if (isApointOnScreen){
            this.#setAreaDrawStyle(canvasState);
            canvasState.ctx.beginPath();

            for (let i = 0; i < this.mapPointIDs.length; i++) {
                const mapPointID = this.mapPointIDs[i];
                const mapPoint = canvasState.database.db[mapPointID];
    
                if (i==0) canvasState.ctx.moveTo(mapPoint.displayedX, mapPoint.displayedY);
                else canvasState.ctx.lineTo(mapPoint.displayedX, mapPoint.displayedY);
            }
    
            canvasState.ctx.closePath();
            canvasState.ctx.fill();
            if (canvasState.strokeOn) {
                canvasState.ctx.stroke();
                canvasState.strokeOn = false;
            }
        }
    }

    /**
     * Sets properties of how an area should be drawn to screen (such as fill colour) 
     * to be called before drawing this area.
     * @param {2D canvas context thing from HTML standard} ctx 
     */
    #setAreaDrawStyle(canvasState) {
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
            default:
                break;
        }
    }
}

shared.Area = Area;

/**
 * Function called at page load to test some points on canvas
 */
function MapTest() {
    // Create canvas state
    canvasState = new CanvasState();

    // Set up search event listener
    document.getElementById("search_input").addEventListener("keypress", function (e) {
        if (e.key == "Enter") {
            canvasState.search(document.getElementById("search_input").value);
        }
    });

    // Import test nodes
    // Translate graph so does not overlap header
    canvasState.mapTranslate(15, getAbsoluteHeight(document.getElementById("header")) + 15);

    // Drawing test overrides
    canvasState.xTranslation =  2292.886051499995;
    canvasState.yTranslation = -7349.380475070653;
    canvasState.zoomLevel =  0.5000000000000001;

    // Load correct canvas width
    canvasState.updateCanvasWidth();

    // Display blank canvas
    canvasState.draw();

    // Get test db from server
    canvasState.httpReq = new XMLHttpRequest();
    canvasState.httpReq.addEventListener("load", canvasState.mapDataReceiveFunc);

    // if(shared.debug_on) debug_viewWholeMap(canvasState);

    canvasState.updateMapData();
}

/**
 * Function that can be called for debug purposes to view the whole map.
 * Useful to verify that map data is being loaded correctly.
 * @param {*} canvasState 
 */
function debug_viewWholeMap(canvasState) {
    canvasState.xTranslation = -4021.6666666666615;
    canvasState.yTranslation = -2433.8333333333303;
    canvasState.zoomLevel = 0.10000000000000014;
}

/**
 * Display canvasState.areasDrawn on map for debug purposes.
 */
function debug_displayAreasDrawnFunc() {
    canvasState.areasDrawn.forEach(areaDrawn => {
        canvasState.ctx.beginPath();
        canvasState.ctx.lineWidth = "6";
        canvasState.ctx.strokeStyle = "red";
        canvasState.ctx.rect(
            (areaDrawn.x + canvasState.xTranslation) * canvasState.zoomLevel, 
            (areaDrawn.y + canvasState.yTranslation) * canvasState.zoomLevel, 
            areaDrawn.width * canvasState.zoomLevel, 
            areaDrawn.height * canvasState.zoomLevel
        );
        canvasState.ctx.stroke();
    })
}

function areCoordsOnScreen(x, y, canvasState) {
    return x > 0 && x < canvasState.canvas.width
            && y > 0 && y < canvasState.canvas.height;
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

function getAbsoluteWidth(el) {
    // Get the DOM Node if you pass in a string
    el = (typeof el === 'string') ? document.querySelector(el) : el; 

    var styles = window.getComputedStyle(el);
    var margin = parseFloat(styles['marginRight']) +
                    parseFloat(styles['marginLeft']);

    return Math.ceil(el.offsetWidth + margin);
}