// Executed by ThreadedConvertFromOSM
var shared = require('./shared/sharedStructures.js').shared;

var lowerBound;
var upperBound;
var roadWays;
var nodes;

process.on('message', (m) => {
    if (m.lowerBound != undefined)
        lowerBound = m.lowerBound
    if (m.upperBound != undefined)
        upperBound = m.upperBound;
    if (m.roadWays != undefined)
        roadWays = m.roadWays;
    if (m.nodes != undefined)
        nodes = m.nodes;

    if (lowerBound == undefined || upperBound == undefined || roadWays == undefined || nodes == undefined)
        return;

    var gcInterval = Math.floor(roadWays.length / 100);

    for (let w = 0; w < roadWays.length; w++) {
        console.log(w+lowerBound);
        
        // Force garbage collection at intervals
        if (w % gcInterval == 0 && global.gc) global.gc();

        var mapPoints2Darray = []
        const roadWay = roadWays[w];
        
        // Extract node references to add
        var nodeRefsOfWay = [];
        for (let e = 0; e < roadWay.elements.length; e++) {
          const element = roadWay.elements[e];
          if (element.name == "nd") nodeRefsOfWay.push(element.attributes.ref);
        }
  
        // Extract nodes from node references to add
        var mapPointsOfWay = [];
        for (let n = 0; n < nodes.length; n++) {
          const node = nodes[n];
          if (nodeRefsOfWay.includes(node.attributes.id)) {
            var mapPoint = convertNodeToMapPoint(node);
            mapPointsOfWay.push(mapPoint);
          }
        }
  
        mapPoints2Darray.push(mapPointsOfWay);
    }

    process.send({mapPoints2Darray: mapPoints2Darray});
    process.exit();
});

function convertNodeToMapPoint(node) {
    if (node.attributes == undefined || node.attributes.lon == undefined || node.attributes.lat == undefined)
      return null;
      
    // We have to convert latitude and longitude to x,y coordinates
    // Meaning we have to use triganometry, as lat and lon are
    // defined in terms of angle
  
    // Radius of earth in km
    var radius = 6371;
  
    // Convert longitude to x
    var x = (Math.cos(node.attributes.lon) * radius);
    
    // Convert latitude to y
    var y = (Math.sin(node.attributes.lat) * radius);
  
    var MapPoint = new shared.MapPoint(x, y);
  
    return MapPoint;
}