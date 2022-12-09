use std::{fs::{File}, collections::HashMap};

use xmltree::Element;

#[path = "map_objects.rs"]
mod map_objects;
#[path = "db_manage.rs"]
mod db_manage;

fn main() {
    let osm_data = Element::parse(File::open("../docs/cambridgeshire-latest.osm").unwrap()).unwrap();
    let mut nodes: HashMap<String, Element> = HashMap::new();
    let mut ways = Vec::new();
    let mut relations = Vec::new();

    for element in osm_data.children {
        let element = element.as_element();
        if element.is_some() {
            let element = element.unwrap();
            if element.name == "node" {
                nodes.insert(
                    element.attributes.get("id").unwrap().clone(), 
                    element.clone()
                ).unwrap();
            } else if element.name == "way" {
                ways.push(element.clone());
            } else if element.name == "relation" {
                relations.push(element.clone());
            }
        }
    }
}