# Project objectives
This document lists the objectvies I hope to be able to acheive as part of my NEA.
- [ ] Web client is able to send requests and receive appropiate data back to/from backend 
- [ ] The backend is able to read from OpenStreetMap (OSM xml) data and return this to clients via this API
- [ ] The web client is then able to display and represent this data on a map that can be panned and zoomed
- [ ] A search function is available on this web client to be able to find locations using the API
- [ ] A function will be available to find a efficient route from one location on the map to another using path theory. This will take into account distance and this route must be traversable in the real world.
    - [ ] **Extension:** Take into account traffic, whether that be based on a custom specified metric or the location of traffic lights along a route
- [ ] Function serviced by database on the backend to allow a user to sign-in/register and save places/routes

## Extension
- [ ] Cache the most frequently accessed places directly on the database
- [ ] Function to be able to plot new data on map that is then made available