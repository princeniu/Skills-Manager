use sha2::{Digest, Sha256};

pub fn hash_realpath(realpath: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(realpath.as_bytes());
    let digest = hasher.finalize();
    format!("{:x}", digest)
}
