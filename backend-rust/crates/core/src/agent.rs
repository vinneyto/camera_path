use crate::{
    Error, Result, database, geometry,
    models::*,
    ports::{LanguageModel, ModelEvent, ModelRequest},
    service::{self, Action, Command, Core, Resource},
};
use serde_json::{Value, json};
use std::sync::Arc;
use tokio::sync::mpsc;
#[derive(Clone)]
pub struct Agent {
    pub core: Core,
    pub model: String,
    pub provider: Option<Arc<dyn LanguageModel>>,
}
#[derive(Debug)]
pub enum AgentEvent {
    Delta(String),
    Result(Value),
}
impl Agent {
    pub fn ensure_available(&self) -> Result<()> {
        if self.provider.is_none() {
            return Err(Error::new(
                503,
                "agent_unavailable",
                "OPENAI_API_KEY is not configured",
            ));
        }
        Ok(())
    }
    pub async fn start(
        &self,
        id: &str,
        expected: i64,
        message_id: String,
        content: String,
    ) -> Result<Project> {
        let (p, _) = self
            .core
            .mutate(
                id,
                expected,
                Command::UserMessage {
                    id: message_id,
                    content,
                },
            )
            .await?;
        self.ensure_available()?;
        Ok(p)
    }
    pub async fn run(
        &self,
        mut draft: Project,
        events: Option<mpsc::Sender<AgentEvent>>,
    ) -> Result<Value> {
        self.ensure_available()?;
        let provider = self.provider.as_ref().unwrap();
        let expected = draft.revision;
        let mut inputs = draft
            .chat_history
            .iter()
            .map(|m| json!({"role":m.role,"content":m.content}))
            .collect::<Vec<_>>();
        let mut answer = String::new();
        for _ in 0..12 {
            let request = ModelRequest {
                model: self.model.clone(),
                instructions: include_str!("agent_instructions.txt").into(),
                tools: serde_json::from_str(include_str!("agent_tools.json")).unwrap(),
                input: inputs.clone(),
            };
            let response = if let Some(events) = &events {
                let (tx, mut rx) = mpsc::channel(32);
                let provider = provider.clone();
                let worker = tokio::spawn(async move { provider.stream(request, tx).await });
                let before = answer.len();
                let mut response = None;
                while let Some(event) = rx.recv().await {
                    match event {
                        ModelEvent::Delta(text) => {
                            answer.push_str(&text);
                            if events.send(AgentEvent::Delta(text)).await.is_err() {
                                worker.abort();
                                return Err(Error::new(
                                    502,
                                    "upstream_error",
                                    "Client disconnected",
                                ));
                            }
                        }
                        ModelEvent::Completed(value) => response = Some(value),
                    }
                }
                worker
                    .await
                    .map_err(|_| Error::new(502, "upstream_error", "OpenAI stream failed"))?
                    .map_err(|_| {
                        Error::new(
                            502,
                            "upstream_error",
                            "stream ended without a completed response",
                        )
                    })?;
                let response = response.ok_or_else(|| {
                    Error::new(
                        502,
                        "upstream_error",
                        "stream ended without a completed response",
                    )
                })?;
                if answer.len() == before {
                    let text = output_text(&response);
                    if !text.is_empty() {
                        answer.push_str(&text);
                        events.send(AgentEvent::Delta(text)).await.map_err(|_| {
                            Error::new(502, "upstream_error", "Client disconnected")
                        })?;
                    }
                }
                response
            } else {
                provider
                    .respond(request)
                    .await
                    .map_err(|_| Error::new(502, "upstream_error", "OpenAI request failed"))?
            };
            let output = response["output"]
                .as_array()
                .ok_or_else(|| Error::new(502, "upstream_error", "Invalid OpenAI response"))?;
            inputs.extend(output.iter().cloned());
            let calls = output
                .iter()
                .filter(|v| v["type"] == "function_call")
                .collect::<Vec<_>>();
            if calls.is_empty() {
                if events.is_none() {
                    answer = output_text(&response);
                }
                draft.chat_history.push(ChatMessage {
                    id: new_id(),
                    role: Role::Assistant,
                    content: answer.clone(),
                });
                self.core.compile(draft.clone()).await?;
                let tx = self.core.db.write().await?;
                let current = database::load(&tx, &draft.id).await?;
                service::check_revision(&current, expected)?;
                draft.revision = expected + 1;
                database::save(&tx, &draft, expected).await?;
                tx.commit().await?;
                let compiled = self.core.compile(draft).await?;
                return Ok(json!({"answer":answer,"compiled":compiled}));
            }
            for call in calls {
                let mut candidate = draft.clone();
                let result =
                    serde_json::from_str::<Value>(call["arguments"].as_str().unwrap_or(""))
                        .map_err(Error::from)
                        .and_then(|args| {
                            execute(&mut candidate, call["name"].as_str().unwrap_or(""), args)
                        })
                        .and_then(|value| {
                            geometry::validate(&candidate)?;
                            Ok(value)
                        });
                let output = match result {
                    Ok(value) => {
                        draft = candidate;
                        value
                    }
                    Err(error) => json!({"status":"error","error":error.detail}),
                };
                inputs.push(json!({"type":"function_call_output","call_id":call["call_id"],"output":serde_json::to_string(&output)?}));
            }
        }
        Err(Error::new(
            502,
            "upstream_error",
            "agent exceeded the maximum number of tool-call rounds",
        ))
    }
}
fn output_text(response: &Value) -> String {
    response["output"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|v| v["type"] == "message")
        .flat_map(|m| m["content"].as_array().into_iter().flatten())
        .filter(|v| v["type"] == "output_text")
        .filter_map(|v| v["text"].as_str())
        .collect()
}
fn tool_aim(args: &Value) -> Value {
    if args["aim_kind"] == "look_at_point" {
        json!({"kind":"look_at_point","scene_point_id":args["scene_point_id"]})
    } else {
        json!({"kind":"follow_path","direction":args.get("direction").filter(|v|!v.is_null()).cloned().unwrap_or_else(||json!("forward"))})
    }
}
fn tool_focus(args: &Value) -> Value {
    if args["focus_kind"] == "scene_point" {
        json!({"kind":"scene_point","scene_point_id":args["scene_point_id"]})
    } else {
        json!({"kind":"center_weighted_9"})
    }
}
pub fn execute(p: &mut Project, name: &str, mut args: Value) -> Result<Value> {
    if name == "get_project_state" {
        return Ok(
            json!({"anchors":p.anchors.values().collect::<Vec<_>>(),"segments":p.segments,"scene_points":p.scene_points.values().collect::<Vec<_>>(),"motion_profile":p.motion_profile,"camera_track":p.camera_track}),
        );
    }
    let id = args["id"].as_str().unwrap_or("").to_string();
    let command = match name {
        "set_default_speed" => Command::Edit(
            Resource::Motion,
            Action::Update(String::new(), json!({"default_speed":args["speed"]})),
        ),
        "create_spline" | "create_spiral" => {
            args["kind"] = json!(if name == "create_spline" {
                "spline"
            } else {
                "spiral"
            });
            Command::Edit(Resource::Segments, Action::Create(args))
        }
        "delete_segment" => Command::Edit(Resource::Segments, Action::Delete(id)),
        "delete_scene_point" => {
            service::delete_scene_point(p, &id, args["cascade"].as_bool().unwrap_or(false))?;
            return Ok(json!({"id":id,"status":"ok"}));
        }
        "set_lidar_timeline" => {
            args.as_object_mut()
                .ok_or_else(|| Error::invalid("Expected arguments"))?
                .retain(|_, v| !v.is_null());
            Command::Edit(Resource::Lidar, Action::Update(String::new(), args))
        }
        "delete_lidar_timeline" => Command::Edit(Resource::Lidar, Action::Clear),
        name => {
            let (operation, kind) = name
                .split_once('_')
                .ok_or_else(|| Error::invalid("Unknown tool"))?;
            let resource = match kind {
                "scene_point" => Resource::ScenePoint,
                "speed_keyframe" => Resource::Motion,
                "camera_keyframe" => Resource::Aim,
                "camera_orientation_keyframe" => Resource::Orientation,
                "depth_of_field_keyframe" => Resource::Dof,
                _ => return Err(Error::invalid("Unknown tool")),
            };
            if matches!(resource, Resource::Aim)
                && (operation == "create" || !args["aim_kind"].is_null())
            {
                args["aim"] = tool_aim(&args);
            }
            if matches!(resource, Resource::Dof)
                && (operation == "create" || !args["focus_kind"].is_null())
            {
                args["focus"] = tool_focus(&args);
            }
            if matches!(resource, Resource::Orientation) {
                let current = if operation == "update" {
                    p.camera_track
                        .orientation_keyframes
                        .get(&id)
                        .map(|v| json!(v.orientation))
                        .unwrap_or_else(|| json!({}))
                } else {
                    json!({})
                };
                let mut orientation = current;
                let mut changed = false;
                for field in ["yaw_deg", "pitch_deg", "roll_deg"] {
                    if let Some(v) = args.get(field).filter(|v| !v.is_null()) {
                        orientation[field] = v.clone();
                        changed = true;
                    }
                }
                if operation == "create" || changed {
                    args["orientation"] = orientation;
                }
            }
            let action = match operation {
                "create" => Action::Create(args),
                "update" => Action::Update(id, args),
                "delete" => Action::Delete(id),
                _ => return Err(Error::invalid("Unknown tool")),
            };
            Command::Edit(resource, action)
        }
    };
    let (value, _) = service::apply(p, command)?;
    geometry::validate(p)?;
    Ok(json!({"id":value.get("id"),"status":"ok"}))
}
