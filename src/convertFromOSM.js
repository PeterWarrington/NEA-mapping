const fs = require('fs');
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
try {
  if (!process.argv.includes("--noCacheWrite") && !cachedOSMdataAvailable)
  fs.writeFile(".osmToJS_osmData.json", JSON.stringify(osmData), function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Background process: OS-JS data been cached");
  });
} catch (e) {
  // Error most likely occurs because osmData is too large for JSON.stringify
  console.log(`Unable to cache OS-JS data. ${e.name}: ${e.message}. Continuing anyway...`);
}

console.log("Extracting ways, and nodes...");

var cachedNodedataAvailable = process.argv.includes("--cacheRead") && fs.existsSync(".osmToJS_nodes.json");

var allWays = [];
var nodes = {};

for (let i = 0; i < osmData.elements[0].elements.length; i++) {
  const element = osmData.elements[0].elements[i];
  if (element.name == "node" && !cachedNodedataAvailable) nodes[element.attributes.id] = element;
  if (element.name == "way") allWays.push(element);
}

if (cachedNodedataAvailable) {
  console.log("\tReading cached node data:");
  nodes = JSON.parse(fs.readFileSync(".osmToJS_nodes.json"));
  console.log("\t\tCached node data read completed.");
}

console.log("\tWay and node extraction complete.");

// Cache nodes
try {
  if (!process.argv.includes("--noCacheWrite") && !cachedNodedataAvailable)
  fs.writeFile(".osmToJS_nodes.json", JSON.stringify(nodes), function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Background process: Nodes have been cached");
  });
} catch (e) {
  // Error most likely occurs because osmData is too large for JSON.stringify
  console.log(`Unable to cache nodes. ${e.name}: ${e.message}. Continuing anyway...`);
}

// Extract ways with <tag k="highway" ...>

var filteredWays = [];

var cachedwaysAvailable = process.argv.includes("--cacheRead") && fs.existsSync(".osmToJS_ways.json");
if (cachedwaysAvailable) {
  console.log("Reading cached ways...");
  allWays = JSON.parse(fs.readFileSync(".osmToJS_ways.json"));
  console.log("\tCached way read complete.")
} else {
  console.log("Extracting ways...");
  for (let w = 0; w < allWays.length; w++) {
    const way = allWays[w];
    const wayType = getWayType(way);
    if (wayType != "no_way" && wayType != "other") 
          filteredWays.push(way);
  }

  console.log("\tWay extraction complete.");
}

// Cache ways
try {
  if (!process.argv.includes("--noCacheWrite") && !cachedwaysAvailable)
  fs.writeFile(".osmToJS_ways.json", JSON.stringify(filteredWays), function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Background process: Ways have been cached");
  }); 
} catch (e) {
  // Error most likely occurs because osmData is too large for JSON.stringify
  console.log(`Unable to cache ways. ${e.name}: ${e.message}. Continuing anyway...`);
}

// Extract nodes for each way and creating paths
console.log("Final stage - Generating DB...");

