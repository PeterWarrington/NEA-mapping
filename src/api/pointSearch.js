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
        if (mapObject instanceof shared.Path) mapObject.midpoint = shared.getPathMidpoint(mapObject, shared.database);

        let metadataAsString = JSON.stringify(mapObject.metadata);
        let regexWholeWord = new RegExp(`(\s|^|{|")+(${searchTerm})(\s|$|")+`, "gi");
        let matchesWholeWord = [...metadataAsString.matchAll(regexWholeWord)];
        let regexMatchNoWhitespace = new RegExp(`${searchTerm}`, "gi");
        let matchesNoWhitespace = [...metadataAsString.matchAll(regexMatchNoWhitespace)];
        let regexMatchSimple = new RegExp(`${searchTerm}`, "gi");
        let matchesSimple = [...metadataAsString.matchAll(regexMatchSimple)];
        let matchesIDscore = (mapObject.ID == searchTerm) ? 20 : 0;
        let score = matchesIDscore + (matchesWholeWord.length * 3)  + (matchesNoWhitespace.length * 2) + matchesSimple.length;
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