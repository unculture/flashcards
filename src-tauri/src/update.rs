//! Checks GitHub for a newer release. The app has no self-updater, so it only
//! tells her a new version exists and opens the installer download.

use std::time::Duration;

use serde::{Deserialize, Serialize};

const LATEST_RELEASE: &str = "https://api.github.com/repos/unculture/flashcards/releases/latest";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Update {
    pub version: String,
    /// The installer for this computer, or the release page if there is none.
    pub download_url: String,
    pub release_url: String,
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

/// Returns the newest release if it is newer than `current`. Network errors
/// are returned as Err, and the app ignores them.
pub fn check(current: &str) -> Result<Option<Update>, String> {
    let url = std::env::var("FLASHCARDS_UPDATE_URL").unwrap_or_else(|_| LATEST_RELEASE.into());
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(15)))
        .build()
        .into();
    let release: Release = agent
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "flashcards-app")
        .call()
        .map_err(|e| e.to_string())?
        .body_mut()
        .read_json()
        .map_err(|e| e.to_string())?;
    Ok(newer(release, current))
}

fn newer(release: Release, current: &str) -> Option<Update> {
    if release.draft || release.prerelease {
        return None;
    }
    let version = release.tag_name.trim_start_matches('v').to_string();
    if parse(&version)? <= parse(current)? {
        return None;
    }
    let installer = release.assets.iter().find(|a| is_installer_for_this_computer(&a.name));
    Some(Update {
        download_url: installer.map_or(release.html_url.clone(), |a| a.browser_download_url.clone()),
        release_url: release.html_url,
        version,
    })
}

fn is_installer_for_this_computer(name: &str) -> bool {
    if cfg!(target_os = "windows") {
        name.ends_with("-setup.exe")
    } else if cfg!(target_os = "macos") {
        let arch = if cfg!(target_arch = "aarch64") { "aarch64" } else { "x64" };
        name.ends_with(".dmg") && name.contains(arch)
    } else {
        false
    }
}

/// "0.10.2" becomes (0, 10, 2), so it compares as a version.
fn parse(version: &str) -> Option<(u32, u32, u32)> {
    let mut parts = version.split('.').map(|p| p.parse::<u32>().ok());
    Some((parts.next()??, parts.next()??, parts.next().unwrap_or(Some(0))?))
}

/// Only GitHub links for this repository may be opened from the update banner.
pub fn is_release_url(url: &str) -> bool {
    url.starts_with("https://github.com/unculture/flashcards/releases/")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str) -> Release {
        serde_json::from_value(serde_json::json!({
            "tag_name": tag,
            "html_url": format!("https://github.com/unculture/flashcards/releases/tag/{tag}"),
            "assets": [
                {"name": "Flashcards_0.3.0_aarch64.dmg", "browser_download_url": "https://github.com/unculture/flashcards/releases/download/v0.3.0/Flashcards_0.3.0_aarch64.dmg"},
                {"name": "Flashcards_0.3.0_x64-setup.exe", "browser_download_url": "https://github.com/unculture/flashcards/releases/download/v0.3.0/Flashcards_0.3.0_x64-setup.exe"}
            ]
        }))
        .unwrap()
    }

    #[test]
    fn finds_newer_versions_only() {
        assert!(newer(release("v0.3.0"), "0.2.0").is_some());
        assert!(newer(release("v0.10.0"), "0.9.5").is_some());
        assert!(newer(release("v0.2.0"), "0.2.0").is_none());
        assert!(newer(release("v0.1.9"), "0.2.0").is_none());
        assert!(newer(release("nightly"), "0.2.0").is_none());
    }

    /// Asks the real GitHub. Run with `cargo test --lib live_github -- --ignored --nocapture`.
    #[test]
    #[ignore = "calls GitHub"]
    fn live_github() {
        let update = check("0.0.1").unwrap().expect("a release newer than 0.0.1");
        println!("{} {}", update.version, update.download_url);
        assert!(is_release_url(&update.download_url));
        assert!(check("999.0.0").unwrap().is_none());
    }

    #[test]
    fn picks_this_computers_installer() {
        let update = newer(release("v0.3.0"), "0.2.0").unwrap();
        assert_eq!(update.version, "0.3.0");
        assert!(is_release_url(&update.download_url));
        if cfg!(target_os = "macos") {
            assert!(update.download_url.ends_with("_aarch64.dmg") || update.download_url.contains("/tag/"));
        }
        if cfg!(target_os = "windows") {
            assert!(update.download_url.ends_with("-setup.exe"));
        }
    }
}
