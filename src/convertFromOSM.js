const fs = require('fs')
var convert = require('xml-js');
var shared = require('./shared/sharedStructures.js').shared;

console.log("Beginning OSM file read...");
fs.readFile('../docs/cambridgeshire-latest.osm', 'utf8' , (err, data) => {
  if (err) {
    console.error(err)
    return
  }
  console.log("\tFile read complete.");

  var osmData;
  var cachedOSMdataAvailable = process.argv.includes("--cacheRead") && fs.existsSync(".osmToJS_osmData.json");
  if (cachedOSMdataAvailable) {
    console.log("Reading OSM-JS cache...")
    osmData = JSON.parse(fs.readFileSync(".osmToJS_osmData.json"));
    console.log("\tOSM-JS cache read complete");
  } else {
    console.log("Beginning conversion from OSM to OSM-JS - This might take a while...");
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

  var roadRelations = [];
  var ways = [];
  var nodes = [];
  osmData.elements[0].elements.forEach(element => {
    if (element.name == "relation") {
      // Only add those relations that are roads
      element.elements.forEach(relationElement => {
        if (relationElement.name == "tag" && 
            relationElement.attributes.k == "route" &&
            relationElement.attributes.v == "road") {
              roadRelations.push(element);
            }
      });
    }

    if (element.name == "node" && !cachedNodedataAvailable) nodes.push(element);
    if (element.name == "way") ways.push(element);
  });

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

  // Extract way IDs of roads
  console.log("Extracting way IDs of roads...");

  var roadWayIds = [];
  roadRelations.forEach(roadRelation => {
    if (roadRelation.elements != undefined)
      roadRelation.elements.forEach(element => {
        if (element.name == "member" && element.attributes.type == "way") {
          roadWayIds.push(element.attributes.ref);
        }
      });
  });

  console.log("\tWay ID extraction complete.");

  // Extract roadWays referred to by each roadWayId
  
  var roadWays = [];

  var cachedRoadWaysAvailable = process.argv.includes("--cacheRead") && fs.existsSync(".osmToJS_roadWays.json");
  if (cachedRoadWaysAvailable) {
    console.log("Reading cached roadways...");
    roadWays = JSON.parse(fs.readFileSync(".osmToJS_roadWays.json"));
    console.log("\tCached roadway read complete.")
  } else {
    console.log("Extracting ways matching extracted way IDs...");
    ways.forEach(way => {
      if (roadWayIds.includes(way.attributes.id)) roadWays.push(way);
    });
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

  // Extract nodes for each road way
  var mapPoints2Darray = [];

  var cachedMapPoints2DAvailable = process.argv.includes("--cacheRead") && fs.existsSync(".osmToJS_mapPoints2D.json");
  if (cachedMapPoints2DAvailable) {
    console.log("Reading cached map points [2D]...");
    mapPoints2Darray = JSON.parse(fs.readFileSync(".osmToJS_mapPoints2D.json"));
    console.log("\tCached map points [2D] read complete.");
  } else {
    console.log("Extracting nodes for each road way...");

    roadWays.forEach(roadWay => {
      // Extract node references to add
      var nodeRefsOfWay = [];
      roadWay.elements.forEach(element => {
        if (element.name == "nd") nodeRefsOfWay.push(element.attributes.ref);
      });

      // Extract nodes from node references to add
      var mapPointsOfWay = [];
      nodes.forEach(node => {
        if (nodeRefsOfWay.includes(node.attributes.id)) {
          var mapPoint = convertNodeToMapPoint(node);
          mapPointsOfWay.push(mapPoint);
        } else
          return;
      });

      mapPoints2Darray.push(mapPointsOfWay);
    });

    console.log("\tRoad node extraction complete.");
  }

  // Cache mapPoints2DArray
  if (!process.argv.includes("--noCacheWrite") && !cachedMapPoints2DAvailable)
  fs.writeFile(".osmToJS_mapPoints2D.json", JSON.stringify(mapPoints2Darray), function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Background process: Map points [2D] have been cached");
  }); 

  // TODO: Convert to Paths and PathParts

  // Write data to file
  // const outputFile = "./mapPoints.json";
  // console.log("Writing converted map data to " + outputFile);

  // fs.writeFile(outputFile, JSON.stringify(mapPoints2Darray), function(err) {
  //   if(err) {
  //       return console.log(err);
  //   }
  //   console.log("\tConverted map data saved.")
  //   console.log("Conversion complete.");
  // });
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