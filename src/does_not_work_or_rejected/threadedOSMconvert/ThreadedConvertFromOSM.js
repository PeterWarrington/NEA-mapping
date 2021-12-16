// DOES NOT WORK
// At least on my machine, due to memory issues. Created with the intent of making
// convertFromOSM faster by getting the system to use multiple cores.

const fs = require('fs')
const child_process = require('child_process');
var convert = require('xml-js');
var shared = require(process.cwd() + '/shared/sharedStructures.js').shared;

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

  var ways = [];
  var nodes = [];

  for (let i = 0; i < osmData.elements[0].elements.length; i++) {
    const element = osmData.elements[0].elements[i];
    if (element.name == "node" && !cachedNodedataAvailable) nodes.push(element);
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

  // Extract nodes for each road way
  var mapPoints2Darray = [];

  var cachedMapPoints2DAvailable = process.argv.includes("--cacheRead") && fs.existsSync(".osmToJS_mapPoints2D.json");
  if (cachedMapPoints2DAvailable) {
    console.log("Reading cached map points [2D]...");
    mapPoints2Darray = JSON.parse(fs.readFileSync(".osmToJS_mapPoints2D.json"));
    console.log("\tCached map points [2D] read complete.");
  } else {
    console.log("Extracting nodes for each road way...");

    childProcessPointers = [];
    var finishedProcessCount = 0;

    const processN = 4;
    for (let i = 0; i < processN; i++) {
      lowerBound = (roadWays.length / processN) * i;
      upperBound = lowerBound + (roadWays.length / processN);

      childProcess = child_process.fork(process.cwd() + "\\does_not_work_or_rejected\\threadedOSMconvert\\OSMConvertRoadWayProcess.js", {execArgv: ['--max-old-space-size=8192']});

      childProcess.send({lowerBound: lowerBound, upperBound: upperBound});

      var roadWaysToSend = {roadWays: roadWays.slice(lowerBound, upperBound)}
      childProcess.send(roadWaysToSend);
      delete roadWaysToSend;

      var nodestoSend = {nodes: nodes}
      childProcess.send(nodestoSend);
      delete nodestoSend;
      
      childProcess.on('message', (m) => {
        mapPoints2Darray = mapPoints2Darray.concat(m.mapPoints2Darray);
        finishedProcessCount++;
        console.log("\tProcess %d of %d has completed.", i, processN);

        if (finishedProcessCount == processN) {
          console.log("\tRoad node extraction complete.");

          // Cache mapPoints2DArray
          if (!process.argv.includes("--noCacheWrite") && !cachedMapPoints2DAvailable)
          fs.writeFile(".osmToJS_mapPoints2D.json", JSON.stringify(mapPoints2Darray), function(err) {
            if(err) {
                return console.log(err);
            }
            console.log("Background process: Map points [2D] have been cached");
          }); 
        }
      });

      // childProcessPointers.push(childProcess);
    } 
  }

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