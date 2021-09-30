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

/**
 * Function called at page load to test some points on canvas
 */
function MapTest() {
    // Create canvas state
    canvasState = new CanvasState();

    // Create path 1
    var startingPathPart1 = new shared.PathPart(new shared.MapPoint(50, 50, canvasState, {pointText: "📍\t\tPath 1"}));
    startingPathPart1.connectingTo(new shared.MapPoint(60, 55, canvasState))
    .connectingTo(new shared.MapPoint(100, 70, canvasState))
    .connectingTo(new shared.MapPoint(110, 100, canvasState));

    var path1 = new shared.Path(startingPathPart1, canvasState, "Path1");

    // Create path 2
    var startingPathPart2 = new shared.PathPart(new shared.MapPoint(30, 200, canvasState, {pointText: "📍\t\tPath 2"}));
    startingPathPart2.connectingTo(new shared.MapPoint(400, 170, canvasState))
    .connectingTo(new shared.MapPoint(300, 250, canvasState))
    .connectingTo(new shared.MapPoint(270, 20, canvasState))
    .connectingTo(new shared.MapPoint(120, 100, canvasState))
    .connectingTo(new shared.MapPoint(160, 160, canvasState));

    var path2 = new shared.Path(startingPathPart2, canvasState, "Path2");

    canvasState.paths = [path1, path2];

    // Translate graph so does not overlap header
    canvasState.mapTranslate(15, getAbsoluteHeight(document.getElementById("header")) + 15);
        
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