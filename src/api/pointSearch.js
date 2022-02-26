logger = new (require('../logging.js').Logger)();

class SearchResult {
    point 
    score

    constructor (point, score) {
        this.point = point;
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
    rootDBpoints = shared.database.getMapObjectsOfType("POINT");
    rootDBpoints.forEach(point => {
        let metadataAsString = JSON.stringify(point.metadata);
        let regexWholeWord = new RegExp(`(\s|^|{|")+(${searchTerm})(\s|$|")+`, "gi");
        let matchesWholeWord = [...metadataAsString.matchAll(regexWholeWord)];
        let regexMatchSimple = new RegExp(`${searchTerm}`, "gi");
        let matchesSimple = [...metadataAsString.matchAll(regexMatchSimple)];
        let score = (matchesWholeWord.length * 2)  + matchesSimple.length;
        if (score > 0) {
            let result = new SearchResult(point, score);
            searchResults.push(result);
        }
    });

    searchResults.sort((a,b) => {
        return b.score - a.score;
    });

    searchResults = searchResults.slice(0, 20);

    res.send(searchResults);
};