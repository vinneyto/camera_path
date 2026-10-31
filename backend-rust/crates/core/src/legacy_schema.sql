CREATE TABLE auth_challenges (
	id TEXT NOT NULL,
	credential_version TEXT NOT NULL,
	code_digest TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	resend_at INTEGER NOT NULL,
	attempts INTEGER NOT NULL,
	delivered BOOLEAN NOT NULL,
	PRIMARY KEY (id)
);
CREATE TABLE auth_rate_limits (
	"key" TEXT NOT NULL,
	count INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	PRIMARY KEY ("key")
);
CREATE TABLE editor_sessions (
	id TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	PRIMARY KEY (id)
);
CREATE TABLE editors (
	id TEXT NOT NULL,
	username TEXT NOT NULL,
	password_hash TEXT NOT NULL,
	credential_version TEXT NOT NULL,
	PRIMARY KEY (id)
);
CREATE TABLE library_assets (
	id TEXT NOT NULL,
	name TEXT NOT NULL,
	format TEXT NOT NULL,
	object_key TEXT NOT NULL,
	size_bytes BIGINT NOT NULL,
	status VARCHAR(7) NOT NULL,
	created_at DATETIME NOT NULL,
	default_rotation_x_deg FLOAT NOT NULL,
	default_rotation_y_deg FLOAT NOT NULL,
	default_rotation_z_deg FLOAT NOT NULL,
	default_scale FLOAT NOT NULL,
	default_offset_x FLOAT NOT NULL,
	default_offset_y FLOAT NOT NULL,
	default_offset_z FLOAT NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (object_key),
	CONSTRAINT ck_library_assets_status CHECK (status IN ('pending', 'ready'))
);
CREATE TABLE projects (
	id TEXT NOT NULL,
	name TEXT NOT NULL,
	revision INTEGER NOT NULL,
	PRIMARY KEY (id)
);
CREATE TABLE user_settings (
	gaussian_dpr TEXT DEFAULT '1x' NOT NULL,
	user_id TEXT NOT NULL,
	webgpu_tile_renderer BOOLEAN DEFAULT 0 NOT NULL,
	show_grid BOOLEAN DEFAULT 1 NOT NULL,
	PRIMARY KEY (user_id)
);
CREATE TABLE anchors (
	id TEXT NOT NULL,
	label TEXT NOT NULL,
	surface_position_x FLOAT NOT NULL,
	surface_position_y FLOAT NOT NULL,
	surface_position_z FLOAT NOT NULL,
	surface_normal_x FLOAT NOT NULL,
	surface_normal_y FLOAT NOT NULL,
	surface_normal_z FLOAT NOT NULL,
	lift FLOAT NOT NULL,
	lift_axis VARCHAR(14) NOT NULL,
	project_id TEXT NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT ck_anchors_lift_axis CHECK (lift_axis IN ('world_up', 'surface_normal')),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_anchors_project_id ON anchors (project_id);
CREATE TABLE chat_messages (
	id TEXT NOT NULL,
	position INTEGER NOT NULL,
	role VARCHAR(9) NOT NULL,
	content TEXT NOT NULL,
	project_id TEXT NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_chat_messages_position UNIQUE (project_id, position),
	CONSTRAINT ck_chat_messages_role CHECK (role IN ('user', 'assistant')),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_chat_messages_project_id ON chat_messages (project_id);
CREATE TABLE lidar_keyframes (
	project_id TEXT NOT NULL,
	id TEXT NOT NULL,
	vertical_fov_deg FLOAT NOT NULL,
	horizontal_resolution INTEGER NOT NULL,
	vertical_resolution INTEGER NOT NULL,
	PRIMARY KEY (project_id),
	CONSTRAINT ck_lidar_fov CHECK (vertical_fov_deg > 0 AND vertical_fov_deg < 180),
	CONSTRAINT ck_lidar_width CHECK (horizontal_resolution BETWEEN 1 AND 4096),
	CONSTRAINT ck_lidar_height CHECK (vertical_resolution BETWEEN 1 AND 256),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE TABLE motion_profiles (
	project_id TEXT NOT NULL,
	default_speed FLOAT NOT NULL,
	PRIMARY KEY (project_id),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE TABLE orientation_keyframes (
	id TEXT NOT NULL,
	path_position FLOAT NOT NULL,
	yaw_deg FLOAT NOT NULL,
	pitch_deg FLOAT NOT NULL,
	roll_deg FLOAT NOT NULL,
	interpolation_to_next VARCHAR(10) NOT NULL,
	project_id TEXT NOT NULL,
	PRIMARY KEY (id, project_id),
	CONSTRAINT ck_orientation_keyframes_interpolation_to_next CHECK (interpolation_to_next IN ('hold', 'linear', 'smoothstep')),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_orientation_keyframes_project_id ON orientation_keyframes (project_id);
CREATE TABLE project_clouds (
	id TEXT NOT NULL,
	project_id TEXT NOT NULL,
	library_asset_id TEXT NOT NULL,
	position INTEGER NOT NULL,
	visible BOOLEAN NOT NULL,
	translation_x FLOAT NOT NULL,
	translation_y FLOAT NOT NULL,
	translation_z FLOAT NOT NULL,
	rotation_x_deg FLOAT NOT NULL,
	rotation_y_deg FLOAT NOT NULL,
	rotation_z_deg FLOAT NOT NULL,
	scale FLOAT NOT NULL,
	offset_x FLOAT NOT NULL,
	offset_y FLOAT NOT NULL,
	offset_z FLOAT NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_project_cloud_position UNIQUE (project_id, position),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE,
	FOREIGN KEY(library_asset_id) REFERENCES library_assets (id) ON DELETE RESTRICT
);
CREATE INDEX ix_project_clouds_library_asset_id ON project_clouds (library_asset_id);
CREATE INDEX ix_project_clouds_project_id ON project_clouds (project_id);
CREATE TABLE scene_points (
	id TEXT NOT NULL,
	label TEXT NOT NULL,
	position_x FLOAT NOT NULL,
	position_y FLOAT NOT NULL,
	position_z FLOAT NOT NULL,
	project_id TEXT NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_scene_points_project_id_id UNIQUE (project_id, id),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_scene_points_project_id ON scene_points (project_id);
CREATE TABLE speed_keyframes (
	id TEXT NOT NULL,
	path_position FLOAT NOT NULL,
	speed FLOAT NOT NULL,
	interpolation_to_next VARCHAR(10) NOT NULL,
	project_id TEXT NOT NULL,
	PRIMARY KEY (id, project_id),
	CONSTRAINT ck_speed_keyframes_interpolation_to_next CHECK (interpolation_to_next IN ('hold', 'linear', 'smoothstep')),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_speed_keyframes_project_id ON speed_keyframes (project_id);
CREATE TABLE trajectory_segments (
	id TEXT NOT NULL,
	position INTEGER NOT NULL,
	kind VARCHAR(6) NOT NULL,
	tension FLOAT,
	turns FLOAT,
	direction VARCHAR(3),
	radial_law VARCHAR(10),
	axial_law VARCHAR(10),
	project_id TEXT NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_trajectory_segments_position UNIQUE (project_id, position),
	CONSTRAINT ck_segment_fields CHECK ((kind = 'spline' AND tension IS NOT NULL AND turns IS NULL AND direction IS NULL AND radial_law IS NULL AND axial_law IS NULL) OR (kind = 'spiral' AND tension IS NULL AND turns IS NOT NULL AND direction IS NOT NULL AND radial_law IS NOT NULL AND axial_law IS NOT NULL)),
	CONSTRAINT ck_trajectory_segments_kind CHECK (kind IN ('spline', 'spiral')),
	CONSTRAINT ck_trajectory_segments_direction CHECK (direction IN ('cw', 'ccw')),
	CONSTRAINT ck_trajectory_segments_radial_law CHECK (radial_law IN ('linear', 'smoothstep')),
	CONSTRAINT ck_trajectory_segments_axial_law CHECK (axial_law IN ('linear', 'smoothstep')),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_trajectory_segments_project_id ON trajectory_segments (project_id);
CREATE TABLE aim_keyframes (
	id TEXT NOT NULL,
	path_position FLOAT NOT NULL,
	aim_kind VARCHAR(13) NOT NULL,
	aim_direction VARCHAR(8),
	aim_scene_point_id TEXT,
	interpolation_to_next VARCHAR(10) NOT NULL,
	project_id TEXT NOT NULL,
	PRIMARY KEY (id, project_id),
	CONSTRAINT fk_aim_key_scene_point FOREIGN KEY(project_id, aim_scene_point_id) REFERENCES scene_points (project_id, id) DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT ck_aim_key_aim CHECK ((aim_kind = 'follow_path' AND aim_direction IS NOT NULL AND aim_scene_point_id IS NULL) OR (aim_kind = 'look_at_point' AND aim_direction IS NULL AND aim_scene_point_id IS NOT NULL)),
	CONSTRAINT ck_aim_keyframes_aim_kind CHECK (aim_kind IN ('follow_path', 'look_at_point')),
	CONSTRAINT ck_aim_keyframes_aim_direction CHECK (aim_direction IN ('forward', 'backward')),
	CONSTRAINT ck_aim_keyframes_interpolation_to_next CHECK (interpolation_to_next IN ('hold', 'linear', 'smoothstep')),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_aim_keyframes_project_id ON aim_keyframes (project_id);
CREATE TABLE camera_tracks (
	project_id TEXT NOT NULL,
	default_aim_kind VARCHAR(13) NOT NULL,
	default_aim_direction VARCHAR(8),
	default_aim_scene_point_id TEXT,
	world_up_x FLOAT NOT NULL,
	world_up_y FLOAT NOT NULL,
	world_up_z FLOAT NOT NULL,
	default_orientation_yaw_deg FLOAT NOT NULL,
	default_orientation_pitch_deg FLOAT NOT NULL,
	default_orientation_roll_deg FLOAT NOT NULL,
	PRIMARY KEY (project_id),
	CONSTRAINT fk_camera_track_scene_point FOREIGN KEY(project_id, default_aim_scene_point_id) REFERENCES scene_points (project_id, id) DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT ck_camera_track_aim CHECK ((default_aim_kind = 'follow_path' AND default_aim_direction IS NOT NULL AND default_aim_scene_point_id IS NULL) OR (default_aim_kind = 'look_at_point' AND default_aim_direction IS NULL AND default_aim_scene_point_id IS NOT NULL)),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE,
	CONSTRAINT ck_camera_tracks_default_aim_kind CHECK (default_aim_kind IN ('follow_path', 'look_at_point')),
	CONSTRAINT ck_camera_tracks_default_aim_direction CHECK (default_aim_direction IN ('forward', 'backward'))
);
CREATE TABLE depth_of_field_keyframes (
	id TEXT NOT NULL,
	path_position FLOAT NOT NULL,
	focus_kind VARCHAR(17) NOT NULL,
	focus_scene_point_id TEXT,
	focus_range_scale FLOAT NOT NULL,
	bokeh_scale FLOAT NOT NULL,
	project_id TEXT NOT NULL,
	PRIMARY KEY (id, project_id),
	CONSTRAINT fk_dof_scene_point FOREIGN KEY(project_id, focus_scene_point_id) REFERENCES scene_points (project_id, id) DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT ck_dof_focus CHECK ((focus_kind = 'center_weighted_9' AND focus_scene_point_id IS NULL) OR (focus_kind = 'scene_point' AND focus_scene_point_id IS NOT NULL)),
	CONSTRAINT ck_depth_of_field_keyframes_focus_kind CHECK (focus_kind IN ('center_weighted_9', 'scene_point')),
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_depth_of_field_keyframes_project_id ON depth_of_field_keyframes (project_id);
CREATE TABLE segment_anchors (
	segment_id TEXT NOT NULL,
	position INTEGER NOT NULL,
	anchor_id TEXT NOT NULL,
	PRIMARY KEY (segment_id, position),
	FOREIGN KEY(segment_id) REFERENCES trajectory_segments (id) ON DELETE CASCADE,
	FOREIGN KEY(anchor_id) REFERENCES anchors (id) ON DELETE RESTRICT
);
CREATE INDEX ix_segment_anchors_anchor_id ON segment_anchors (anchor_id);
