use serde::Serialize;
#[derive(Debug, thiserror::Error)]
#[error("{detail}")]
pub struct Error {
    pub status: u16,
    pub code: String,
    pub detail: String,
    pub retry_after: Option<i64>,
    pub field_errors: Option<Vec<FieldError>>,
}
#[derive(Debug, Serialize)]
pub struct FieldError {
    pub location: Vec<serde_json::Value>,
    pub message: String,
    pub r#type: String,
}
pub type Result<T> = std::result::Result<T, Error>;
impl Error {
    pub fn new(status: u16, code: &str, detail: impl Into<String>) -> Self {
        Self {
            status,
            code: code.into(),
            detail: detail.into(),
            retry_after: None,
            field_errors: None,
        }
    }
    pub fn missing(kind: &str, id: &str) -> Self {
        Self::new(
            404,
            if kind == "project" {
                "project_not_found"
            } else {
                "not_found"
            },
            format!("{kind} {id} not found"),
        )
    }
    pub fn invalid(detail: impl Into<String>) -> Self {
        let detail = detail.into();
        let mut e = Self::new(422, "validation_error", detail.clone());
        e.field_errors = Some(vec![FieldError {
            location: vec![serde_json::json!("body")],
            message: detail,
            r#type: "value_error".into(),
        }]);
        e
    }
    pub fn conflict(detail: impl Into<String>) -> Self {
        Self::new(409, "revision_conflict", detail)
    }
    pub fn unauthorized() -> Self {
        Self::new(401, "http_error", "Authentication required")
    }
    pub fn throttled(seconds: i64) -> Self {
        let mut e = Self::new(429, "http_error", "Too many sign-in attempts; retry later");
        e.retry_after = Some(seconds);
        e
    }
}
impl From<sea_orm::DbErr> for Error {
    fn from(value: sea_orm::DbErr) -> Self {
        tracing_error(&value);
        Self::new(500, "internal_error", "Database operation failed")
    }
}
fn tracing_error(value: &sea_orm::DbErr) {
    eprintln!("database operation failed: {value}");
}
impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Self::invalid(e.to_string())
    }
}
