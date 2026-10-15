//! The decks and cards, stored as one JSON document.
//!
//! The front end owns the shape of the document. The back end only reads and
//! writes it safely: each save writes a temporary file and renames it, and the
//! previous version stays as `library.backup.json`.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

pub struct Library {
    path: PathBuf,
}

impl Library {
    pub fn new(dir: &Path) -> Self {
        Self { path: dir.join("library.json") }
    }

    pub fn load(&self) -> Result<Option<Value>, String> {
        let text = match fs::read_to_string(&self.path) {
            Ok(text) => text,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(err) => return Err(err.to_string()),
        };
        match serde_json::from_str(&text) {
            Ok(value) => Ok(Some(value)),
            Err(err) => {
                // Keep the unreadable file, so a later save cannot destroy it.
                let stamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                let keep = self.path.with_file_name(format!("library.unreadable-{stamp}.json"));
                let _ = fs::copy(&self.path, &keep);
                eprintln!("[library] could not read {}: {err}", self.path.display());
                Ok(None)
            }
        }
    }

    pub fn save(&self, value: &Value) -> Result<(), String> {
        let dir = self.path.parent().ok_or("No folder for the library")?;
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, text).map_err(|e| e.to_string())?;
        if self.path.is_file() {
            let _ = fs::copy(&self.path, self.path.with_file_name("library.backup.json"));
        }
        fs::rename(&tmp, &self.path).map_err(|e| e.to_string())
    }
}
