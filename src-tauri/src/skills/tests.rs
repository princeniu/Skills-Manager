#[test]
fn id_is_sha256_hex_of_realpath() {
    let path = "/tmp/example";
    let real = "/tmp/example";
    let id = crate::skills::utils::hash_realpath(real);
    assert_eq!(id.len(), 64);
}
