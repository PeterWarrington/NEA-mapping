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
module.exports.pointSearchAPI = (shared, req, res) => {
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

    let searchResults = module.exports.pointSearch(searchTerm, shared);

    res.send(searchResults);
};

module.exports.pointSearch = (searchTerm, shared) => {
    // Returned database will just contain points, should not just be merged into client db
    var searchResults = [];
    let searchIndex = shared.searchIndex.map;

    for (const [id, field] of searchIndex) {
        // let regexWholeWord = new RegExp(`(\s|^|{|")+(${searchTerm})(\s|$|")+`, "gi");
        // let matchesWholeWord = [...metadataAsString.matchAll(regexWholeWord)];
        // let regexMatchNoWhitespace = new RegExp(`${searchTerm}`, "gi");
        // let matchesNoWhitespace = [...metadataAsString.matchAll(regexMatchNoWhitespace)];
        let regexMatchSimple = new RegExp(`${searchTerm}`, "gi");
        let matchesSimple = [...field.metadataAsString.matchAll(regexMatchSimple)];
        let matchesIDscore = (id == searchTerm) ? 20 : 0;
        let isPlaceScore = (field.mapObject.metadata.place != undefined && matchesSimple.length != 0) ? 15 : 0;
        let score = isPlaceScore + matchesIDscore + matchesSimple.length;
        if (score > 0) {
            let result = new SearchResult(field.mapObject, score);
            searchResults.push(result);
        }
    }

    searchResults.sort((a,b) => {
        return b.score - a.score;
    });

    searchResults = searchResults.slice(0, 20);

    return searchResults;
}

/**
 * This creates a search index which is created at start of runtime that
 * enables stringified metadata to be searched and read from fast.
 */
module.exports.SearchIndex = class SearchIndex {
    /** Maps a map object ID onto its stringified map data */
    map = new Map();

    /** Initializes the index */
    constructor (database) {
        let rootDBmapObjects = database.getMapObjectsOfType(["POINT", "PATH"]);
        rootDBmapObjects.forEach(mapObject => {
            let metadataAsString = JSON.stringify(mapObject.metadata);
            if (mapObject instanceof shared.Path) mapObject.midpoint = shared.getPathMidpoint(mapObject, shared.database);
            this.map.set(mapObject.ID, {metadataAsString, mapObject});
        });
    }
}