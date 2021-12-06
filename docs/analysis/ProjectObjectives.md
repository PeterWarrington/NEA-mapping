# Project objectives

This document lists the objectvies I hope to be able to acheive as part of my NEA.

1. Web client is able to send requests and receive appropiate data back to/from backend 
2. The backend is able to read from OpenStreetMap (OSM xml) data and return this to clients via this API
3. The web client is then able to display and represent data returned from the server on a map that can be panned and zoomed
4. A search function is available on this web client to be able to find locations using the API
5. A function will be available to find a efficient route from one location on the map to another using path theory. This will take into account distance and this route must be traversable in the real world.

    5. a. **Extension:** Take into account traffic, whether that be based on a custom specified metric or the location of traffic lights along a route
6. Function serviced by database on the backend to allow a user to sign-in/register and save places/routes
7. Testers reports that they are able to easily:

    7. a. Find their home using the search function
    - Generate a route
    - Register and log-in
    - Save this location and route to their account
8. Data structures and important algorithms are well-documented using comments
9. API is well documented
10. Effective use of object-oriented programming to be able to create effective data structures shared across the project, including the appropiate use of inheritance.
11. Normalised database structure to store the data mentioned above.

## Extension
12. Cache the most frequently accessed places directly on the database
13. Function to be able to plot new data on map that is then made available
14. Ability to add notes to the map
15. Ability to add other annotations to the map
