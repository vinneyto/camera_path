//! Numerical port of the minimum-jerk planner, adaptive quintic approximation and spiral compiler.
use crate::{Error, Result, models::*};
use nalgebra::{DMatrix, DVector, Vector3};
use serde_json::{Value, json};
use std::f64::consts::PI;
type V = Vector3<f64>;
fn v(a: Vec3) -> V {
    V::from(a)
}
fn a(v: V) -> Vec3 {
    v.into()
}
fn geometry(message: impl Into<String>) -> Error {
    Error::new(422, "invalid_geometry", message)
}
fn position(anchor: &Anchor) -> V {
    let axis = match anchor.lift_axis {
        LiftAxis::WorldUp => V::y(),
        LiftAxis::SurfaceNormal => v(anchor.surface_normal).normalize(),
    };
    v(anchor.surface_position) + anchor.lift * axis
}
pub fn validate(p: &Project) -> Result<Vec<String>> {
    let mut warnings = vec![];
    if p.name.is_empty() || p.name.chars().count() > 128 {
        return Err(Error::invalid(
            "Project name must contain 1 to 128 characters",
        ));
    }
    for anchor in p.anchors.values() {
        if anchor.label.is_empty()
            || anchor.label.chars().count() > 64
            || v(anchor.surface_normal).norm_squared() < 1e-16
        {
            return Err(Error::invalid("Invalid anchor label or normal"));
        }
        if anchor
            .surface_position
            .iter()
            .chain(anchor.surface_normal.iter())
            .chain([&anchor.lift])
            .any(|f| !f.is_finite())
        {
            return Err(Error::invalid("Anchor coordinates must be finite"));
        }
    }
    for point in p.scene_points.values() {
        if point.label.is_empty()
            || point.label.chars().count() > 64
            || point.position.iter().any(|f| !f.is_finite())
        {
            return Err(Error::invalid("Invalid scene point"));
        }
    }
    for segment in &p.segments {
        if segment
            .anchors()
            .iter()
            .any(|id| !p.anchors.contains_key(*id))
        {
            return Err(geometry(format!(
                "segment {} references missing anchors",
                segment.id()
            )));
        }
        match segment {
            Segment::Spline {
                id,
                anchor_ids,
                tension,
            } => {
                if anchor_ids.len() < 2 || !tension.is_finite() || !(0.0..=1.0).contains(tension) {
                    return Err(Error::invalid("Invalid spline"));
                }
                if *tension != 0.0 {
                    warnings.push(format!(
                        "spline {id} tension is ignored by the minimum-jerk planner"
                    ));
                }
            }
            Segment::Spiral { turns, .. } => {
                if !turns.is_finite() || *turns <= 0.0 || *turns > 100.0 {
                    return Err(Error::invalid("Invalid spiral turns"));
                }
            }
        }
    }
    for pair in p.segments.windows(2) {
        if pair[0].end() != pair[1].start() {
            warnings.push(format!(
                "segments {} and {} are not C0-connected",
                pair[0].id(),
                pair[1].id()
            ));
        } else if matches!(pair[0], Segment::Spiral { .. })
            && matches!(pair[1], Segment::Spiral { .. })
        {
            let incoming = spiral(p, &pair[0])?.evaluate(1.0).1;
            let outgoing = spiral(p, &pair[1])?.evaluate(0.0).1;
            let denom = incoming.norm() * outgoing.norm();
            if denom == 0.0 || incoming.dot(&outgoing) / denom < 1.0 - 1e-10 {
                warnings.push(format!(
                    "spirals {} and {} have incompatible analytic tangents",
                    pair[0].id(),
                    pair[1].id()
                ));
            }
        }
    }
    if p.motion_profile.default_speed <= 0.0 || !p.motion_profile.default_speed.is_finite() {
        return Err(Error::invalid("Speed must be positive"));
    }
    fn unique_positions(values: impl Iterator<Item = f64>) -> Result<()> {
        let mut values = values.collect::<Vec<_>>();
        if values
            .iter()
            .any(|x| !x.is_finite() || !(0.0..=1.0).contains(x))
        {
            return Err(Error::invalid("path_position must be between zero and one"));
        }
        values.sort_by(f64::total_cmp);
        if values.windows(2).any(|p| p[0] == p[1]) {
            return Err(geometry("keyframes must have unique path positions"));
        }
        Ok(())
    }
    unique_positions(p.motion_profile.keyframes.values().map(|k| k.path_position))?;
    unique_positions(p.camera_track.keyframes.values().map(|k| k.path_position))?;
    unique_positions(
        p.camera_track
            .orientation_keyframes
            .values()
            .map(|k| k.path_position),
    )?;
    unique_positions(
        p.camera_track
            .depth_of_field_keyframes
            .values()
            .map(|k| k.path_position),
    )?;
    for k in p.motion_profile.keyframes.values() {
        if k.speed <= 0.0 || !k.speed.is_finite() {
            return Err(Error::invalid("Speed must be positive"));
        }
    }
    for aim in std::iter::once(&p.camera_track.default_aim)
        .chain(p.camera_track.keyframes.values().map(|k| &k.aim))
    {
        if let Aim::LookAtPoint { scene_point_id } = aim
            && !p.scene_points.contains_key(scene_point_id)
        {
            return Err(geometry("camera track references missing scene points"));
        }
    }
    for k in p.camera_track.depth_of_field_keyframes.values() {
        if k.focus_range_scale <= 0.0 || k.bokeh_scale < 0.0 {
            return Err(Error::invalid("Invalid depth of field settings"));
        }
        if let Focus::ScenePoint { scene_point_id } = &k.focus
            && !p.scene_points.contains_key(scene_point_id)
        {
            return Err(geometry("camera track references missing scene points"));
        }
    }
    for o in std::iter::once(&p.camera_track.default_orientation).chain(
        p.camera_track
            .orientation_keyframes
            .values()
            .map(|k| &k.orientation),
    ) {
        if [o.yaw_deg, o.pitch_deg, o.roll_deg]
            .iter()
            .any(|x| !x.is_finite())
        {
            return Err(Error::invalid("Orientation must be finite"));
        }
    }
    if v(p.camera_track.world_up).norm() < 1e-8 {
        return Err(geometry("camera world_up must be non-zero"));
    }
    if let Some(k) = &p.camera_track.lidar_keyframe
        && (k.path_position != 0.0
            || k.vertical_fov_deg <= 0.0
            || k.vertical_fov_deg >= 180.0
            || !(1..=4096).contains(&k.horizontal_resolution)
            || !(1..=256).contains(&k.vertical_resolution))
    {
        return Err(Error::invalid("Invalid LiDAR settings"));
    }
    Ok(warnings)
}
struct Quintic {
    c: [V; 6],
    start: V,
    end: V,
}
impl Quintic {
    fn eval(&self, u: f64, d: usize) -> V {
        if d == 0 && u == 0.0 {
            return self.start;
        }
        if d == 0 && u == 1.0 {
            return self.end;
        }
        let mut value = V::zeros();
        for n in d..6 {
            let factor = (0..d).fold(1.0, |x, j| x * (n - j) as f64);
            value += self.c[n] * factor * u.powi((n - d) as i32);
        }
        value
    }
}
fn normals(t: V) -> [V; 2] {
    let unit = t.normalize();
    let mut axis = V::zeros();
    let i = (0..3)
        .min_by(|i, j| unit[*i].abs().total_cmp(&unit[*j].abs()))
        .unwrap();
    axis[i] = 1.0;
    let first = unit.cross(&axis).normalize();
    [first, unit.cross(&first)]
}
fn plan(points: &[V], start_tangent: Option<V>, end_tangent: Option<V>) -> Result<Vec<Quintic>> {
    if points.len() < 2 {
        return Err(geometry("minimum-jerk requires at least two anchors"));
    }
    let chords = points
        .windows(2)
        .map(|p| (p[1] - p[0]).norm())
        .collect::<Vec<_>>();
    if chords.iter().any(|d| *d < 1e-10) {
        return Err(geometry("minimum-jerk anchors must be distinct"));
    }
    let weights = chords.iter().map(|d| d.sqrt()).collect::<Vec<_>>();
    let sum = weights.iter().sum::<f64>();
    let durations = weights
        .iter()
        .map(|d| d * weights.len() as f64 / sum)
        .collect::<Vec<_>>();
    let count = points.len() * 6;
    let gram = DMatrix::from_row_slice(
        6,
        6,
        &[
            0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
            36., 72., 120., 0., 0., 0., 72., 192., 360., 0., 0., 0., 120., 360., 720.,
        ],
    );
    let mut hessian = DMatrix::zeros(count, count);
    let mut gradient = DVector::zeros(count);
    let mut maps = vec![];
    for (k, h) in durations.iter().copied().enumerate() {
        let mut dimensions = vec![];
        for (d, _) in points[k].iter().enumerate() {
            let mut map = DMatrix::zeros(6, count);
            let mut offset = DVector::zeros(6);
            let delta = points[k + 1][d] - points[k][d];
            let (vi, vj, ai, aj) = (
                k * 6 + d,
                (k + 1) * 6 + d,
                k * 6 + 3 + d,
                (k + 1) * 6 + 3 + d,
            );
            let h2 = h * h;
            offset[0] = points[k][d];
            map[(1, vi)] = h;
            map[(2, ai)] = 0.5 * h2;
            offset[3] = 10. * delta;
            map[(3, vi)] = -6. * h;
            map[(3, vj)] = -4. * h;
            map[(3, ai)] = -1.5 * h2;
            map[(3, aj)] = 0.5 * h2;
            offset[4] = -15. * delta;
            map[(4, vi)] = 8. * h;
            map[(4, vj)] = 7. * h;
            map[(4, ai)] = 1.5 * h2;
            map[(4, aj)] = -h2;
            offset[5] = 6. * delta;
            map[(5, vi)] = -3. * h;
            map[(5, vj)] = -3. * h;
            map[(5, ai)] = -0.5 * h2;
            map[(5, aj)] = 0.5 * h2;
            hessian += h.powi(-5) * map.transpose() * &gram * &map;
            gradient += h.powi(-5) * map.transpose() * &gram * &offset;
            dimensions.push((map, offset));
        }
        maps.push(dimensions);
    }
    let mut constraints = vec![];
    let mut targets = vec![];
    for d in 0..3 {
        for (weights, k) in [
            ([0., 0., 0., 6., 0., 0.], 0),
            ([0., 0., 0., 0., 24., 0.], 0),
            ([0., 0., 0., 6., 24., 60.], maps.len() - 1),
            ([0., 0., 0., 0., 24., 120.], maps.len() - 1),
        ] {
            let weights = DVector::from_row_slice(&weights);
            constraints.push(maps[k][d].0.transpose() * &weights);
            targets.push(-weights.dot(&maps[k][d].1));
        }
    }
    for (k, tangent) in [(0, start_tangent), (points.len() - 1, end_tangent)] {
        if let Some(t) = tangent {
            if t.norm() < 1e-12 {
                return Err(geometry("tangent constraints must be non-zero"));
            }
            for normal in normals(t) {
                let mut row = DVector::zeros(count);
                for d in 0..3 {
                    row[k * 6 + d] = normal[d];
                }
                constraints.push(row);
                targets.push(0.0);
            }
        }
    }
    let solve = |constraints: &Vec<DVector<f64>>, targets: &Vec<f64>| -> Result<DVector<f64>> {
        let m = constraints.len();
        let mut system = DMatrix::zeros(count + m, count + m);
        system.view_mut((0, 0), (count, count)).copy_from(&hessian);
        let mut rhs = DVector::zeros(count + m);
        rhs.rows_mut(0, count).copy_from(&(-&gradient));
        for (i, row) in constraints.iter().enumerate() {
            for j in 0..count {
                system[(j, count + i)] = row[j];
                system[(count + i, j)] = row[j];
            }
            rhs[count + i] = targets[i];
        }
        let svd = system.svd(true, true);
        let epsilon = svd.singular_values.max() * 1e-12;
        svd.solve(&rhs, epsilon)
            .map(|x| x.rows(0, count).into_owned())
            .map_err(|_| geometry("minimum-jerk linear solve failed"))
    };
    let mut solution = solve(&constraints, &targets)?;
    let mut extra = false;
    for (k, tangent) in [(0, start_tangent), (points.len() - 1, end_tangent)] {
        if let Some(t) = tangent {
            let unit = t.normalize();
            let velocity = V::new(solution[k * 6], solution[k * 6 + 1], solution[k * 6 + 2]);
            if velocity.dot(&unit) <= 1e-9 {
                let mut row = DVector::zeros(count);
                for d in 0..3 {
                    row[k * 6 + d] = unit[d];
                }
                constraints.push(row);
                targets.push(chords.iter().sum::<f64>() / durations.len() as f64);
                extra = true;
            }
        }
    }
    if extra {
        solution = solve(&constraints, &targets)?;
    }
    Ok(maps
        .iter()
        .enumerate()
        .map(|(i, dims)| {
            let coords = dims
                .iter()
                .map(|(m, o)| m * &solution + o)
                .collect::<Vec<_>>();
            Quintic {
                c: std::array::from_fn(|n| V::new(coords[0][n], coords[1][n], coords[2][n])),
                start: points[i],
                end: points[i + 1],
            }
        })
        .collect())
}
fn split(p: [V; 4]) -> ([V; 4], [V; 4]) {
    let p01 = (p[0] + p[1]) * 0.5;
    let p12 = (p[1] + p[2]) * 0.5;
    let p23 = (p[2] + p[3]) * 0.5;
    let p012 = (p01 + p12) * 0.5;
    let p123 = (p12 + p23) * 0.5;
    let middle = (p012 + p123) * 0.5;
    ([p[0], p01, p012, middle], [middle, p123, p23, p[3]])
}
fn samples(points: [V; 4], tolerance: f64) -> Vec<(f64, f64)> {
    fn visit(
        p: [V; 4],
        t0: f64,
        t1: f64,
        depth: u32,
        tol: f64,
        distance: &mut f64,
        out: &mut Vec<(f64, f64)>,
    ) {
        let chord = (p[3] - p[0]).norm();
        let polygon = p.windows(2).map(|x| (x[1] - x[0]).norm()).sum::<f64>();
        if polygon - chord <= 2.0 * tol || depth >= 20 {
            *distance += (polygon + chord) * 0.5;
            out.push((t1, *distance));
        } else {
            let (left, right) = split(p);
            let mid = (t0 + t1) * 0.5;
            visit(left, t0, mid, depth + 1, tol, distance, out);
            visit(right, mid, t1, depth + 1, tol, distance, out);
        }
    }
    let mut out = vec![(0.0, 0.0)];
    visit(points, 0.0, 1.0, 0, tolerance, &mut 0.0, &mut out);
    out
}
fn cubic(id: &str, points: [V; 4], tolerance: f64) -> Cubic {
    Cubic {
        source_segment_id: id.into(),
        p0: a(points[0]),
        p1: a(points[1]),
        p2: a(points[2]),
        p3: a(points[3]),
        length: samples(points, tolerance).last().unwrap().1,
    }
}
fn bezier(p: [V; 4], t: f64) -> V {
    let u = 1. - t;
    p[0] * u.powi(3) + p[1] * 3. * u * u * t + p[2] * 3. * u * t * t + p[3] * t.powi(3)
}
fn approximate(piece: &Quintic, id: &str, tol: f64, out: &mut Vec<Cubic>) -> Result<()> {
    fn visit(
        piece: &Quintic,
        id: &str,
        u0: f64,
        u1: f64,
        tol: f64,
        depth: u32,
        out: &mut Vec<Cubic>,
    ) -> Result<()> {
        let width = u1 - u0;
        let p0 = piece.eval(u0, 0);
        let p3 = piece.eval(u1, 0);
        let p = [
            p0,
            p0 + piece.eval(u0, 1) * width / 3.,
            p3 - piece.eval(u1, 1) * width / 3.,
            p3,
        ];
        let deviation = (1..16)
            .map(|n| {
                let t = n as f64 / 16.;
                (piece.eval(u0 + width * t, 0) - bezier(p, t)).norm()
            })
            .fold(0.0, f64::max);
        if deviation <= tol {
            out.push(cubic(id, p, tol));
            Ok(())
        } else if depth >= 20 {
            Err(geometry(
                "quintic approximation did not converge within max_depth",
            ))
        } else {
            let middle = (u0 + u1) * 0.5;
            visit(piece, id, u0, middle, tol, depth + 1, out)?;
            visit(piece, id, middle, u1, tol, depth + 1, out)
        }
    }
    visit(piece, id, 0.0, 1.0, tol, 0, out)
}
struct Spiral {
    center: V,
    e1: V,
    e2: V,
    start_radius: f64,
    end_radius: f64,
    start_height: f64,
    end_height: f64,
    total_angle: f64,
    radial: CurveLaw,
    axial: CurveLaw,
    start: V,
    end: V,
}
fn law(law: CurveLaw, t: f64) -> (f64, f64) {
    match law {
        CurveLaw::Linear => (t, 1.0),
        CurveLaw::Smoothstep => (t * t * (3. - 2. * t), 6. * t * (1. - t)),
    }
}
impl Spiral {
    fn evaluate(&self, t: f64) -> (V, V) {
        let (r, dr) = law(self.radial, t);
        let (h, dh) = law(self.axial, t);
        let radius = self.start_radius + (self.end_radius - self.start_radius) * r;
        let radius_d = (self.end_radius - self.start_radius) * dr;
        let height = self.start_height + (self.end_height - self.start_height) * h;
        let height_d = (self.end_height - self.start_height) * dh;
        let angle = self.total_angle * t;
        let radial = angle.cos() * self.e1 + angle.sin() * self.e2;
        let tangent = -angle.sin() * self.e1 + angle.cos() * self.e2;
        (
            self.center + height * V::y() + radius * radial,
            height_d * V::y() + radius_d * radial + radius * self.total_angle * tangent,
        )
    }
}
fn spiral(p: &Project, s: &Segment) -> Result<Spiral> {
    let Segment::Spiral {
        start_anchor_id,
        center_anchor_id,
        end_anchor_id,
        turns,
        direction,
        radial_law,
        axial_law,
        ..
    } = s
    else {
        return Err(geometry("Expected spiral"));
    };
    let start = position(&p.anchors[start_anchor_id]);
    let center = position(&p.anchors[center_anchor_id]);
    let end = position(&p.anchors[end_anchor_id]);
    let start_flat = start - center - (start - center).y * V::y();
    let end_flat = end - center - (end - center).y * V::y();
    let start_radius = start_flat.norm();
    let end_radius = end_flat.norm();
    if start_radius < 1e-8 {
        return Err(geometry("spiral start must not lie on its axis"));
    }
    let e1 = start_flat / start_radius;
    let e2 = V::y().cross(&e1);
    let direction = if *direction == Direction::Ccw {
        1.0
    } else {
        -1.0
    };
    let nominal = direction * 2. * PI * turns;
    let total_angle = if end_radius < 1e-8 {
        nominal
    } else {
        let angle = end_flat.dot(&e2).atan2(end_flat.dot(&e1));
        let revolutions = ((nominal - angle) / (2. * PI)).round_ties_even();
        let mut total = angle + 2. * PI * revolutions;
        if direction * total <= 0.0 {
            total += direction * 2. * PI;
        }
        total
    };
    Ok(Spiral {
        center,
        e1,
        e2,
        start_radius,
        end_radius,
        start_height: (start - center).y,
        end_height: (end - center).y,
        total_angle,
        radial: *radial_law,
        axial: *axial_law,
        start,
        end,
    })
}
fn positions(p: &Project, tol: f64) -> Result<Vec<Cubic>> {
    let mut out = vec![];
    let mut index = 0;
    while index < p.segments.len() {
        let s = &p.segments[index];
        if matches!(s, Segment::Spiral { .. }) {
            let sp = spiral(p, s)?;
            let count = (sp.total_angle.abs() / (PI / 4.)).ceil().max(1.) as usize;
            for i in 0..count {
                let t0 = i as f64 / count as f64;
                let t1 = (i + 1) as f64 / count as f64;
                let (mut p0, d0) = sp.evaluate(t0);
                let (mut p3, d1) = sp.evaluate(t1);
                if i == 0 {
                    p0 = sp.start;
                }
                if i == count - 1 {
                    p3 = sp.end;
                }
                let dt = t1 - t0;
                out.push(cubic(
                    s.id(),
                    [p0, p0 + d0 * dt / 3., p3 - d1 * dt / 3., p3],
                    tol,
                ));
            }
            index += 1;
            continue;
        }
        let mut ids = s
            .anchors()
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>();
        let mut sources = vec![s.id(); ids.len() - 1];
        let mut end = index + 1;
        while end < p.segments.len() {
            let next = &p.segments[end];
            if !matches!(next, Segment::Spline { .. }) || p.segments[end - 1].end() != next.start()
            {
                break;
            }
            let more = next.anchors();
            sources.extend(vec![next.id(); more.len() - 1]);
            ids.extend(more[1..].iter().map(|s| s.to_string()));
            end += 1;
        }
        let points = ids
            .iter()
            .map(|id| position(&p.anchors[id]))
            .collect::<Vec<_>>();
        let start_tangent = if index > 0
            && matches!(p.segments[index - 1], Segment::Spiral { .. })
            && p.segments[index - 1].end() == ids[0]
        {
            Some(spiral(p, &p.segments[index - 1])?.evaluate(1.0).1)
        } else {
            None
        };
        let end_tangent = if end < p.segments.len()
            && matches!(p.segments[end], Segment::Spiral { .. })
            && p.segments[end].start() == ids.last().unwrap()
        {
            Some(spiral(p, &p.segments[end])?.evaluate(0.0).1)
        } else {
            None
        };
        for (piece, id) in plan(&points, start_tangent, end_tangent)?
            .iter()
            .zip(sources)
        {
            approximate(piece, id, tol, &mut out)?;
        }
        index = end;
    }
    Ok(out)
}
fn duration(p: &Project, length: f64) -> f64 {
    if length == 0.0 {
        return 0.0;
    }
    let mut keys = p
        .motion_profile
        .keyframes
        .values()
        .map(|k| (k.path_position, k.speed, k.interpolation_to_next))
        .collect::<Vec<_>>();
    keys.sort_by(|a, b| a.0.total_cmp(&b.0));
    if keys.is_empty() || keys[0].0 > 0.0 {
        keys.insert(
            0,
            (
                0.0,
                p.motion_profile.default_speed,
                Interpolation::Smoothstep,
            ),
        );
    }
    if keys.last().unwrap().0 < 1.0 {
        keys.push((
            1.0,
            p.motion_profile.default_speed,
            Interpolation::Smoothstep,
        ));
    }
    // Gauss-Legendre 16-point quadrature, matching numpy.polynomial.legendre.leggauss(16).
    let nodes = [
        0.09501250983763744,
        0.2816035507792589,
        0.4580167776572274,
        0.6178762444026438,
        0.755404408355003,
        0.8656312023878318,
        0.9445750230732326,
        0.9894009349916499,
    ];
    let weights = [
        0.1894506104550685,
        0.1826034150449236,
        0.16915651939500254,
        0.14959598881657673,
        0.12462897125553387,
        0.09515851168249278,
        0.062253523938647894,
        0.027152459411754095,
    ];
    let mut time = 0.0;
    for pair in keys.windows(2) {
        let (start, speed, interp) = pair[0];
        let (end, next, _) = pair[1];
        let width = end - start;
        if width <= 0.0 {
            continue;
        }
        for (node, weight) in nodes.iter().zip(weights) {
            for sign in [-1., 1.] {
                let t = (sign * node + 1.) * 0.5;
                let blend = match interp {
                    Interpolation::Hold => 0.0,
                    Interpolation::Linear => t,
                    Interpolation::Smoothstep => t * t * (3. - 2. * t),
                };
                time += width * 0.5 * weight / (speed + (next - speed) * blend);
            }
        }
    }
    length * time
}
fn resolve_aim(p: &Project, aim: &Aim) -> Value {
    let mut value = json!(aim);
    if let Aim::LookAtPoint { scene_point_id } = aim {
        value["position"] = json!(p.scene_points[scene_point_id].position);
    }
    value
}
pub fn compile(p: &Project, tolerance: f64) -> Result<Compiled> {
    if tolerance <= 0.0 || !tolerance.is_finite() {
        return Err(Error::invalid("tolerance must be positive"));
    }
    let warnings = validate(p)?;
    let curves = positions(p, tolerance)?;
    let mut table = vec![];
    let mut distance = 0.0;
    for (index, c) in curves.iter().enumerate() {
        for (t, d) in samples([v(c.p0), v(c.p1), v(c.p2), v(c.p3)], tolerance) {
            if !table.is_empty() && t == 0.0 {
                continue;
            }
            table.push(ArcSample {
                segment_index: index,
                t,
                distance: distance + d,
            });
        }
        distance += c.length;
    }
    let mut speeds = p.motion_profile.keyframes.values().collect::<Vec<_>>();
    speeds.sort_by(|a, b| a.path_position.total_cmp(&b.path_position));
    let mut aims = p.camera_track.keyframes.values().collect::<Vec<_>>();
    aims.sort_by(|a, b| a.path_position.total_cmp(&b.path_position));
    let mut orientations = p
        .camera_track
        .orientation_keyframes
        .values()
        .collect::<Vec<_>>();
    orientations.sort_by(|a, b| a.path_position.total_cmp(&b.path_position));
    let mut dofs = p
        .camera_track
        .depth_of_field_keyframes
        .values()
        .collect::<Vec<_>>();
    dofs.sort_by(|a, b| a.path_position.total_cmp(&b.path_position));
    Ok(Compiled {
        project_id: p.id.clone(),
        revision: p.revision,
        position_segments: curves,
        arc_length_table: table,
        total_length: distance,
        duration_seconds: duration(p, distance),
        motion_profile: json!({"default_speed":p.motion_profile.default_speed,"keyframes":speeds}),
        camera_track: json!({"default_aim":resolve_aim(p,&p.camera_track.default_aim),"keyframes":aims.iter().map(|k|json!({"id":k.id,"path_position":k.path_position,"aim":resolve_aim(p,&k.aim),"interpolation_to_next":k.interpolation_to_next})).collect::<Vec<_>>(),"default_orientation":p.camera_track.default_orientation,"orientation_keyframes":orientations,"depth_of_field_keyframes":dofs.iter().map(|k|{let mut value=json!(k);if let Focus::ScenePoint{scene_point_id}=&k.focus {value["focus"]["position"]=json!(p.scene_points[scene_point_id].position);}value}).collect::<Vec<_>>(),"world_up":p.camera_track.world_up}),
        warnings,
    })
}
