logger = new (require('../logging.js').Logger)();

/**
 * Uses path finding to find the shortest route from a starting point
 * to a destination, returning this to the client.
 * @param {*} shared 
 * @param {*} req 
 * @param {*} res 
 */
module.exports.findRoute = (shared, req, res) => {
    var startingPoint;
    var destinationPoint;

    let inputError = false;
    if (req.query.startingPointID != undefined && req.query.destinationPointID != undefined) {
        // Convert search terms from json
        try {
            startingPointID = JSON.parse(decodeURI(req.query.startingPointID));
            if (typeof startingPointID == "string") {
                startingPoint = shared.database.db.get(startingPointID);
                if (startingPoint == undefined) inputError = true;
            } else inputError = true;

            destinationPointID = JSON.parse(decodeURI(req.query.destinationPointID));
            if (typeof destinationPointID == "string") {
                destinationPoint = shared.database.db.get(destinationPointID);
                if (destinationPoint == undefined) inputError = true;
            } else inputError = true;
        } catch {inputError = true}
    } else inputError = true;

    if (inputError) {
        res.end("error: input");
        return;
    }

    // Find point on highway nearest to starting point
    let startingHighway = nearestHighwayPoint(startingPoint, shared);
    let destinationHighway = nearestHighwayPoint(destinationPoint, shared);

    if (startingHighway.error || destinationHighway.error) {
        res.end(`error: highway point undefined. error: {a:${startingHighway.error}, b:${destinationHighway.error}}`);
        return;
    }

    let route = dijkstras(startingHighway, destinationHighway, shared);

    res.send(route);
};

function isAcceptedPath(path) {
    return ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link"]
    .includes(path.metadata.pathType["second_level_descriptor"]);
}

function nearestHighwayPoint(pointA, shared) {
    let squaresToExamine = [shared.mapObjectsGridCache.getSurroundingSquareContent(pointA, 5)];
    let closestPoint;
    let closestPath;

    for (let i = 0; i < squaresToExamine.length; i++) {
        const square = squaresToExamine[i];
        // Find paths in square
        for (let j = 0; j < square.length; j++) {
            const mapObjA = shared.database.db.get(square[j]);
            if (!(mapObjA instanceof shared.Path && isAcceptedPath(mapObjA))) continue;

            let path = mapObjA;
            // Get points on path
            let pathPoints = path.getAllPointsOnPath(shared.database);
            for (let k = 0; k < pathPoints.length; k++) {
                const pointB = pathPoints[k];
                if (closestPoint == undefined || pointA.distanceToPoint(pointB) < pointA.distanceToPoint(closestPoint)) {
                    closestPoint = pointB;
                    closestPath = path;
                }
            }
        }
    }

    if (closestPoint == undefined) return {error: true};

    return {point: closestPoint, path: closestPath};
}

function getNeighbours(shared, currentNode, nodeList) {
    let square = shared.mapObjectsGridCache.getSquare(currentNode);
    let neighbours = square.map(id => nodeList.get(id)).filter(node => node != undefined);
    let nearbyPaths = square.filter(id => id.indexOf("PATH_") == 0).map(id => shared.database.db.get(id));
    nearbyPaths.forEach(path => {
        let pointsOnPath = path.getAllPointsOnPath(shared.database);
        let currentNodeOnPathIndex = pointsOnPath.findIndex(point => point.ID == currentNode.ID);
        if (currentNodeOnPathIndex != -1 && pointsOnPath[currentNodeOnPathIndex + 1] != undefined && nodeList.get(pointsOnPath[currentNodeOnPathIndex + 1].ID) != undefined)
            neighbours.push(pointsOnPath[currentNodeOnPathIndex + 1]);
        if (currentNodeOnPathIndex != -1 && pointsOnPath[currentNodeOnPathIndex - 1] != undefined && nodeList.get(pointsOnPath[currentNodeOnPathIndex - 1].ID) != undefined)
            neighbours.push(pointsOnPath[currentNodeOnPathIndex - 1]);
    });

    return neighbours;
}

function dijkstras(startingHighway, destinationHighway, shared) {
    class NodeProps {
        visited = false;
        distance = Infinity;
        parentID = null;
    }

    let visitedNodes = new Map();
    let unvisitedNodes = new Map();
    let nodeProps = new Map();

    shared.database.getMapObjectsOfType("PATH").filter(path => 
        isAcceptedPath(path)
    ).forEach(path =>
        path.getAllPointsOnPath(shared.database).forEach(node =>{
            unvisitedNodes.set(node.ID, node);
            nodeProps.set(node.ID, new NodeProps());
        }));

    nodeProps.set(startingHighway.point.ID, new NodeProps());
    nodeProps.set(destinationHighway.point.ID, new NodeProps());
    nodeProps.get(startingHighway.point.ID).distance = 0;

    let currentNode = startingHighway.point;
    
    while (!nodeProps.get(destinationHighway.point.ID).visited) {
        let neighbours = getNeighbours(shared, currentNode, unvisitedNodes);

        if (neighbours.every(node => nodeProps.get(node.ID).distance == Infinity)) 
            return [];

        neighbours.forEach(node => {
            let tentativeDistance = nodeProps.get(currentNode.ID).distance + currentNode.distanceToPoint(node);
            if (tentativeDistance < nodeProps.get(node.ID).distance) nodeProps.get(node.ID).distance = tentativeDistance;
            if (node.ID != currentNode.ID) nodeProps.get(node.ID).parentID = currentNode.ID;
        });

        nodeProps.get(currentNode.ID).visited = true;
        unvisitedNodes.delete(currentNode.ID);
        visitedNodes.set(currentNode.ID, currentNode);

        let nextNode;

        unvisitedNodes.forEach(node => {
            if ((nextNode == undefined || nodeProps.get(node.ID).distance < nodeProps.get(nextNode.ID).distance)) {
                nextNode = node;
            };
        })

        if (nextNode == undefined) return [];

        currentNode = nextNode;
    }

    // Backtrack to find fastest path
    currentNode = destinationHighway.point;
    let fastestPath = [];
    while (currentNode.ID != startingHighway.point.ID) {
        let parentID = nodeProps.get(currentNode.ID).parentID;
        fastestPath.push(currentNode);
        currentNode = visitedNodes.get(parentID);
    }

    return fastestPath.reverse();
}