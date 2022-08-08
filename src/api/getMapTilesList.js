var fs = require('fs');

module.exports.getMapTilesList = function () {
    let fileListing = fs.readdirSync('./mapAreaImages');

    let fileMatchRegex = /^-?\d+\.?\d*x-?\d+\.?\d+_\d+\.?\d*x.png$/g;
    let mapTileFileListing = fileListing.filter((fileName) => fileName.match(fileMatchRegex));

    let valueRegex = /-?\d+\.?\d*/g;

    let mapTileList = [];

    for (let i = 0; i < mapTileFileListing.length; i++) {
        const fileName = mapTileFileListing[i];
        
        valuesOfFileName = [...fileName.matchAll(valueRegex)];

        mapTileDetail = {
            "x": valuesOfFileName[0][0],
            "y": valuesOfFileName[1][0],
            "zoom": valuesOfFileName[2][0]
        };

        mapTileList.push(mapTileDetail);
    }

    return mapTileList
}

module.exports.mapTilesToDb = function (shared, database) {
    mapTilesList = module.exports.getMapTilesList();

    for (let i = 0; i < mapTilesList.length; i++) {
        const mapTileObj = mapTilesList[i];
        mapTileMapObj = shared.Tile.mapObjectFromObject(mapTileObj);
        database.addMapObject(mapTileMapObj);
    }
}