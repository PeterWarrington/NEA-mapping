logger = new (require('../logging.js').Logger)();

class SearchResult {
    mapObject
    score

    constructor (mapObject, score) {
        this.mapObject = mapObject;
        this.score = score;
    }
}

/**
 * Conducts a search on points in root db, returning those that match
 * search params.
 * @param {*} shared 
 * @param {*} req 
 * @param {*} res 
 */
module.exports.pointSearch = (shared, req, res) => {
    // Get search params
    var searchTerm;
    let inputError = false;
    if (req.query.searchTerm != undefined) {
        // Convert search terms from json
        try {
            searchTerm = JSON.parse(decodeURI(req.query.searchTerm));
            if (!(typeof searchTerm == "string")) inputError = true
        } catch {inputError = true}
    } else inputError = true;

    if (inputError) {
        res.end("error");
        return;
    }

    // Returned database will just contain points, should not just be merged into client db
    var searchResults = [];

    // Get points from root db
    rootDBmapObjects = shared.database.getMapObjectsOfType(["POINT", "PATH"]);
    rootDBmapObjects.forEach(mapObject => {
        if (mapObject instanceof shared.Path) setPathMidPoint(mapObject, shared.database);

        let metadataAsString = JSON.stringify(mapObject.metadata);
        let regexWholeWord = new RegExp(`(\s|^|{|")+(${searchTerm})(\s|$|")+`, "gi");
        let matchesWholeWord = [...metadataAsString.matchAll(regexWholeWord)];
        let regexMatchNoWhitespace = new RegExp(`${searchTerm}`, "gi");
        let matchesNoWhitespace = [...metadataAsString.matchAll(regexMatchNoWhitespace)];
        let regexMatchSimple = new RegExp(`${searchTerm}`, "gi");
        let matchesSimple = [...metadataAsString.matchAll(regexMatchSimple)];
        let score = (matchesWholeWord.length * 3)  + (matchesNoWhitespace.length * 2) + matchesSimple.length;
        if (score > 0) {
            let result = new SearchResult(mapObject, score);
            searchResults.push(result);
        }
    });

    searchResults.sort((a,b) => {
        return b.score - a.score;
    });

    searchResults = searchResults.slice(0, 20);

    res.send(searchResults);
};

function setPathMidPoint(path, database) {
    let pathPoints = path.getAllPointsOnPath(database);

    // Sum distance of path so we can find mid point
    let distanceTotal = 0;
    let lastPoint = pathPoints[0];
    pathPoints.forEach(pathPoint => {
        distanceTotal += Math.sqrt( Math.abs(pathPoint.x - lastPoint.x)**2 + Math.abs(pathPoint.y - lastPoint.y)**2)
        lastPoint = pathPoint;
    });

    // Find point nearest to midpoint, use this as point
    let distanceTraversed = 0;
    lastPoint = pathPoints[0];
    for (let j = 0; j < pathPoints.length; j++) {
        const pathPoint = pathPoints[j];
        distanceTraversed += Math.sqrt( Math.abs(pathPoint.x - lastPoint.x)**2 + Math.abs(pathPoint.y - lastPoint.y)**2);
        if (distanceTraversed >= distanceTotal/2) {
            path.midpoint = pathPoint;
            break;
        }
        lastPoint = pathPoint;
    }
}