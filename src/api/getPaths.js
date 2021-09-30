/**
 * Sends test paths as JSON data back to the client.
 * @param {Object} shared The shared structures
 * @param {*} req 
 * @param {*} res 
 */
module.exports.getPaths = function (shared, req, res) {
    canvasState = null;

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

    var paths = [path1, path2];

    res.send(paths);
}