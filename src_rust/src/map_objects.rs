#[derive(Debug)]
pub enum ExtendedMapObjectEnum {
    Point(Point), 
    Path(Path), 
    PathPart(PathPart), 
    None
}

#[derive(Debug)]
pub struct MapObject {
    pub base_object: BaseMapObject,
    pub extended_object: ExtendedMapObjectEnum
}

#[derive(Debug, Clone)]
pub struct BaseMapObject {
    pub id: String,
    pub object_type: String,
    pub metadata: String,
}

#[derive(Debug)]
pub struct Point {
    pub x: f32,
    pub y: f32
}

impl Point {
    pub fn from_db_table(x: f32, y: f32) -> Point{
        return Point {x, y};
    }
}

#[derive(Debug)]
pub struct Path {
    pub starting_path_part_id: String
}

#[derive(Debug)]
pub struct PathPart {
    pub point_id: String
}