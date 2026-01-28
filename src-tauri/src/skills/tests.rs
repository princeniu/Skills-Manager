use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn make_temp_dir(name: &str) -> PathBuf {
    let mut base = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    base.push(format!("codex-skills-test-{}-{}-{}", name, std::process::id(), nanos));
    fs::create_dir_all(&base).unwrap();
    base
}

#[test]
fn id_is_sha256_hex_of_realpath() {
    let base = make_temp_dir("hash");
    let target = base.join("skill");
    fs::create_dir_all(&target).unwrap();
    let with_dots = target.join("..").join("skill");
    let real = target.canonicalize().unwrap();

    let id = crate::skills::utils::hash_realpath(&with_dots).unwrap();
    let mut hasher = Sha256::new();
    hasher.update(real.to_string_lossy().as_bytes());
    let expected = format!("{:x}", hasher.finalize());

    assert_eq!(id.len(), 64);
    assert_eq!(id, expected);

    let _ = fs::remove_dir_all(&base);
}

#[test]
fn hash_realpath_errors_when_missing() {
    let mut missing = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    missing.push(format!("codex-skills-missing-{}", nanos));
    let res = crate::skills::utils::hash_realpath(&missing);
    assert!(res.is_err());
}
