mod db_manage;

fn main() {
    let mut db_connection = db_manage::create_connection();
    let map_objects = db_manage::get_map_objects(&mut db_connection);

    for map_object in map_objects {
        println!("{:?}", map_object);
    }
}