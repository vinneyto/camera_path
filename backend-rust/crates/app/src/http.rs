use crate::config::Config;
use axum::{
    Json, Router,
    body::{Body, to_bytes},
    extract::{Request, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    response::{Html, IntoResponse, Response},
};
use camera_path_core::{
    Error,
    agent::{Agent, AgentEvent},
    auth::Auth,
    library::Library,
    models::new_id,
    service::{self, Action, Command, Core, Resource},
};
use futures_util::stream;
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, HashMap},
    convert::Infallible,
    sync::Arc,
};
use tokio::sync::{Mutex, mpsc};
use utoipa::OpenApi;
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub core: Core,
    pub auth: Auth,
    pub library: Library,
    pub agent: Agent,
    routes: Arc<Vec<Route>>,
    schema: Arc<Value>,
    locks: Arc<Mutex<HashMap<String, Arc<Mutex<()>>>>>,
}
struct Route {
    method: String,
    path: Vec<String>,
    operation: String,
    status: u16,
    validator: Option<jsonschema::Validator>,
}
#[derive(OpenApi)]
#[openapi(paths(health))]
struct ApiDoc;
#[utoipa::path(get,path="/health",responses((status=200,description="Backend health")))]
async fn health() -> Json<Value> {
    Json(json!({"status":"ok"}))
}
impl AppState {
    pub fn new(
        config: Config,
        core: Core,
        auth: Auth,
        library: Library,
        agent: Agent,
    ) -> anyhow::Result<Self> {
        let mut schema: Value =
            serde_json::from_str(include_str!("../../../../backend/openapi.json"))?;
        let generated = ApiDoc::openapi();
        schema["info"]["description"] = json!(
            "Camera Path Rust modular monolith. Compatibility schemas and operation IDs preserve the frontend API."
        );
        schema["info"]["version"] = json!(env!("CARGO_PKG_VERSION"));
        // Utoipa owns native route documentation; the checked-in compatibility contract supplies the unchanged v1 DTOs.
        anyhow::ensure!(
            generated.paths.paths.contains_key("/health"),
            "Missing native API documentation"
        );
        let mut routes = vec![];
        for (path, methods) in schema["paths"].as_object().unwrap() {
            for (method, operation) in methods.as_object().unwrap() {
                let body = operation.pointer("/requestBody/content/application~1json/schema");
                let validator = body
                    .map(|body| {
                        let mut root = body.clone();
                        root["components"] = schema["components"].clone();
                        jsonschema::validator_for(&root)
                    })
                    .transpose()?;
                let status = operation["responses"]
                    .as_object()
                    .unwrap()
                    .keys()
                    .filter_map(|k| k.parse::<u16>().ok())
                    .find(|s| (200..300).contains(s))
                    .unwrap_or(200);
                routes.push(Route {
                    method: method.to_uppercase(),
                    path: path
                        .trim_matches('/')
                        .split('/')
                        .map(str::to_string)
                        .collect(),
                    operation: operation["operationId"].as_str().unwrap().into(),
                    status,
                    validator,
                });
            }
        }
        // Literal routes win over parameter routes, matching Axum/FastAPI semantics.
        routes.sort_by_key(|r| {
            std::cmp::Reverse(r.path.iter().filter(|s| !s.starts_with('{')).count())
        });
        Ok(Self {
            config,
            core,
            auth,
            library,
            agent,
            routes: Arc::new(routes),
            schema: Arc::new(schema),
            locks: Arc::new(Mutex::new(HashMap::new())),
        })
    }
    pub fn router(self) -> anyhow::Result<Router> {
        use tower_http::cors::CorsLayer;
        let origins = self
            .config
            .origins
            .iter()
            .map(|s| s.parse::<HeaderValue>())
            .collect::<std::result::Result<Vec<_>, _>>()?;
        let cors = CorsLayer::new()
            .allow_origin(origins)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PATCH,
                Method::DELETE,
                Method::PUT,
                Method::OPTIONS,
            ])
            .allow_headers([
                axum::http::header::AUTHORIZATION,
                axum::http::header::CONTENT_TYPE,
                axum::http::header::IF_MATCH,
            ])
            .expose_headers([axum::http::header::ETAG]);
        Ok(Router::new()
            .route("/health", axum::routing::get(health))
            .fallback(dispatch)
            .with_state(self.clone())
            .layer(cors)
            .layer(axum::middleware::from_fn_with_state(self, preflight)))
    }
}
async fn preflight(
    State(state): State<AppState>,
    request: Request,
    next: axum::middleware::Next,
) -> Response {
    if request.method() == Method::OPTIONS
        && request
            .headers()
            .contains_key("access-control-request-method")
        && let Some(origin) = request
            .headers()
            .get("origin")
            .and_then(|v| v.to_str().ok())
        && !state.config.origins.iter().any(|s| s == origin)
    {
        return (StatusCode::BAD_REQUEST, "Disallowed CORS origin").into_response();
    }
    next.run(request).await
}
fn token(headers: &HeaderMap) -> Option<&str> {
    let (scheme, value) = headers
        .get("authorization")?
        .to_str()
        .ok()?
        .split_once(' ')?;
    scheme.eq_ignore_ascii_case("Bearer").then_some(value)
}
fn reply(value: Value, status: u16, revision: Option<i64>) -> Response {
    let mut response = if status == 204 {
        StatusCode::NO_CONTENT.into_response()
    } else {
        (StatusCode::from_u16(status).unwrap(), Json(value)).into_response()
    };
    if let Some(revision) = revision {
        response
            .headers_mut()
            .insert("etag", format!("\"{revision}\"").parse().unwrap());
    }
    response
}
fn failure(error: Error, versioned: bool) -> Response {
    let body = if versioned {
        let mut body = json!({"code":error.code,"detail":error.detail});
        if let Some(fields) = error.field_errors {
            body["field_errors"] = json!(fields);
        }
        body
    } else {
        json!({"detail":error.detail})
    };
    let mut response = reply(body, error.status, None);
    if error.status == 401 {
        response
            .headers_mut()
            .insert("www-authenticate", HeaderValue::from_static("Bearer"));
    }
    if let Some(seconds) = error.retry_after {
        response
            .headers_mut()
            .insert("retry-after", seconds.to_string().parse().unwrap());
    }
    response
}
async fn dispatch(State(state): State<AppState>, request: Request) -> Response {
    let versioned = request.uri().path().starts_with("/api/v1/");
    match handle(state, request).await {
        Ok(response) => response,
        Err(error) => failure(error, versioned),
    }
}
async fn handle(state: AppState, request: Request) -> camera_path_core::Result<Response> {
    let method = request.method().as_str().to_string();
    let path = request.uri().path().to_string();
    if method == "GET" && path == "/api/v1/openapi.json" {
        return Ok(reply((*state.schema).clone(), 200, None));
    }
    if method == "GET" && path == "/docs" {
        return Ok(Html("<!doctype html><html><head><title>Camera Path API</title></head><body><script id='api-reference' data-url='/api/v1/openapi.json'></script><script src='https://cdn.jsdelivr.net/npm/@scalar/api-reference'></script></body></html>").into_response());
    }
    let versioned = path.starts_with("/api/v1/");
    let canonical = if !versioned && path.starts_with("/projects") {
        format!("/api/v1{path}")
    } else {
        path.clone()
    };
    let pieces = canonical.trim_matches('/').split('/').collect::<Vec<_>>();
    let origin = format!(
        "http://{}",
        request
            .headers()
            .get("host")
            .and_then(|h| h.to_str().ok())
            .unwrap_or("127.0.0.1")
    );
    let headers = request.headers().clone();
    let query = request.uri().query().unwrap_or("").to_string();
    if pieces.len() == 5 && pieces[..3] == ["api", "v1", "library"] && pieces[4] == "content" {
        if !state.library.storage.local_content() {
            return Err(Error::missing("route", &path));
        }
        let id = pieces[3];
        if method == "PUT" {
            state.auth.principal(token(&headers)).await?;
            let record = state.library.record(id).await?;
            if record.status != "pending" {
                return Err(Error::new(
                    409,
                    "reference_conflict",
                    "Upload has already been completed",
                ));
            }
            use futures_util::StreamExt;
            let mut upload = state
                .library
                .storage
                .begin_upload(&record.object_key)
                .await
                .map_err(|_| Error::new(502, "upstream_error", "Upload failed"))?;
            let mut chunks = request.into_body().into_data_stream();
            let mut count = 0u64;
            while let Some(chunk) = chunks.next().await {
                let chunk = chunk.map_err(|_| Error::invalid("Upload stream interrupted"))?;
                count += chunk.len() as u64;
                if count > record.size_bytes as u64 {
                    return Err(Error::new(413, "http_error", "File exceeds declared size"));
                }
                upload
                    .write(&chunk)
                    .await
                    .map_err(|_| Error::new(502, "upstream_error", "Upload failed"))?;
            }
            if count != record.size_bytes as u64 {
                return Err(Error::new(
                    422,
                    "http_error",
                    "File size does not match upload",
                ));
            }
            upload
                .finish()
                .await
                .map_err(|_| Error::new(502, "upstream_error", "Upload failed"))?;
            return Ok(reply(Value::Null, 204, None));
        }
        if method == "GET" || method == "HEAD" {
            use tokio::io::AsyncReadExt;
            let record = state.library.record(id).await?;
            if record.status != "ready" {
                return Err(Error::missing("Library file", id));
            }
            let size = record.size_bytes as u64;
            let mut start = 0;
            let mut length = size;
            let mut partial = false;
            if let Some(range) = headers.get("range").and_then(|h| h.to_str().ok()) {
                let range = range
                    .strip_prefix("bytes=")
                    .and_then(|v| v.split_once('-'))
                    .filter(|(_, end)| !end.contains(','));
                let (from, to) =
                    range.ok_or_else(|| Error::new(416, "http_error", "Invalid byte range"))?;
                let (left, right) = if from.is_empty() {
                    let suffix = to
                        .parse::<u64>()
                        .map_err(|_| Error::new(416, "http_error", "Invalid byte range"))?;
                    (size.saturating_sub(suffix), size - 1)
                } else {
                    let left = from
                        .parse::<u64>()
                        .map_err(|_| Error::new(416, "http_error", "Invalid byte range"))?;
                    let right = if to.is_empty() {
                        size - 1
                    } else {
                        to.parse::<u64>()
                            .map_err(|_| Error::new(416, "http_error", "Invalid byte range"))?
                            .min(size - 1)
                    };
                    (left, right)
                };
                if left >= size || right < left {
                    return Err(Error::new(416, "http_error", "Unsatisfiable byte range"));
                }
                start = left;
                length = right - left + 1;
                partial = true;
            }
            let reader = state
                .library
                .storage
                .open_range(&record.object_key, start)
                .await
                .map_err(|_| Error::missing("Library file", id))?;
            let body = if method == "HEAD" {
                Body::empty()
            } else {
                Body::from_stream(tokio_util::io::ReaderStream::new(reader.take(length)))
            };
            let mut response = Response::new(body);
            *response.status_mut() = if partial {
                StatusCode::PARTIAL_CONTENT
            } else {
                StatusCode::OK
            };
            response.headers_mut().insert(
                "content-type",
                HeaderValue::from_static("application/octet-stream"),
            );
            response
                .headers_mut()
                .insert("accept-ranges", HeaderValue::from_static("bytes"));
            response
                .headers_mut()
                .insert("content-length", length.to_string().parse().unwrap());
            if partial {
                response.headers_mut().insert(
                    "content-range",
                    format!("bytes {start}-{}/{}", start + length - 1, size)
                        .parse()
                        .unwrap(),
                );
            }
            return Ok(response);
        }
    }
    let mut params = BTreeMap::new();
    let route = state
        .routes
        .iter()
        .find(|route| {
            if route.method != method || route.path.len() != pieces.len() {
                return false;
            }
            let mut found = BTreeMap::new();
            for (expected, actual) in route.path.iter().zip(&pieces) {
                if expected.starts_with('{') {
                    found.insert(
                        expected.trim_matches(['{', '}']).to_string(),
                        (*actual).to_string(),
                    );
                } else if expected != actual {
                    return false;
                }
            }
            params = found;
            true
        })
        .ok_or_else(|| Error::missing("route", &path))?;
    let operation = route.operation.as_str();
    let status = if versioned {
        route.status
    } else {
        let routes: Value = serde_json::from_str(include_str!("legacy_routes.json")).unwrap();
        routes
            .as_array()
            .unwrap()
            .iter()
            .find(|r| {
                r["method"] == method
                    && r["path"].as_str().is_some_and(|p| {
                        p.split('/')
                            .zip(path.split('/'))
                            .all(|(a, b)| a.starts_with('{') || a == b)
                            && p.split('/').count() == path.split('/').count()
                    })
            })
            .and_then(|r| r["status"].as_u64())
            .unwrap_or(route.status as u64) as u16
    };
    let source = request
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|p| p.0.ip().to_string())
        .unwrap_or_else(|| "unknown".into());
    let protected = (method != "GET"
        && !["loginEditor", "verifyEditorCode", "resendEditorCode"].contains(&operation))
        || operation == "getEditorSession";
    if protected {
        state.auth.principal(token(&headers)).await?;
    }
    let project = params.get("project_id").map(String::as_str);
    let mut guard = None;
    let expected = if method != "GET" {
        if let Some(id) = project {
            let mutex = state
                .locks
                .lock()
                .await
                .entry(id.to_string())
                .or_insert_with(|| Arc::new(Mutex::new(())))
                .clone();
            guard = Some(mutex.lock_owned().await);
            if versioned && !headers.contains_key("if-match") {
                return Err(Error::new(
                    428,
                    "if_match_required",
                    "If-Match is required for this mutation",
                ));
            }
            let p = state.core.get(id).await?;
            let expected = if versioned {
                parse_etag(
                    headers
                        .get("if-match")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or(""),
                )?
            } else {
                p.revision
            };
            service::check_revision(&p, expected)?;
            Some(expected)
        } else {
            None
        }
    } else {
        None
    };
    let body = if route.validator.is_some() {
        let data = to_bytes(request.into_body(), 1024 * 1024)
            .await
            .map_err(|_| Error::invalid("Request body too large"))?;
        let body: Value = serde_json::from_slice(&data)
            .map_err(|_| Error::invalid("Invalid JSON request body"))?;
        if let Some(validator) = &route.validator {
            let fields = validator
                .iter_errors(&body)
                .map(|error| {
                    let mut location = vec![json!("body")];
                    for item in error.instance_path().to_string().split('/').skip(1) {
                        let item = item.replace("~1", "/").replace("~0", "~");
                        location.push(
                            item.parse::<usize>()
                                .map(|v| json!(v))
                                .unwrap_or_else(|_| json!(item)),
                        );
                    }
                    camera_path_core::error::FieldError {
                        location,
                        message: error.masked().to_string(),
                        r#type: "value_error".into(),
                    }
                })
                .collect::<Vec<_>>();
            if !fields.is_empty() {
                let mut error = Error::invalid("Request validation failed");
                error.field_errors = Some(fields);
                return Err(error);
            }
        }
        body
    } else {
        json!({})
    };
    let asset = params.get("asset_id").map(String::as_str).unwrap_or("");
    let result = match operation {
        "loginEditor" => {
            state
                .auth
                .login(
                    body["username"].as_str().unwrap(),
                    body["password"].as_str().unwrap(),
                    &source,
                )
                .await?
        }
        "verifyEditorCode" => {
            state
                .auth
                .verify(
                    body["challenge_id"].as_str().unwrap(),
                    body["code"].as_str().unwrap(),
                    &source,
                )
                .await?
        }
        "resendEditorCode" => {
            state
                .auth
                .resend(body["challenge_id"].as_str().unwrap(), &source)
                .await?
        }
        "getEditorSession" => json!({"username":state.auth.principal(token(&headers)).await?.0}),
        "logoutEditor" => {
            state.auth.logout(token(&headers)).await?;
            Value::Null
        }
        "getUserSettings" => state.core.settings(&state.config.user_id).await?,
        "updateUserSettings" => {
            state
                .core
                .update_settings(&state.config.user_id, &body)
                .await?
        }
        "listLibraryAssets" => state.library.list(&origin).await?,
        "getLibraryAsset" => state.library.get(asset, &origin).await?,
        "createLibraryUpload" => state.library.create(&body, &origin).await?,
        "completeLibraryUpload" => state.library.complete(asset, &origin).await?,
        "updateLibraryAssetDefaults" => state.library.defaults(asset, &body, &origin).await?,
        "deleteLibraryAsset" => {
            state.library.delete(vec![asset.into()]).await?;
            Value::Null
        }
        "deleteLibraryAssets" => {
            state
                .library
                .delete(serde_json::from_value(body["asset_ids"].clone())?)
                .await?;
            Value::Null
        }
        "listProjects" => {
            let projects = state.core.list().await?;
            if versioned {
                json!(projects.iter().map(service::metadata).collect::<Vec<_>>())
            } else {
                json!(projects)
            }
        }
        "createProject" => {
            let p = state
                .core
                .create(
                    body["name"]
                        .as_str()
                        .unwrap_or("Untitled camera path")
                        .into(),
                )
                .await?;
            return Ok(reply(
                if versioned {
                    service::metadata(&p)
                } else {
                    json!(p)
                },
                status,
                Some(p.revision),
            ));
        }
        _ => {
            let id = project.ok_or_else(|| Error::missing("route", &path))?;
            if operation == "getCompiledTrajectory" {
                let compiled = state.core.compiled(id).await?;
                let revision = compiled.revision;
                return Ok(reply(json!(compiled), status, Some(revision)));
            }
            if operation == "listProjectClouds" {
                let (value, revision) = state.library.clouds(id, &origin).await?;
                return Ok(reply(value, status, Some(revision)));
            }
            if [
                "createProjectCloud",
                "updateProjectCloud",
                "deleteProjectCloud",
            ]
            .contains(&operation)
            {
                let cloud = params.get("cloud_id").map(String::as_str);
                let data = (operation != "deleteProjectCloud").then_some(&body);
                let (value, revision) = state
                    .library
                    .cloud_mutate(id, expected.unwrap(), cloud, data, &origin)
                    .await?;
                return Ok(reply(value, status, Some(revision)));
            }
            if method == "GET" {
                let p = state.core.get(id).await?;
                let value = if operation == "getProject" {
                    if versioned {
                        service::metadata(&p)
                    } else {
                        json!(p)
                    }
                } else {
                    service::view(&p, resource(operation)?)
                };
                return Ok(reply(value, status, Some(p.revision)));
            }
            let expected = expected.unwrap();
            if operation == "deleteProject" {
                let revision = state.core.delete(id, expected).await?;
                return Ok(reply(Value::Null, status, Some(revision)));
            }
            if operation == "createChatMessage" || operation == "streamChatMessage" {
                let message = body["message"].as_str().unwrap().to_string();
                let message_id = body["id"]
                    .as_str()
                    .map(str::to_string)
                    .unwrap_or_else(new_id);
                let draft = state.agent.start(id, expected, message_id, message).await?;
                if operation == "streamChatMessage" {
                    let (sender, receiver) = mpsc::channel::<String>(32);
                    let agent = state.agent.clone();
                    let legacy_core = state.core.clone();
                    let legacy_id = id.to_string();
                    tokio::spawn(async move {
                        let _guard = guard;
                        let (events, mut rx) = mpsc::channel(32);
                        let worker =
                            tokio::spawn(async move { agent.run(draft, Some(events)).await });
                        while let Some(event) = rx.recv().await {
                            if let AgentEvent::Delta(text) = event
                                && sender
                                    .send(sse("delta", json!({"text":text})))
                                    .await
                                    .is_err()
                            {
                                worker.abort();
                                return;
                            }
                        }
                        let frame = match worker.await {
                            Ok(Ok(mut value)) => {
                                if !versioned && let Ok(project) = legacy_core.get(&legacy_id).await
                                {
                                    value["project"] = json!(project);
                                }
                                sse("result", value)
                            }
                            Ok(Err(error)) => sse(
                                "error",
                                json!({"code":"stream_error","detail":error.detail}),
                            ),
                            Err(_) => sse(
                                "error",
                                json!({"code":"stream_error","detail":"Stream failed"}),
                            ),
                        };
                        let _ = sender.send(frame).await;
                    });
                    let stream = stream::unfold(receiver, |mut receiver| async move {
                        receiver
                            .recv()
                            .await
                            .map(|frame| (Ok::<_, Infallible>(frame), receiver))
                    });
                    return Ok((
                        [
                            ("content-type", "text/event-stream"),
                            ("cache-control", "no-cache"),
                            ("x-accel-buffering", "no"),
                        ],
                        Body::from_stream(stream),
                    )
                        .into_response());
                }
                let mut value = state.agent.run(draft, None).await?;
                if !versioned {
                    value["project"] = json!(state.core.get(id).await?);
                }
                let revision = value["compiled"]["revision"].as_i64();
                return Ok(reply(value, status, revision));
            }
            let command = if operation == "updateProject" {
                Command::Rename(body["name"].as_str().unwrap().into())
            } else if operation == "resetProject" {
                Command::Reset
            } else if operation == "saveUserChatMessage" {
                Command::UserMessage {
                    id: body["id"]
                        .as_str()
                        .map(str::to_string)
                        .unwrap_or_else(new_id),
                    content: body["message"].as_str().unwrap().into(),
                }
            } else {
                let resource = resource(operation)?;
                let key = params
                    .get("anchor_id")
                    .or_else(|| params.get("point_id"))
                    .or_else(|| params.get("segment_id"))
                    .or_else(|| params.get("keyframe_id"))
                    .cloned();
                let action = if method == "DELETE" {
                    if let Some(mut key) = key {
                        if operation == "deleteScenePoint"
                            && query.split('&').any(|s| s == "cascade=true")
                        {
                            key.push_str("?cascade");
                        }
                        Action::Delete(key)
                    } else {
                        Action::Clear
                    }
                } else if method == "PATCH" {
                    Action::Update(key.unwrap_or_default(), body)
                } else if operation == "createDepthOfFieldTimeline" {
                    Action::Create(Value::Null)
                } else {
                    let mut value = body;
                    if operation == "createSplineSegment" {
                        value["kind"] = json!("spline");
                    }
                    if operation == "createSpiralSegment" {
                        value["kind"] = json!("spiral");
                    }
                    Action::Create(value)
                };
                Command::Edit(resource, action)
            };
            let (p, value) = state.core.mutate(id, expected, command).await?;
            let result = if !versioned {
                json!(p)
            } else if ["updateProject", "resetProject"].contains(&operation) {
                service::metadata(&p)
            } else {
                value
            };
            return Ok(reply(result, status, Some(p.revision)));
        }
    };
    Ok(reply(result, status, None))
}
fn parse_etag(header: &str) -> camera_path_core::Result<i64> {
    let header = header.trim().strip_prefix("W/").unwrap_or(header.trim());
    let digits = header
        .strip_prefix('"')
        .and_then(|s| s.strip_suffix('"'))
        .filter(|s| !s.is_empty() && s.bytes().all(|c| c.is_ascii_digit()));
    digits
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| Error::conflict("If-Match must contain a project revision ETag"))
}
fn resource(operation: &str) -> camera_path_core::Result<Resource> {
    Ok(match operation {
        "listAnchors" | "createAnchor" | "updateAnchor" | "deleteAnchor" => Resource::Anchor,
        "listScenePoints" | "createScenePoint" | "updateScenePoint" | "deleteScenePoint" => {
            Resource::ScenePoint
        }
        "getTrajectory"
        | "createSplineSegment"
        | "createSpiralSegment"
        | "deleteTrajectorySegment"
        | "clearTrajectory" => Resource::Segments,
        "getSpeedTimeline"
        | "deleteSpeedTimeline"
        | "updateMotionProfile"
        | "createSpeedKeyframe"
        | "updateSpeedKeyframe"
        | "deleteSpeedKeyframe" => Resource::Motion,
        "getAimTimeline"
        | "deleteAimTimeline"
        | "updateCameraTrack"
        | "createCameraAimKeyframe"
        | "updateCameraAimKeyframe"
        | "deleteCameraAimKeyframe" => Resource::Aim,
        "getOrientationTimeline"
        | "deleteOrientationTimeline"
        | "updateCameraOrientation"
        | "createCameraOrientationKeyframe"
        | "updateCameraOrientationKeyframe"
        | "deleteCameraOrientationKeyframe" => Resource::Orientation,
        "getDepthOfFieldTimeline"
        | "deleteDepthOfFieldTimeline"
        | "createDepthOfFieldTimeline"
        | "createDepthOfFieldKeyframe"
        | "updateDepthOfFieldKeyframe"
        | "deleteDepthOfFieldKeyframe" => Resource::Dof,
        "getLidarTimeline" | "setLidarTimeline" | "deleteLidarTimeline" => Resource::Lidar,
        "listChatMessages" | "clearProjectChat" => Resource::Chat,
        _ => return Err(Error::missing("operation", operation)),
    })
}
fn sse(event: &str, value: Value) -> String {
    format!("event: {event}\ndata: {value}\n\n")
}
