/**
 * Sends test database containing test paths as JSON data back to the client.
 * @param {Object} shared The shared structures
 * @param {*} req 
 * @param {*} res 
 */
module.exports.getTestDB = function (shared, req, res) {
    var database = new shared.MapDataObjectDB();

    // Create path 1
    var pointsPath1 = [
        new shared.MapPoint(50, 50, {pointText: "•\t\tPath 1"}),
        new shared.MapPoint(60, 55),
        new shared.MapPoint(100, 70),
        new shared.MapPoint(110, 100)
    ]

    var path1 = shared.Path.connectSequentialPoints(pointsPath1, database);
    database.addMapObject(path1);

    // Create path 2
    var pointsPath2 = [
        new shared.MapPoint(30, 200, {pointText: "•\t\tPath 2"}),
        new shared.MapPoint(400, 170),
        new shared.MapPoint(300, 250),
        new shared.MapPoint(270, 20),
        new shared.MapPoint(120, 100),
        new shared.MapPoint(160, 160)
    ];

    var path2 = shared.Path.connectSequentialPoints(pointsPath2, database);
    database.addMapObject(path2);

    res.send(database);
}