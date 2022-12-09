mod map_objects;

use std::str::from_utf8;
use map_objects::*;
use mysql::*;
use mysql::prelude::*;

pub fn main() {
    let database_url = "mysql://root:PASSWORD@localhost:3306/untitled_mapping";
    let pool: Pool = Pool::new(database_url).expect("Error creating db pool.");

    let mut db_connection : PooledConn = pool.get_conn().expect("");

    let map_objects= get_map_objects(&mut db_connection);

    for map_object in map_objects {
        println!("{:?}", map_object);
    }
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

pub fn add_map_object_to_db(db_connection: &mut PooledConn, map_object: &MapObject) -> Result<()> {
    match &map_object.extended_object {
        ExtendedMapObjectEnum::Point(point) => {
            match add_base_map_object_to_db(db_connection, &map_object, "POINT".to_string()) {
                Ok(_) => {
                    return db_connection.query_drop(
                        format!(
                            "INSERT INTO `untitled_mapping`.`POINT` (`ID`, `POSITION_X`, `POSITION_Y`) VALUES ('{}', {}, {});",
                        map_object.base_object.id, point.x, point.y)
                    );
                },
                Err(x) => return Err(x),
            };
            
        }
        ExtendedMapObjectEnum::Path(path) => {
            match add_base_map_object_to_db(db_connection, &map_object, "PATH".to_string()) {
                Ok(_) => {
                    return db_connection.query_drop(
                        format!(
                            "INSERT INTO `untitled_mapping`.`PATH` (`ID`, `STARTING_PATH_PART_ID`) VALUES ('{}', '{}');",
                        map_object.base_object.id, path.starting_path_part_id)
                    );
                },
                Err(x) => return Err(x),
            };
        },
        ExtendedMapObjectEnum::PathPart(part) => {
            match add_base_map_object_to_db(db_connection, &map_object, "PATH_PART".to_string()) {
                Ok(_) => {
                    return db_connection.query_drop(
                        format!(
                            "INSERT INTO `untitled_mapping`.`PATH_PART` (`ID`, `POINT_ID`) VALUES ('{}', '{}');",
                        map_object.base_object.id, part.point_id)
                    );
                },
                Err(x) => return Err(x),
            };
        },
        ExtendedMapObjectEnum::None => todo!(),
    }
}

fn add_base_map_object_to_db(db_connection: &mut PooledConn, map_object: &MapObject, object_type: String) -> Result<()>  {
    return db_connection.query_drop(
        format!(
            "INSERT INTO `untitled_mapping`.`MAP_OBJECT` (`ID`, `TYPE`, `METADATA`) VALUES ('{}', '{}', '{{}}');",
        map_object.base_object.id, object_type)
    );
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
        let query_result: Option<(Vec<u8>, Vec<u8>)> = match db_connection.query_first(
            format!("SELECT * FROM PATH_PART WHERE ID = '{}'", base_object.id)
        ) {
            Ok (x) => x,
            Err (_) => None
        };

        match query_result {
            Some(x) => {
                let point_id = db_str_to_str(x.1);
                return Ok(ExtendedMapObjectEnum::PathPart(PathPart {point_id}));
            },
            None => Ok(ExtendedMapObjectEnum::None)
        }
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