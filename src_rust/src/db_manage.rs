#[path = "map_objects.rs"]
pub mod map_objects;

use std::ops::Add;
use std::str::from_utf8;
use map_objects::*;
use mysql::*;
use mysql::prelude::*;

pub fn create_connection() -> PooledConn {
    let database_url = "mysql://root:PASSWORD@localhost:3306/untitled_mapping";
    let pool: Pool = Pool::new(database_url).expect("Error creating db pool.");

    let db_connection : PooledConn = pool.get_conn().expect("");

    return db_connection;
}

pub fn db_str_to_str(db_str: Vec<u8>) -> String {
    return from_utf8(db_str.as_slice()).expect("Failed to convert db string to string").to_string()
}

pub fn get_map_objects(db_connection: &mut PooledConn) -> Vec<MapObject> {
    let db_map_objects = 
        match db_connection.query("SELECT * FROM MAP_OBJECT") {
            Ok(x) => x,
            Err(_) => Vec::new(),
        };
    let mut map_objects = Vec::new();

    for (id, object_type, metadata) in db_map_objects {
        let object_type_str = db_str_to_str(object_type);
        let base_object = point_from_db_table(id, object_type_str, metadata);
        let extended_object = match get_extended_map_object(db_connection, &base_object) {
            Ok(x) => x,
            Err(_) => ExtendedMapObjectEnum::None
        };

        if !matches!(extended_object, ExtendedMapObjectEnum::None) {
            map_objects.push(MapObject {base_object, extended_object});
        }
    }

    return map_objects
}

pub fn add_map_objects_to_db(db_connection: &mut PooledConn, map_objects: &Vec<&MapObject>) -> Result<()> {
    let mut full_query: String = String::new();

    for map_object in map_objects {
        full_query.push_str(get_query_add_base_map_object_to_db(db_connection, &map_object).as_str());

        match &map_object.extended_object {
            ExtendedMapObjectEnum::Point(point) => {
                full_query.push_str(
                    format!(
                        "INSERT INTO `untitled_mapping`.`POINT` (`ID`, `POSITION_X`, `POSITION_Y`) VALUES ('{}', {}, {});",
                    map_object.base_object.id, point.x, point.y).as_str()
                )
            }
            ExtendedMapObjectEnum::Path(path) => {
                full_query.push_str(
                    format!(
                        "INSERT INTO `untitled_mapping`.`PATH` (`ID`, `STARTING_PATH_PART_ID`) VALUES ('{}', '{}');",
                    map_object.base_object.id, path.starting_path_part_id).as_str()
                );
            },
            ExtendedMapObjectEnum::PathPart(part) => {
                full_query.push_str(
                    format!(
                        "INSERT INTO `untitled_mapping`.`PATH_PART` (`ID`, `POINT_ID`) VALUES ('{}', '{}');",
                    map_object.base_object.id, part.point_id).as_str()
                );
                full_query.push_str(
                    format!(
                        "INSERT INTO `untitled_mapping`.`PATH_PART_NEXT_PART_LINK` (`A_ID`, `B_ID`) VALUES ('{}', '{}');",
                    map_object.base_object.id, part.next_path_part_ids.first().unwrap()).as_str()
                );
            },
            ExtendedMapObjectEnum::None => todo!(),
        }
    }
    return db_connection.query_drop(full_query);
}

pub fn add_map_object_to_db(db_connection: &mut PooledConn, map_object: &MapObject) -> Result<()> {
    return add_map_objects_to_db(db_connection, &vec![map_object]);
}

fn get_query_add_base_map_object_to_db(db_connection: &mut PooledConn, map_object: &MapObject) -> String  {
    return format!(
            "INSERT INTO `untitled_mapping`.`MAP_OBJECT` (`ID`, `TYPE`, `METADATA`) VALUES ('{}', '{}', '{{}}');",
        map_object.base_object.id, map_object.base_object.object_type)
}

pub fn get_extended_map_object(db_connection: &mut PooledConn, base_object: &BaseMapObject) -> Result<ExtendedMapObjectEnum> {
    if base_object.object_type.eq("POINT") {
        let query_result: Option<(Vec<u8>, f32, f32)> = match db_connection.query_first(
            format!("SELECT * FROM POINT WHERE ID = '{}'", base_object.id)
        ) {
            Ok (x) => x,
            Err (_) => None
        };

        match query_result {
            Some(x) => {
                return Ok(ExtendedMapObjectEnum::Point(Point {x: x.1, y: x.2}));
            },
            None => Ok(ExtendedMapObjectEnum::None)
        }
    } else if base_object.object_type.eq("PATH") {
        let query_result: Option<(Vec<u8>, Vec<u8>)> = match db_connection.query_first(
            format!("SELECT * FROM PATH WHERE ID = '{}'", base_object.id)
        ) {
            Ok (x) => x,
            Err (_) => None
        };

        match query_result {
            Some(x) => {
                let starting_path_part_id = db_str_to_str(x.1);
                return Ok(ExtendedMapObjectEnum::Path(Path {starting_path_part_id}));
            },
            None => Ok(ExtendedMapObjectEnum::None)
        }
    } else if base_object.object_type.eq("PATH_PART") {
        let query_result_point_id: Option<(Vec<u8>, Vec<u8>)> = match db_connection.query_first(
            format!("SELECT * FROM PATH_PART WHERE ID = '{}'", base_object.id)
        ) {
            Ok (x) => x,
            Err (_) => None
        };

        let point_id = db_str_to_str(query_result_point_id.unwrap().1);

        let query_result_b_part_id: Option<(Vec<u8>, Vec<u8>)> = match db_connection.query_first(
            format!("SELECT * FROM PATH_PART WHERE A_ID = '{}'", base_object.id)
        ) {
            Ok (x) => x,
            Err (_) => None
        };

        let next_path_part = db_str_to_str(query_result_b_part_id.unwrap().1);

        let path_part = PathPart {
            point_id, 
            next_path_part_ids: vec![next_path_part]
        };

        return Ok(ExtendedMapObjectEnum::PathPart(path_part));
    } else {
        return Ok(ExtendedMapObjectEnum::None)
    }

}

fn point_from_db_table(id: Vec<u8>, object_type: String, metadata: Vec<u8>) -> BaseMapObject{
    return BaseMapObject {
        id: db_str_to_str(id), 
        object_type: object_type, 
        metadata: db_str_to_str(metadata)
    };
}