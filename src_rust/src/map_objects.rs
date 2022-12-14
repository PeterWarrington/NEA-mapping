use uuid::Uuid;

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

impl BaseMapObject {
    pub fn new(object_type: String) -> BaseMapObject {
        return BaseMapObject {
            id: Uuid::new_v4().to_string(),
            object_type,
            metadata: "{}".to_string()
        };
    }
}

#[derive(Debug)]
pub struct Point {
    pub x: f32,
    pub y: f32
}

#[derive(Debug)]
pub struct Path {
    pub starting_path_part_id: String
}

#[derive(Debug)]
pub struct PathPart {
    pub point_id: String,
    pub next_path_part_ids: Vec<String>
}