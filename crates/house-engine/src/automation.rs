//! Automation: curves drawn on the song timeline that move a knob over time
//! (open a filter through the build, fade the outro, throw an echo).
//! Each lane has up to `MAX_POINTS` points; every segment has a tension that
//! bends it (0 straight, > 0 starts slow and rushes at the end, < 0 the opposite).

pub const MAX_LANES: usize = 16;
pub const MAX_POINTS: usize = 64;

/// What a lane moves.
pub mod target {
    pub const NONE: u8 = 0;
    pub const MASTER: u8 = 1;
    pub const TRACK: u8 = 2;
}

/// Master parameters a lane can move.
pub mod master_param {
    /// DJ filter, 0.5 = open.
    pub const FILTER: u8 = 0;
    /// 1 = as mixed, 0 = silence.
    pub const VOLUME: u8 = 1;
    /// Reverb return, 0.5 = as mixed, 1 = double.
    pub const REVERB: u8 = 2;
    /// Echo return, 0.5 = as mixed, 1 = double.
    pub const DELAY: u8 = 3;
}

/// Track parameters a lane can move.
pub mod track_param {
    pub const VOLUME: u8 = 0;
    pub const FILTER: u8 = 1;
    pub const PAN: u8 = 2;
    pub const SEND_REVERB: u8 = 3;
    pub const SEND_DELAY: u8 = 4;
    /// 8..15: the instrument's knobs p0..p7.
    pub const INST: u8 = 8;
    /// 16..21: the insert effects' knobs (slot * 3 + knob).
    pub const FX: u8 = 16;
}

#[derive(Clone, Copy, Default, Debug, PartialEq)]
pub struct Point {
    /// Song position in steps (sixteenths).
    pub pos: f32,
    /// 0..1.
    pub value: f32,
    /// -1..1, bends the segment that starts at this point.
    pub tension: f32,
}

#[derive(Clone, Copy)]
pub struct Lane {
    pub target: u8,
    pub track: u8,
    pub param: u8,
    pub count: usize,
    pub points: [Point; MAX_POINTS],
}

impl Default for Lane {
    fn default() -> Self {
        Lane {
            target: target::NONE,
            track: 0,
            param: 0,
            count: 0,
            points: [Point::default(); MAX_POINTS],
        }
    }
}

/// Bends 0..1 by a tension in -1..1.
#[inline]
pub fn shape(t: f32, tension: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    if tension.abs() < 0.001 {
        return t;
    }
    let k = tension.clamp(-1.0, 1.0) * 6.0;
    ((k * t).exp() - 1.0) / (k.exp() - 1.0)
}

impl Lane {
    pub fn is_on(&self) -> bool {
        self.target != target::NONE && self.count > 0
    }

    /// Value at a song position (steps). Before the first point the curve holds
    /// the first value; after the last, the last one.
    pub fn eval(&self, pos: f32) -> Option<f32> {
        if !self.is_on() {
            return None;
        }
        let pts = &self.points[..self.count.min(MAX_POINTS)];
        let first = pts[0];
        if pos <= first.pos {
            return Some(first.value);
        }
        for w in pts.windows(2) {
            let (a, b) = (w[0], w[1]);
            if pos < b.pos {
                let span = b.pos - a.pos;
                if span <= 0.0 {
                    return Some(b.value);
                }
                let t = shape((pos - a.pos) / span, a.tension);
                return Some(a.value + (b.value - a.value) * t);
            }
        }
        Some(pts[pts.len() - 1].value)
    }
}

/// Gain for a volume lane value: 1 = unity, 0.5 = -12 dB, 0 = silence.
#[inline]
pub fn volume_gain(v: f32) -> f32 {
    let v = v.clamp(0.0, 1.0);
    v * v
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lane(points: &[(f32, f32, f32)]) -> Lane {
        let mut l = Lane {
            target: target::MASTER,
            count: points.len(),
            ..Lane::default()
        };
        for (i, &(pos, value, tension)) in points.iter().enumerate() {
            l.points[i] = Point {
                pos,
                value,
                tension,
            };
        }
        l
    }

    #[test]
    fn straight_and_bent_segments() {
        let l = lane(&[(0.0, 0.0, 0.0), (16.0, 1.0, 0.0)]);
        assert_eq!(l.eval(-5.0), Some(0.0));
        assert!((l.eval(8.0).unwrap() - 0.5).abs() < 1e-6);
        assert_eq!(l.eval(40.0), Some(1.0));
        let slow = lane(&[(0.0, 0.0, 0.8), (16.0, 1.0, 0.0)]);
        let fast = lane(&[(0.0, 0.0, -0.8), (16.0, 1.0, 0.0)]);
        assert!(
            slow.eval(8.0).unwrap() < 0.2,
            "positive tension starts slow"
        );
        assert!(
            fast.eval(8.0).unwrap() > 0.8,
            "negative tension starts fast"
        );
        // The ends never move with tension.
        assert!((slow.eval(16.0).unwrap() - 1.0).abs() < 1e-6);
    }

    #[test]
    fn empty_lane_has_no_value() {
        assert_eq!(Lane::default().eval(3.0), None);
    }
}
