use rusqlite::{params, Connection};
use std::{
    error::Error,
    fmt,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::Duration,
};

const CAPTURE_COUNT_KEY: &str = "screenshots_captured";

#[derive(Debug)]
pub enum ScreenshotCounterError {
    ConfigDirectoryUnavailable,
    Io(std::io::Error),
    Database(rusqlite::Error),
    LockPoisoned,
    InvalidStoredValue(i64),
}

impl fmt::Display for ScreenshotCounterError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ConfigDirectoryUnavailable => {
                write!(
                    formatter,
                    "failed to determine the application config directory"
                )
            }
            Self::Io(error) => write!(formatter, "failed to prepare counter storage: {error}"),
            Self::Database(error) => {
                write!(formatter, "screenshot counter database error: {error}")
            }
            Self::LockPoisoned => {
                write!(formatter, "screenshot counter database lock was poisoned")
            }
            Self::InvalidStoredValue(value) => {
                write!(
                    formatter,
                    "screenshot counter contains invalid value: {value}"
                )
            }
        }
    }
}

impl Error for ScreenshotCounterError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Io(error) => Some(error),
            Self::Database(error) => Some(error),
            _ => None,
        }
    }
}

impl From<std::io::Error> for ScreenshotCounterError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<rusqlite::Error> for ScreenshotCounterError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Database(error)
    }
}

pub struct ScreenshotCounter {
    connection: Mutex<Connection>,
    current: AtomicU64,
}

impl ScreenshotCounter {
    pub fn new() -> Result<Self, ScreenshotCounterError> {
        let config_dir = dirs::config_dir()
            .ok_or(ScreenshotCounterError::ConfigDirectoryUnavailable)?
            .join("snipp");
        Self::open(config_dir.join("stats.sqlite3"))
    }

    fn open(database_path: PathBuf) -> Result<Self, ScreenshotCounterError> {
        if let Some(parent) = database_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let connection = Connection::open(database_path)?;
        connection.busy_timeout(Duration::from_secs(1))?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "synchronous", "NORMAL")?;
        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS counters (
                name TEXT PRIMARY KEY NOT NULL,
                value INTEGER NOT NULL CHECK (value >= 0)
            );",
        )?;
        connection.execute(
            "INSERT OR IGNORE INTO counters (name, value) VALUES (?1, 0)",
            params![CAPTURE_COUNT_KEY],
        )?;

        let stored_value = read_capture_count(&connection)?;
        let current = u64::try_from(stored_value)
            .map_err(|_| ScreenshotCounterError::InvalidStoredValue(stored_value))?;

        Ok(Self {
            connection: Mutex::new(connection),
            current: AtomicU64::new(current),
        })
    }

    pub fn current(&self) -> u64 {
        self.current.load(Ordering::Acquire)
    }

    pub fn increment(&self) -> Result<u64, ScreenshotCounterError> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| ScreenshotCounterError::LockPoisoned)?;
        let stored_value = connection.query_row(
            "UPDATE counters
             SET value = value + 1
             WHERE name = ?1
             RETURNING value",
            params![CAPTURE_COUNT_KEY],
            |row| row.get::<_, i64>(0),
        )?;
        let current = u64::try_from(stored_value)
            .map_err(|_| ScreenshotCounterError::InvalidStoredValue(stored_value))?;
        self.current.store(current, Ordering::Release);
        Ok(current)
    }

    #[cfg(test)]
    fn journal_mode(&self) -> Result<String, ScreenshotCounterError> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| ScreenshotCounterError::LockPoisoned)?;
        Ok(connection.query_row("PRAGMA journal_mode", [], |row| row.get(0))?)
    }
}

fn read_capture_count(connection: &Connection) -> Result<i64, rusqlite::Error> {
    connection.query_row(
        "SELECT value FROM counters WHERE name = ?1",
        params![CAPTURE_COUNT_KEY],
        |row| row.get(0),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use std::sync::Arc;

    fn database_path(directory: &Path) -> PathBuf {
        directory.join("stats.sqlite3")
    }

    #[test]
    fn initializes_at_zero_with_wal_enabled() {
        let temp_dir = tempfile::tempdir().unwrap();
        let counter = ScreenshotCounter::open(database_path(temp_dir.path())).unwrap();

        assert_eq!(counter.current(), 0);
        assert_eq!(counter.journal_mode().unwrap(), "wal");
    }

    #[test]
    fn increments_and_persists_across_reopen() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = database_path(temp_dir.path());

        {
            let counter = ScreenshotCounter::open(path.clone()).unwrap();
            assert_eq!(counter.increment().unwrap(), 1);
            assert_eq!(counter.increment().unwrap(), 2);
        }

        let reopened = ScreenshotCounter::open(path).unwrap();
        assert_eq!(reopened.current(), 2);
    }

    #[test]
    fn serializes_concurrent_increments() {
        let temp_dir = tempfile::tempdir().unwrap();
        let counter = Arc::new(ScreenshotCounter::open(database_path(temp_dir.path())).unwrap());
        let mut workers = Vec::new();

        for _ in 0..4 {
            let counter = Arc::clone(&counter);
            workers.push(std::thread::spawn(move || {
                for _ in 0..25 {
                    counter.increment().unwrap();
                }
            }));
        }

        for worker in workers {
            worker.join().unwrap();
        }

        assert_eq!(counter.current(), 100);
    }
}
