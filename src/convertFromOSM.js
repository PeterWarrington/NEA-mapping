const fs = require('fs')
var convert = require('xml-js');
var shared = require('./shared/sharedStructures.js').shared;

var mapDatabase = new shared.MapDataObjectDB();

var osmData;
var cachedOSMdataAvailable = process.argv.includes("--cacheRead") && fs.existsSync(".osmToJS_osmData.json");
if (cachedOSMdataAvailable) {
  console.log("Reading OSM-JS cache...")
  osmData = JSON.parse(fs.readFileSync(".osmToJS_osmData.json"));
  console.log("\tOSM-JS cache read complete");
} else {
  console.log("Beginning conversion from OSM to OSM-JS - This might take a while...");
  let data = fs.readFileSync('../docs/cambridgeshire-latest.osm', 'utf8');
  osmData = convert.xml2js(data, {compact: false});
  console.log("\tOSM to OSM-JS conversion complete.");
}

// Cache osmData
if (!process.argv.includes("--noCacheWrite") && !cachedOSMdataAvailable)
fs.writeFile(".osmToJS_osmData.json", JSON.stringify(osmData), function(err) {
  if(err) {
      return console.log(err);
  }
  console.log("Background process: OS-JS data been cached");
}); 

console.log("Extracting ways, nodes, and those relations with route=road...");

var cachedNodedataAvailable = process.argv.includes("--cacheRead") && fs.existsSync(".osmToJS_nodes.json");

var ways = [];
var nodes = {};

for (let i = 0; i < osmData.elements[0].elements.length; i++) {
  const element = osmData.elements[0].elements[i];
  if (element.name == "node" && !cachedNodedataAvailable) nodes[element.attributes.id] = element;
  if (element.name == "way") ways.push(element);
}

if (cachedNodedataAvailable) {
  console.log("\tReading cached node data:");
  nodes = JSON.parse(fs.readFileSync(".osmToJS_nodes.json"));
  console.log("\t\tCached node data read completed.");
}

console.log("\tWays, nodes and relation extraction complete.");

// Cache nodes
if (!process.argv.includes("--noCacheWrite") && !cachedNodedataAvailable)
fs.writeFile(".osmToJS_nodes.json", JSON.stringify(nodes), function(err) {
  if(err) {
      return console.log(err);
  }
  console.log("Background process: Nodes have been cached");
});

// Extract ways with <tag k="highway" ...>

var roadWays = [];

var cachedRoadWaysAvailable = process.argv.includes("--cacheRead") && fs.existsSync(".osmToJS_roadWays.json");
if (cachedRoadWaysAvailable) {
  console.log("Reading cached roadways...");
  roadWays = JSON.parse(fs.readFileSync(".osmToJS_roadWays.json"));
  console.log("\tCached roadway read complete.")
} else {
  console.log("Extracting ways with <tag k=\"highway\" ... > ...");
  for (let w = 0; w < ways.length; w++) {
    const way = ways[w];
    for (let e = 0; e < way.elements.length; e++) {
      const element = way.elements[e];
      if (element.name == "tag" && element.attributes.k == "highway") roadWays.push(way);
    }
  }

  console.log("\tRoad way extraction complete.");
}

// Cache roadways
if (!process.argv.includes("--noCacheWrite") && !cachedRoadWaysAvailable)
fs.writeFile(".osmToJS_roadWays.json", JSON.stringify(roadWays), function(err) {
  if(err) {
      return console.log(err);
  }
  console.log("Background process: Roadways have been cached");
}); 

// Extract nodes for each road way and creating paths
var mapPoints2Darray = [];

console.log("Final stage - Generating DB...");

var wLength = roadWays.length;
// var wLength = 100;
for (let w = 0; w < wLength; w++) {
  const roadWay = roadWays[w];
  
  // Extract node references to add
  var nodeRefsOfWay = [];
  for (let e = 0; e < roadWay.elements.length; e++) {
    const element = roadWay.elements[e];
    if (element.name == "nd") nodeRefsOfWay.push(element.attributes.ref);
  }

  // Extract nodes from node references to add
  var mapPointsOfWay = [];

  for (let r = 0; r < nodeRefsOfWay.length; r++) {
    const ref = nodeRefsOfWay[r];
    let node = nodes[ref];
    let mapPoint = convertNodeToMapPoint(node);

    // Extract all metadata of node
    if (node.elements != undefined)
      for (let e = 0; e < node.elements.length; e++) {
        const element = node.elements[e];
        if (element.name == "tag") 
          mapPoint.metadata[element.attributes.k] = element.attributes.v;
      }

    // Add map point to array
    mapPointsOfWay.push(mapPoint);
  }

  // Generate path
  let path = shared.Path.connectSequentialPoints(mapPointsOfWay, mapDatabase);

  // Extract all metadata of path
  for (let e = 0; e < roadWay.elements.length; e++) {
    const element = roadWay.elements[e];
    if (element.name == "tag") 
      path.metadata[element.attributes.k] = element.attributes.v;
  }

  switch (path.metadata.highway) {
    case "motorway":
      path.data.pathFillStyle = "#3474eb";
      break;
    case "motorway_link":
      path.data.pathFillStyle = "#0000ff";
      break;
    case "trunk":
      path.data.pathFillStyle = "#292929";
      break;
    case "trunk_link":
      path.data.pathFillStyle = "#000000";
      break;
    case "primary":
      path.data.pathFillStyle = "#2bb354";
      break;
    case "primary_link":
      path.data.pathFillStyle = "#00ff00";
      break;
    default:
      break;
  }

  mapDatabase.addMapObject(path);

  process.stdout.cursorTo(0);
  process.stdout.write(`${Math.round((w/wLength)*10000)/100}% (${w}/${wLength}) of ways added to db.`);
} 

console.log("\nDatabase generated. Writing to file...");

// Write database to file
var dbFilename = `db-${Date.now()}.json`;
fs.writeFile(dbFilename, JSON.stringify(mapDatabase), function(err) {
  if(err) {
      return console.log(err);
  }
  console.log(`Map database has been saved to ${dbFilename}!`);
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