var wLength = filteredWays.length;
// var wLength = 100;
for (let w = 0; w < wLength; w++) {
  const way = filteredWays[w];
  const wayType = getWayType(way);

  if (wayType == "other") continue;
  
  // Extract node references to add
  var nodeRefsOfWay = [];
  for (let e = 0; e < way.elements.length; e++) {
    const element = way.elements[e];
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

  if (wayType == "highway" || wayType == "water_way") {
    // Generate path
    let path = shared.Path.connectSequentialPoints(mapPointsOfWay, mapDatabase);

    // Extract all metadata of path
    Object.assign(path.metadata, {"osm": extractMetadata(way)});

    // Add path type
    if (wayType == "highway")
      path.metadata.pathType = {"first_level_descriptor": "highway", "second_level_descriptor": path.metadata.osm.highway};
    else if (wayType == "water_way")
      path.metadata.pathType = {"first_level_descriptor": "water_way", "second_level_descriptor": path.metadata.osm.waterway};

    mapDatabase.addMapObject(path);
  } else if (wayType == "water_area" || wayType == "land") {
    // Add mapPoints to DB and extract IDs
    let mapPointIDs = [];
    mapPointsOfWay.forEach(mapPoint => {
      mapPoint = mapDatabase.addMapObject(mapPoint);
      mapPointIDs.push(mapPoint.ID);
    });

    // Construct area and add to db
    let area = new shared.Area(mapPointIDs);

    // Add metadata to area mapObject
    Object.assign(area.metadata, {"osm": extractMetadata(way)});
    area.metadata.areaType = {"first_level_descriptor": wayType};
    if (wayType == "water_area" && area.metadata.osm.waterway != undefined)
      area.metadata.areaType["second_level_descriptor"] = area.metadata.osm.waterway;
    else if (wayType == "land" && area.metadata.osm.landuse != undefined)
      area.metadata.areaType["second_level_descriptor"] = area.metadata.osm.landuse;

    mapDatabase.addMapObject(area);
  }

  process.stdout.cursorTo(0);
  process.stdout.write(`${Math.round((w/wLength)*10000)/100}% (${w}/${wLength}) of ways added to db.`);
} 

console.log("\nDatabase generated. Writing to file...");

// Write database to file
var dbFilename = `db-${Date.now()}.json`;
try {
  let dbKeys = Object.keys(mapDatabase.db);
  let writeStream = fs.createWriteStream(dbFilename);

  writeStream.write(`{"db":{`);
  for (let i = 0; i < dbKeys.length; i++) {
    const dbKey = dbKeys[i];
    writeStream.write(`"${dbKey}":${JSON.stringify(mapDatabase.db[dbKey])}`);
    if (i+1 < dbKeys.length) writeStream.write(`,`);

    process.stdout.cursorTo(0);
    process.stdout.write(`${Math.round((i/dbKeys.length)*10000)/100}% (${i}/${dbKeys.length}) database items written to file.`);
  }
  writeStream.write("}}");
  writeStream.end();
  console.log(`\nMap database has been saved to ${dbFilename}!`);
} catch (err) {
  console.log(err);
}

function convertNodeToMapPoint(node) {
  if (node.attributes == undefined || node.attributes.lon == undefined || node.attributes.lat == undefined)
    return null;
    
  // We have to convert latitude and longitude to x,y coordinates
  // Meaning we have to use triganometry, as lat and lon are
  // defined in terms of angle
  // This uses the mercator projection as defined at https://gis.stackexchange.com/a/314225 CC BY-SA 4.0

  // Radius of earth
  var radius = 6371;

  // Convert longitude to x
  var x = radius * (node.attributes.lon);
  
  // Convert latitude to y
  var y = radius * Math.log(Math.abs(Math.tan((Math.PI/4) + (node.attributes.lat / 2))));

  var MapPoint = new shared.MapPoint(x, y);

  return MapPoint;
}

/**
 * @returns {string} the type of way
 */
function getWayType(way) {
  if (way.name != "way") return "no_way";

  for (let i = 0; i < way.elements.length; i++) {
    const element = way.elements[i];
    if (element.name == "tag" && element.attributes.k == "highway") return "highway";
    if (element.name == "tag" && element.attributes.k == "waterway") return "water_way";
    if (element.name == "tag" && element.attributes.k == "natural" && element.attributes.v == "water") return "water_area"; 
    if (element.name == "tag" && element.attributes.k == "landuse") return "land";
  }
  return "other";
}

/**
 * Extracts the metadata for a simple db way.
 * @param {object} way way from simple db
 * @returns object containing tag key:value pairs
 */
function extractMetadata(way) {
  let metadata = {};

  for (let e = 0; e < way.elements.length; e++) {
    const element = way.elements[e];
    if (element.name == "tag") 
      metadata[element.attributes.k] = element.attributes.v;
  }

  return metadata;
}