# OSM Conversion algorithm

## Objective
To convert OSM data into the format required by the client.

## Formats
### Custom JS format (Desired)

* JSON
* Each road is a Path object.
* Each road is given a unique path ID
* A Path is defined in terms of its initial PathPart
* Each Point of a Path is connected in a chain of PathParts
* Each PathPart contains its point and the next PathParts in the chain

### OSM (To be converted)
* XML
* Each road is defined in terms of a list of nodes
* Road metadata is given using <tag> elements in the format

    `<tag k="key" v="value"/>`
* Each road is a <relation> and has <tag>s with "type"="route" and "route"="road"
* Each <relation> has an "id" attribute
* Each <relation> has ways (the actual paths that make up the road) as <member>s. Each component way is defined in the format:

    `<member type="way" ref="idOfTheWay" role=""/>`
* Each <way> contains component nodes expressed as <nd>s in the format:

    `<nd ref="idOfTheNode"/>`
* Each <node> has node in the format:

    `<node id="25496583" lat="51.5173639" lon="-0.140043" version="1" changeset="203496" user="80n" uid="1238" visible="true" timestamp="2007-01-28T11:40:26Z"></node>`


## Objectives

* Convert OSM data from XML to JSON
* Find only those relations that make up roads
* For each of these relations, find the component ways
* For each of these ways, find the component nodes
* For each of these nodes, convert the latitude and longitude to x,y coordinates
* Convert each node to a MapPoint
* Create path for each way using connecting MapParts of MapPoints
