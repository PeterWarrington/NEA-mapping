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
        new shared.MapPoint(50, 50),
        new shared.MapPoint(60, 55),
        new shared.MapPoint(100, 70),
        new shared.MapPoint(110, 100)
    ]

    var path1 = shared.Path.connectSequentialPoints(pointsPath1, database);
    path1.metadata.pathType = {"first_level_descriptor": "highway", "second_level_descriptor": "primary"};


    database.addMapObject(path1);

    // Create path 2
    var pointsPath2 = [
        new shared.MapPoint(30, 200),
        new shared.MapPoint(400, 170),
        new shared.MapPoint(300, 250),
        new shared.MapPoint(270, 20),
        new shared.MapPoint(120, 100),
        new shared.MapPoint(160, 160)
    ];

    var path2 = shared.Path.connectSequentialPoints(pointsPath2, database);
    path2.metadata.pathType = {"first_level_descriptor": "highway", "second_level_descriptor": "primary"};

    database.addMapObject(path2);

    var polygonOuterPoints = [
        new shared.MapPoint(30, 210),
        new shared.MapPoint(100, 210),
        new shared.MapPoint(100, 240),
        new shared.MapPoint(30, 240)
    ]

    var polygonInnerPoints = [
        new shared.MapPoint(35, 215),
        new shared.MapPoint(95, 215),
        new shared.MapPoint(95, 235),
        new shared.MapPoint(35, 235)
    ]

    var combinedComplexPoints = polygonInnerPoints.concat(polygonOuterPoints);

    for (let i = 0; i < combinedComplexPoints.length; i++) {
        const point = combinedComplexPoints[i];
        database.addMapObject(point);
    }

    var polygonOuterIDs = polygonOuterPoints.map(point => point.ID);
    var polygonOuterArea = new shared.ComplexAreaPart(polygonOuterIDs, "outer");
    polygonOuterArea.metadata.areaType = {"first_level_descriptor": "land", "second_level_descriptor": "grass"};

    database.addMapObject(polygonOuterArea);

    var polygonInnerIDs = polygonInnerPoints.map(point => point.ID);
    var polygonInnerArea = new shared.ComplexAreaPart(polygonInnerIDs, "inner");
    polygonInnerArea.metadata.areaType = {"first_level_descriptor": "land", "second_level_descriptor": "none"};

    database.addMapObject(polygonInnerArea);

    var testComplexArea = new shared.ComplexArea(polygonOuterArea.ID, [polygonInnerArea.ID]);

    database.addMapObject(testComplexArea);

    res.send(database);
}