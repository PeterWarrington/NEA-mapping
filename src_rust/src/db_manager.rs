use std::str::from_utf8;
use mysql::*;
use mysql::prelude::*;

pub fn main() {
    let database_url = "mysql://root:PASSWORD@localhost:3306/untitled_mapping";
    let pool = Pool::new(database_url).expect("Error creating db pool.");

    let mut db_connection = pool.get_conn().expect("Error creating db connection.");

    let map_objects = db_connection.query_map("SELECT * FROM MAP_OBJECT", 
        |(id, object_type, metadata)| {

            return MapObject::from_db_table(id, object_type, metadata, DummyExtendedObject {});
        }
    ).expect("Error running query.");

    for map_object in map_objects {
        println!("{:?}", map_object);
    }
}

fn db_str_to_str(db_str: Vec<u8>) -> String {
    return from_utf8(db_str.as_slice()).expect("Failed to convert db string to string").to_string()
}

#[derive(Debug)]
pub struct MapObject<T> {
    pub id: String,
    pub object_type: String,
    pub metadata: String,
    pub object_extended: T,
}

#[derive(Debug)]
pub struct DummyExtendedObject {}

impl<T> MapObject<T> {
    pub fn from_db_table(id: Vec<u8>, object_type: Vec<u8>, metadata: Vec<u8>, object_extended: T) -> MapObject<T>{
        let object_type_str = db_str_to_str(object_type);

        return MapObject {
            id: db_str_to_str(id), 
            object_type: object_type_str, 
            metadata: db_str_to_str(metadata),
            object_extended: object_extended
        };
    }
}

pub struct Point {
    pub x: f32,
    pub y: f32
}

impl Point {
    pub fn from_db_table(id: Vec<u8>, x: f32, y: f32) -> Point{
        let id_str = db_str_to_str(id);
        return Point {x, y};
    }
}

pub struct Path {
    pub id: String,
    pub starting_path_part_id: String
}

pub struct PathPart {
    pub id: String,

}