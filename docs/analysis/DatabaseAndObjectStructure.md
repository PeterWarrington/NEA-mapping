# Database/object structure
This document will detail a potential model for my database, and the requirements for this. This will additionally be used to update my existing data structures.

## Requirements
- Store map data
    - Points
    - Paths
    - PathParts
- Store user data
    - User name
    - User email
    - Hashed & salted user password
    - Saved map data
    - Saved routes
- Store cached routes

## Structure
In order to be normalised:
    *"Every non-key attribute is a fact about the key, the whole key, and nothing but the key"*
    - https://hrsfc.sharepoint.com/Sites/CompSci-Stu/Essentials/AQA%20Computer%20Science%20Unit%202.pdf

### Map data
#### Point
PointID
    string
lat
    decimal
lon
    decimal
metadata
    object
    Serving as a collection of optional metadata such as name and description.
options
    object
    Contains options for drawing to the screen, and potentially other things.

#### Path
PathID
    string
BeginningPathPartID
    string
metadata
    object
options
    object

#### PathPart
PathPartID
    string
PointID
    string
NextPathPartIDs
    string[] (nullable)
Metadata
    object

### User data
#### User
UserID
    string
UserName
    string
UserEmail
    string
UserPassword
    string
    Salted hash

#### UserMapData
UserID
    string
MapDataObject
    string
Params
    object