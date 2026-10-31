//! Provider-neutral, typed application state. Serialized names preserve the Python contract.
use crate::{Error, Result};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
pub type Vec3 = [f64; 3];
pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}
fn one() -> f64 {
    1.0
}
fn quarter() -> f64 {
    0.25
}
fn six() -> f64 {
    6.0
}
fn world_up() -> Vec3 {
    [0.0, 1.0, 0.0]
}
fn untitled() -> String {
    "Untitled camera path".into()
}
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Interpolation {
    #[default]
    Smoothstep,
    Linear,
    Hold,
}
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LiftAxis {
    #[default]
    WorldUp,
    SurfaceNormal,
}
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    Cw,
    #[default]
    Ccw,
}
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CurveLaw {
    Linear,
    #[default]
    Smoothstep,
}
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AimDirection {
    #[default]
    Forward,
    Backward,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Anchor {
    #[serde(default = "new_id")]
    pub id: String,
    pub label: String,
    pub surface_position: Vec3,
    #[serde(default = "world_up")]
    pub surface_normal: Vec3,
    #[serde(default)]
    pub lift: f64,
    #[serde(default)]
    pub lift_axis: LiftAxis,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ScenePoint {
    #[serde(default = "new_id")]
    pub id: String,
    pub label: String,
    pub position: Vec3,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Segment {
    Spline {
        #[serde(default = "new_id")]
        id: String,
        anchor_ids: Vec<String>,
        #[serde(default)]
        tension: f64,
    },
    Spiral {
        #[serde(default = "new_id")]
        id: String,
        start_anchor_id: String,
        center_anchor_id: String,
        end_anchor_id: String,
        #[serde(default = "one")]
        turns: f64,
        #[serde(default)]
        direction: Direction,
        #[serde(default)]
        radial_law: CurveLaw,
        #[serde(default)]
        axial_law: CurveLaw,
    },
}
impl Segment {
    pub fn id(&self) -> &str {
        match self {
            Self::Spline { id, .. } | Self::Spiral { id, .. } => id,
        }
    }
    pub fn anchors(&self) -> Vec<&str> {
        match self {
            Self::Spline { anchor_ids, .. } => anchor_ids.iter().map(String::as_str).collect(),
            Self::Spiral {
                start_anchor_id,
                center_anchor_id,
                end_anchor_id,
                ..
            } => vec![start_anchor_id, center_anchor_id, end_anchor_id],
        }
    }
    pub fn start(&self) -> &str {
        match self {
            Self::Spline { anchor_ids, .. } => &anchor_ids[0],
            Self::Spiral {
                start_anchor_id, ..
            } => start_anchor_id,
        }
    }
    pub fn end(&self) -> &str {
        match self {
            Self::Spline { anchor_ids, .. } => anchor_ids.last().unwrap(),
            Self::Spiral { end_anchor_id, .. } => end_anchor_id,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Aim {
    FollowPath {
        #[serde(default)]
        direction: AimDirection,
    },
    LookAtPoint {
        scene_point_id: String,
    },
}
impl Default for Aim {
    fn default() -> Self {
        Self::FollowPath {
            direction: AimDirection::Forward,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[derive(Default)]
pub enum Focus {
    #[serde(rename = "center_weighted_9")]
    #[default]
    CenterWeighted9,
    ScenePoint {
        scene_point_id: String,
    },
}
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Orientation {
    #[serde(default)]
    pub yaw_deg: f64,
    #[serde(default)]
    pub pitch_deg: f64,
    #[serde(default)]
    pub roll_deg: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SpeedKeyframe {
    #[serde(default = "new_id")]
    pub id: String,
    pub path_position: f64,
    pub speed: f64,
    #[serde(default)]
    pub interpolation_to_next: Interpolation,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct AimKeyframe {
    #[serde(default = "new_id")]
    pub id: String,
    pub path_position: f64,
    pub aim: Aim,
    #[serde(default)]
    pub interpolation_to_next: Interpolation,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OrientationKeyframe {
    #[serde(default = "new_id")]
    pub id: String,
    pub path_position: f64,
    pub orientation: Orientation,
    #[serde(default)]
    pub interpolation_to_next: Interpolation,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct DofKeyframe {
    #[serde(default = "new_id")]
    pub id: String,
    pub path_position: f64,
    #[serde(default)]
    pub focus: Focus,
    #[serde(default = "quarter")]
    pub focus_range_scale: f64,
    #[serde(default = "six")]
    pub bokeh_scale: f64,
}
fn fov() -> f64 {
    60.0
}
fn width() -> i64 {
    512
}
fn height() -> i64 {
    32
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct LidarKeyframe {
    #[serde(default = "new_id")]
    pub id: String,
    #[serde(default)]
    pub path_position: f64,
    #[serde(default = "fov")]
    pub vertical_fov_deg: f64,
    #[serde(default = "width")]
    pub horizontal_resolution: i64,
    #[serde(default = "height")]
    pub vertical_resolution: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Motion {
    #[serde(default = "one")]
    pub default_speed: f64,
    #[serde(default)]
    pub keyframes: IndexMap<String, SpeedKeyframe>,
}
impl Default for Motion {
    fn default() -> Self {
        Self {
            default_speed: 1.0,
            keyframes: IndexMap::new(),
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CameraTrack {
    #[serde(default)]
    pub default_aim: Aim,
    #[serde(default)]
    pub keyframes: IndexMap<String, AimKeyframe>,
    #[serde(default)]
    pub default_orientation: Orientation,
    #[serde(default)]
    pub orientation_keyframes: IndexMap<String, OrientationKeyframe>,
    #[serde(default)]
    pub depth_of_field_keyframes: IndexMap<String, DofKeyframe>,
    #[serde(default)]
    pub lidar_keyframe: Option<LidarKeyframe>,
    #[serde(default = "world_up")]
    pub world_up: Vec3,
}
impl Default for CameraTrack {
    fn default() -> Self {
        Self {
            default_aim: Aim::default(),
            keyframes: IndexMap::new(),
            default_orientation: Orientation::default(),
            orientation_keyframes: IndexMap::new(),
            depth_of_field_keyframes: IndexMap::new(),
            lidar_keyframe: None,
            world_up: world_up(),
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    User,
    Assistant,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ChatMessage {
    #[serde(default = "new_id")]
    pub id: String,
    pub role: Role,
    pub content: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Project {
    #[serde(default = "new_id")]
    pub id: String,
    #[serde(default = "untitled")]
    pub name: String,
    #[serde(default)]
    pub revision: i64,
    #[serde(default)]
    pub anchors: IndexMap<String, Anchor>,
    #[serde(default)]
    pub scene_points: IndexMap<String, ScenePoint>,
    #[serde(default)]
    pub segments: Vec<Segment>,
    #[serde(default)]
    pub camera_track: CameraTrack,
    #[serde(default)]
    pub motion_profile: Motion,
    #[serde(default)]
    pub chat_history: Vec<ChatMessage>,
}
impl Project {
    pub fn new(name: String) -> Self {
        Self {
            id: new_id(),
            name,
            revision: 0,
            anchors: IndexMap::new(),
            scene_points: IndexMap::new(),
            segments: vec![],
            camera_track: CameraTrack::default(),
            motion_profile: Motion::default(),
            chat_history: vec![],
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Cubic {
    pub source_segment_id: String,
    pub p0: Vec3,
    pub p1: Vec3,
    pub p2: Vec3,
    pub p3: Vec3,
    pub length: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ArcSample {
    pub segment_index: usize,
    pub t: f64,
    pub distance: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Compiled {
    pub project_id: String,
    pub revision: i64,
    pub position_segments: Vec<Cubic>,
    pub arc_length_table: Vec<ArcSample>,
    pub total_length: f64,
    pub duration_seconds: f64,
    pub motion_profile: serde_json::Value,
    pub camera_track: serde_json::Value,
    pub warnings: Vec<String>,
}
/// PATCH ignores nulls and unknown fields as the existing Pydantic resource DTOs do.
pub fn patch<T: Serialize + serde::de::DeserializeOwned>(
    old: &T,
    patch: &serde_json::Value,
) -> Result<T> {
    let mut merged = serde_json::to_value(old)?;
    let object = merged
        .as_object_mut()
        .ok_or_else(|| Error::invalid("Expected an object"))?;
    for (k, v) in patch
        .as_object()
        .ok_or_else(|| Error::invalid("Expected an object"))?
    {
        if !v.is_null() && object.contains_key(k) && k != "id" {
            object.insert(k.clone(), v.clone());
        }
    }
    Ok(serde_json::from_value(merged)?)
}
