use std::str::from_utf8;
use mysql::*;
use mysql::prelude::*;

pub fn main() {
    let database_url = "mysql://root:PASSWORD@localhost:3306/untitled_mapping";
    let pool: Pool = Pool::new(database_url).expect("Error creating db pool.");

    let db_connection : PooledConn = pool.get_conn().expect("");

    let map_objects= get_map_objects(db_connection);

    for map_object in map_objects {
        println!("{:?}", map_object);
    }
}

pub fn db_str_to_str(db_str: Vec<u8>) -> String {
    return from_utf8(db_str.as_slice()).expect("Failed to convert db string to string").to_string()
}

pub fn get_map_objects(mut db_connection: PooledConn) -> Vec<MapObject> {
    let db_map_objects = db_connection.query("SELECT * FROM MAP_OBJECT").expect("Error running query.");
    let mut map_objects = Vec::new();

    for (id, object_type, metadata) in db_map_objects {
        let object_type_str = db_str_to_str(object_type);
        let base_object = BaseMapObject::from_db_table(id, object_type_str, metadata);
        let extended_object = get_extended_map_object(&mut db_connection, &base_object);

        map_objects.push(MapObject {base_object, extended_object});
    }

    return map_objects
}

#[derive(Debug)]
pub enum ExtendedMapObjectEnum {
    Point(Point), 
    Path(Path), 
    PathPart(PathPart), 
    None
}

pub fn get_extended_map_object(db_connection: &mut PooledConn, base_object: &BaseMapObject) -> ExtendedMapObjectEnum {
    if base_object.object_type.eq("POINT") {
        let query_result: Option<(Vec<u8>, f32, f32)> = db_connection.query_first(
            format!("SELECT * FROM POINT WHERE ID = '{}'", base_object.id)
        ).expect("Failed to find point with id");

        match query_result {
            Some(x) => {
                return ExtendedMapObjectEnum::Point(Point {x: x.1, y: x.2});
            },
            None => ExtendedMapObjectEnum::None
        }
    } else if base_object.object_type.eq("PATH") {
        let query_result: Option<(Vec<u8>, Vec<u8>)> = db_connection.query_first(
            format!("SELECT * FROM PATH WHERE ID = '{}'", base_object.id)
        ).expect("Failed to find path with id");

        match query_result {
            Some(x) => {
                let starting_path_part_id = db_str_to_str(x.1);
                return ExtendedMapObjectEnum::Path(Path {starting_path_part_id});
            },
            None => ExtendedMapObjectEnum::None
        }
    } else if base_object.object_type.eq("PATH_PART") {
        let query_result: Option<(Vec<u8>, Vec<u8>)> = db_connection.query_first(
            format!("SELECT * FROM PATH_PART WHERE ID = '{}'", base_object.id)
        ).expect("Failed to find path part with id");

        match query_result {
            Some(x) => {
                let point_id = db_str_to_str(x.1);
                return ExtendedMapObjectEnum::PathPart(PathPart {point_id});
            },
            None => ExtendedMapObjectEnum::None
        }
    } else {
        return ExtendedMapObjectEnum::None
    }

}

#[derive(Debug)]
pub struct MapObject {
    base_object: BaseMapObject,
    extended_object: ExtendedMapObjectEnum
}

#[derive(Debug, Clone)]
pub struct BaseMapObject {
    pub id: String,
    pub object_type: String,
    pub metadata: String,
}

impl BaseMapObject {
    pub fn from_db_table(id: Vec<u8>, object_type: String, metadata: Vec<u8>) -> BaseMapObject{
        return BaseMapObject {
            id: db_str_to_str(id), 
            object_type: object_type, 
            metadata: db_str_to_str(metadata)
        };
    }
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