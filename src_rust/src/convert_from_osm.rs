use std::{fs::{File}, collections::HashMap, io::BufReader};

use db_manage::map_objects::*;
use uuid::Uuid;
use xmltree::Element;

#[path = "map_objects.rs"]
mod map_objects;
#[path = "db_manage.rs"]
mod db_manage;

fn main() {
    
    let osm_data = Element::parse(BufReader::new(File::open("../docs/cambridgeshire-latest.osm").unwrap())).unwrap();
    let mut nodes: HashMap<String, Element> = HashMap::new();
    let mut ways = Vec::new();
    let mut filtered_ways = Vec::new();
    let mut relations = Vec::new();

    let db_connection = &mut db_manage::create_connection();

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

    for way in ways {
        let way_type = get_way_type(&way);
        if !way_type.eq("no_way") {
            filtered_ways.push(way);
        }
    }

    for way in filtered_ways {
        let way_type = get_way_type(&way);

        if (way_type.eq("other")) {
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
            let base_map_object = BaseMapObject {
                id: Uuid::new_v4().to_string(),
                object_type: "POINT".to_string(),
                metadata: "{}".to_string()
            };

            let map_object: MapObject = MapObject {
                base_object: base_map_object, 
                extended_object: ExtendedMapObjectEnum::Point(map_point)
            };

            db_manage::add_map_object_to_db(db_connection, &map_object);
        }
    }
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