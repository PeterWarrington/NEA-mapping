use std::{fs::{File}, collections::HashMap, io::BufReader};

use db_manage::map_objects::*;
use xmltree::Element;

#[path = "map_objects.rs"]
mod map_objects;
#[path = "db_manage.rs"]
mod db_manage;

fn main() {
    println!("Reading from file...");
    let osm_data = Element::parse(BufReader::new(File::open("../docs/cambridgeshire-latest.osm").unwrap())).unwrap();
    println!("Finished reading from file and serialising XML data.");
    
    let mut nodes: HashMap<String, Element> = HashMap::new();
    let mut ways = Vec::new();
    let mut filtered_ways = Vec::new();
    let mut relations = Vec::new();

    let db_connection = &mut db_manage::create_connection();

    println!("Iterating through elements and sorting them into corresponding structures...");
    for element in osm_data.children {
        let element = element.as_element();
        if element.is_some() {
            let element = element.unwrap();
            if element.name == "node" {
                nodes.insert(
                    element.attributes.get("id").unwrap().clone(), 
                    element.clone()
                );
            } else if element.name == "way" {
                ways.push(element.clone());
            } else if element.name == "relation" {
                relations.push(element.clone());
            }
        }
    }
    println!("Iterating through elements complete.");

    println!("Determining way type of each way...");
    for way in ways {
        let way_type = get_way_type(&way);
        if !way_type.eq("no_way") {
            filtered_ways.push(way);
        }
    }
    println!("Way type determination complete.");


    let mut way_count = 0;
    let way_len = filtered_ways.len();

    println!("Iterating through ways and creating map objects in db...");
    for way in filtered_ways {
        way_count = way_count + 1;
        print!("\rProcessing {}/{}",way_count, way_len);
        
        let way_type = get_way_type(&way);

        if way_type.eq("other") {
            continue;
        }

        let mut node_refs_of_way = Vec::new();
        for child in &way.children {
            let element = child.as_element();
            if element.is_some() {
                let element = element.unwrap();
                if element.name.eq("nd") {
                    node_refs_of_way.push(element.attributes.get("ref").unwrap());
                }
            }
        }

        let mut map_points_of_way: Vec<MapObject> = Vec::new();
        for node_ref in node_refs_of_way {
            let node = nodes.get(node_ref).unwrap();
            let mut node_metadata: HashMap<&str, String> = HashMap::new();

            for child in &node.children {
                let element = child.as_element();
                if element.is_some() {
                    let element = element.unwrap();
                    if element.name.eq("tag") {
                        node_metadata.insert(element.attributes.get("k").unwrap(), element.attributes.get("v").unwrap().to_string());
                    }
                }
            }

            // Radius of earth
            let radius = 6371.0;

            // Convert longitude to x
            let x = radius * node.attributes.get("lon").unwrap().parse::<f32>().unwrap();
            
            // Convert latitude to y
            let y = radius * ((std::f32::consts::PI / 4.0) + (node.attributes.get("lat").unwrap().parse::<f32>().unwrap() / 2.0)).tan().abs().log10();

            let map_point = Point {x, y};
            let base_map_object = BaseMapObject::new("POINT".to_string());

            let map_object_point: MapObject = MapObject {
                base_object: base_map_object, 
                extended_object: ExtendedMapObjectEnum::Point(map_point)
            };


            // Add map object to db
            db_manage::add_map_object_to_db(db_connection, &map_object_point).expect("Error adding point to DB.");
            map_points_of_way.push(map_object_point);
        }

        let mut starting_path_part_id= Option::None;

        for i in 0..(map_points_of_way.len() - 1) {
            let path_part = PathPart {
                point_id: map_points_of_way[i].base_object.id.clone(),
                next_path_part_ids: vec![map_points_of_way[i+1].base_object.id.clone()]
            };
            let path_part_base = BaseMapObject::new("PART".to_string());
            let path_part_map_object = MapObject {
                base_object: path_part_base,
                extended_object: ExtendedMapObjectEnum::PathPart(path_part)
            };

            if (i == 0) {
                starting_path_part_id = Some(path_part_map_object.base_object.id.clone());
            }

            db_manage::add_map_object_to_db(db_connection, &path_part_map_object).expect("Error adding part to DB.");
        }

        // Create path
        let path_extended_obj = Path {
            starting_path_part_id: starting_path_part_id.unwrap()
        };
        let path_base_obj = BaseMapObject::new("PATH".to_string());
        let path_map_obj = MapObject {
            base_object: path_base_obj,
            extended_object: ExtendedMapObjectEnum::Path(path_extended_obj)
        };

        // Add path to db
        db_manage::add_map_object_to_db(db_connection, &path_map_obj).expect("Error adding path to DB.");
    }
    println!("All map objects added to db.");
}

fn get_way_type(way: &Element) -> String {
    for child in &way.children {
        let element = child.as_element();
        if element.is_some() {
            let element = element.unwrap();
            if element.name.eq("tag") {
                let tag_key = element.attributes.get("k").unwrap();
                if tag_key.eq("highway") {
                    return "highway".to_string()
                } else if tag_key.eq("waterway") {
                    return "water_way".to_string()
                } else if tag_key.eq("natural") && element.attributes.get("v").unwrap().eq("water") {
                    return "water_area".to_string()
                } else if tag_key.eq("landure") {
                    return "land".to_string()
                }
            }
        }
    }
    if !way.name.eq("way") {
        return "no_way".to_string()
    }

    return "other".to_string()
}