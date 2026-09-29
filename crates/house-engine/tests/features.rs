//! Features added for the studio: new sounds, seeking by step, the
//! non-destructive sample cut, per-note lengths, automation curves, insert
//! effects and 32 tracks. Each test renders audio and checks what a listener
//! would notice.

use house_engine::automation::{master_param, target, track_param};
use house_engine::command::{master, mix, op};
use house_engine::inserts::fx_kind;
use house_engine::*;

const SR: f32 = 48_000.0;

fn cmd(e: &mut Engine, a: &[f64]) {
    e.apply(decode(a).expect("valid command"));
}

fn render(e: &mut Engine, seconds: f32) -> (Vec<f32>, Vec<f32>) {
    let n = (seconds * SR) as usize;
    let mut l = vec![0.0; n];
    let mut r = vec![0.0; n];
    e.render(&mut l, &mut r);
    (l, r)
}

fn rms(x: &[f32]) -> f32 {
    (x.iter().map(|v| v * v).sum::<f32>() / x.len().max(1) as f32).sqrt()
}

fn kind(e: &mut Engine, track: u8, k: u8, model: u8) {
    cmd(
        e,
        &[
            op::SET_TRACK_KIND as f64,
            track as f64,
            k as f64,
            model as f64,
        ],
    );
}

/// A step with up to four notes and optional per-note lengths.
fn step(e: &mut Engine, track: u8, at: usize, len: u8, notes: &[i32], lens: &[u8]) {
    let mut a = vec![
        op::SET_STEP as f64,
        track as f64,
        at as f64,
        1.0,
        0.9,
        len as f64,
        0.0,
        0.0,
    ];
    for k in 0..4 {
        a.push(*notes.get(k).unwrap_or(&-1) as f64);
    }
    for k in 0..4 {
        a.push(*lens.get(k).unwrap_or(&0) as f64);
    }
    cmd(e, &a);
}

fn song(e: &mut Engine, bars: u8, mask: u32) {
    cmd(e, &[op::SET_SECTION_COUNT as f64, 1.0]);
    cmd(
        e,
        &[op::SET_SECTION as f64, 0.0, bars as f64, mask as f64, 1.0],
    );
    cmd(e, &[op::SET_MODE as f64, 1.0]);
}

fn lane(e: &mut Engine, lane: u8, tgt: u8, track: u8, param: u8, points: &[(f32, f32, f32)]) {
    cmd(
        e,
        &[
            op::AUTO_LANE as f64,
            lane as f64,
            tgt as f64,
            track as f64,
            param as f64,
            points.len() as f64,
        ],
    );
    for (i, &(pos, value, tension)) in points.iter().enumerate() {
        cmd(
            e,
            &[
                op::AUTO_POINT as f64,
                lane as f64,
                i as f64,
                pos as f64,
                value as f64,
                tension as f64,
            ],
        );
    }
}

#[test]
fn every_new_sound_makes_sound() {
    let mut cases: Vec<(u8, u8, f32)> = (14..=25).map(|m| (kind::DRUM, m, 0.0)).collect();
    cases.extend([
        (kind::FM, 0, 0.0),
        (kind::SUPER, 0, 0.0),
        (kind::PLUCK, 0, 0.0),
    ]);
    for (k, model, _) in cases {
        let mut e = Engine::new(SR);
        cmd(&mut e, &[op::SET_BPM as f64, 120.0]);
        kind(&mut e, 0, k, model);
        step(&mut e, 0, 0, 4, &[57, 60, 64], &[]);
        cmd(&mut e, &[op::PLAY as f64]);
        // Long effects (downlifter, reverse cymbal) need a few beats.
        let (l, r) = render(&mut e, 2.2);
        assert!(
            l.iter().chain(&r).all(|v| v.is_finite()),
            "kind {k} model {model} made NaN"
        );
        assert!(
            rms(&l) > 0.002,
            "kind {k} model {model} is silent ({})",
            rms(&l)
        );
        assert!(
            l.iter().all(|v| v.abs() <= 1.0),
            "kind {k} model {model} clips past the limiter"
        );
    }
}

#[test]
fn chords_play_on_the_new_synths() {
    for k in [kind::FM, kind::SUPER, kind::PLUCK] {
        let mut single = Engine::new(SR);
        kind(&mut single, 0, k, 0);
        step(&mut single, 0, 0, 8, &[60], &[]);
        cmd(&mut single, &[op::PLAY as f64]);
        let (a, _) = render(&mut single, 0.5);
        let mut chord = Engine::new(SR);
        kind(&mut chord, 0, k, 0);
        step(&mut chord, 0, 0, 8, &[60, 64, 67], &[]);
        cmd(&mut chord, &[op::PLAY as f64]);
        let (b, _) = render(&mut chord, 0.5);
        assert!(
            rms(&b) > rms(&a) * 1.2,
            "kind {k}: a chord should sound fuller"
        );
    }
}

#[test]
fn seek_moves_the_playhead_by_step_even_when_stopped() {
    let mut e = Engine::new(SR);
    kind(&mut e, 0, kind::DRUM, 0);
    cmd(&mut e, &[op::SEEK as f64, 2.0, 5.0]);
    render(&mut e, 0.01);
    assert_eq!(
        e.status[st::STEP],
        (2 * 16 + 5) as f32,
        "stopped, the status shows the new place"
    );
    assert_eq!(e.status[st::PLAYING], 0.0);
    cmd(&mut e, &[op::PLAY as f64]);
    render(&mut e, 0.01);
    assert_eq!(
        e.status[st::STEP],
        (2 * 16 + 5) as f32,
        "playing starts from there"
    );
}

/// Half a second of a 200 Hz tone, then half a second of silence.
fn tone_then_silence() -> Box<[f32]> {
    (0..48_000)
        .map(|i| {
            if i < 24_000 {
                (i as f32 * 200.0 / SR * core::f32::consts::TAU).sin() * 0.6
            } else {
                0.0
            }
        })
        .collect::<Vec<_>>()
        .into_boxed_slice()
}

fn sampler(e: &mut Engine, p: [f32; 8]) {
    kind(e, 0, kind::SAMPLER, 0);
    cmd(e, &[op::SET_SAMPLE_SLOT as f64, 0.0, 7.0]);
    for (i, v) in p.iter().enumerate() {
        cmd(e, &[op::SET_PARAM as f64, 0.0, i as f64, *v as f64]);
    }
}

#[test]
fn sample_cut_is_non_destructive_and_can_play_backwards() {
    // Whole sample: sound first.
    let mut e = Engine::new(SR);
    e.load_sample(7, tone_then_silence(), SR);
    sampler(&mut e, [0.5, 0.0, 0.6, 1.0, 0.0, 1.0, 0.0, 0.0]);
    cmd(&mut e, &[op::NOTE_ON as f64, 0.0, 60.0, 1.0]);
    let (l, _) = render(&mut e, 0.2);
    assert!(rms(&l) > 0.05, "the start of the sample sounds");

    // Cut to the silent half: nothing.
    let mut e = Engine::new(SR);
    e.load_sample(7, tone_then_silence(), SR);
    sampler(&mut e, [0.5, 0.0, 0.6, 1.0, 0.5, 1.0, 0.0, 0.0]);
    cmd(&mut e, &[op::NOTE_ON as f64, 0.0, 60.0, 1.0]);
    let (l, _) = render(&mut e, 0.2);
    assert!(
        rms(&l) < 0.002,
        "the cut plays only the chosen part ({})",
        rms(&l)
    );

    // Backwards over the whole sample: the silent end comes first.
    let mut e = Engine::new(SR);
    e.load_sample(7, tone_then_silence(), SR);
    sampler(&mut e, [0.5, 0.0, 0.6, 1.0, 0.0, 1.0, 0.0, 1.0]);
    cmd(&mut e, &[op::NOTE_ON as f64, 0.0, 60.0, 1.0]);
    let (l, _) = render(&mut e, 0.9);
    let first = rms(&l[..(0.3 * SR) as usize]);
    let later = rms(&l[(0.6 * SR) as usize..]);
    assert!(
        first < 0.002 && later > 0.05,
        "reversed: first {first}, later {later}"
    );

    // The same recording, two regions: the slot is untouched.
    let mut e = Engine::new(SR);
    e.load_sample(7, tone_then_silence(), SR);
    sampler(&mut e, [0.5, 0.0, 0.6, 1.0, 0.0, 0.4, 0.0, 0.0]);
    cmd(&mut e, &[op::NOTE_ON as f64, 0.0, 60.0, 1.0]);
    let (l, _) = render(&mut e, 0.6);
    assert!(rms(&l[..(0.1 * SR) as usize]) > 0.05);
    // The region ends at 40 % of the second (0.4 s), before the tone does (0.5 s).
    assert!(
        rms(&l[(0.41 * SR) as usize..]) < 0.001,
        "stops at the end of its region"
    );
}

#[test]
fn a_cut_never_clicks() {
    // A loud DC-ish buffer cut in the middle: the edges must fade.
    let mut e = Engine::new(SR);
    e.load_sample(7, vec![0.8f32; 48_000].into_boxed_slice(), SR);
    sampler(&mut e, [0.5, 0.0, 0.6, 1.0, 0.25, 0.5, 0.0, 0.0]);
    cmd(&mut e, &[op::NOTE_ON as f64, 0.0, 60.0, 1.0]);
    let (l, _) = render(&mut e, 0.4);
    let jump = l
        .windows(2)
        .map(|w| (w[1] - w[0]).abs())
        .fold(0.0f32, f32::max);
    assert!(jump < 0.05, "largest jump between samples {jump}");
}

#[test]
fn each_note_of_a_chord_can_last_its_own_length() {
    let tail = |lens: &[u8]| {
        let mut e = Engine::new(SR);
        cmd(&mut e, &[op::SET_BPM as f64, 120.0]);
        kind(&mut e, 0, kind::POLY, 0);
        // Short release so the end of each note is clear.
        cmd(&mut e, &[op::SET_PARAM as f64, 0.0, 2.0, 0.0]);
        cmd(&mut e, &[op::SET_PARAM as f64, 0.0, 7.0, 1.0]);
        cmd(&mut e, &[op::SET_LENGTH as f64, 0.0, 64.0]);
        step(&mut e, 0, 0, 2, &[60, 64], lens);
        cmd(&mut e, &[op::PLAY as f64]);
        let (l, _) = render(&mut e, 1.2);
        // At 120 BPM a step is 125 ms: look after both notes' first 2 steps.
        rms(&l[(0.5 * SR) as usize..(0.9 * SR) as usize])
    };
    let short = tail(&[2, 2]);
    let long = tail(&[2, 8]);
    assert!(
        long > short * 4.0 + 0.002,
        "the long note keeps sounding: {long} vs {short}"
    );
}

fn loud_loop(e: &mut Engine) {
    cmd(e, &[op::SET_BPM as f64, 120.0]);
    kind(e, 0, kind::SUPER, 0);
    cmd(e, &[op::SET_LENGTH as f64, 0.0, 16.0]);
    step(e, 0, 0, 16, &[57, 60, 64], &[]);
}

#[test]
fn automation_fades_the_master_in_song_mode_only() {
    let setup = |e: &mut Engine| {
        loud_loop(e);
        song(e, 4, u32::MAX);
        // From full volume to silence over the 4 bars (64 steps).
        lane(
            e,
            0,
            target::MASTER,
            0,
            master_param::VOLUME,
            &[(0.0, 1.0, 0.0), (64.0, 0.0, 0.0)],
        );
    };
    let mut e = Engine::new(SR);
    setup(&mut e);
    cmd(&mut e, &[op::PLAY as f64]);
    let (l, _) = render(&mut e, 8.0);
    let first = rms(&l[..(2.0 * SR) as usize]);
    let last = rms(&l[(6.2 * SR) as usize..(7.9 * SR) as usize]);
    assert!(
        first > 0.05 && last < first * 0.2,
        "fade: first bar {first}, last bar {last}"
    );

    // In loop mode the curves rest.
    let mut e = Engine::new(SR);
    setup(&mut e);
    cmd(&mut e, &[op::SET_MODE as f64, 0.0]);
    cmd(&mut e, &[op::PLAY as f64]);
    let (l, _) = render(&mut e, 8.0);
    let last = rms(&l[(6.2 * SR) as usize..(7.9 * SR) as usize]);
    assert!(
        last > first * 0.5,
        "loop mode ignores the curve ({last} vs {first})"
    );
}

#[test]
fn automation_opens_a_track_filter_through_the_build() {
    let highs = |filter_curve: bool| {
        let mut e = Engine::new(SR);
        cmd(&mut e, &[op::SET_BPM as f64, 120.0]);
        kind(&mut e, 0, kind::DRUM, 3); // closed hat: all highs
        for s in (0..16).step_by(2) {
            step(&mut e, 0, s, 1, &[], &[]);
        }
        song(&mut e, 4, u32::MAX);
        if filter_curve {
            // Low-pass almost closed for the whole song.
            lane(
                &mut e,
                0,
                target::TRACK,
                0,
                track_param::FILTER,
                &[(0.0, 0.05, 0.0), (64.0, 0.05, 0.0)],
            );
        }
        cmd(&mut e, &[op::PLAY as f64]);
        let (l, _) = render(&mut e, 2.0);
        rms(&l)
    };
    let open = highs(false);
    let closed = highs(true);
    assert!(closed < open * 0.3, "closed {closed} vs open {open}");
}

#[test]
fn master_filter_knob_darkens_the_mix() {
    let level = |v: f64| {
        let mut e = Engine::new(SR);
        kind(&mut e, 0, kind::DRUM, 3);
        for s in (0..16).step_by(2) {
            step(&mut e, 0, s, 1, &[], &[]);
        }
        cmd(&mut e, &[op::SET_MASTER as f64, master::FILTER as f64, v]);
        cmd(&mut e, &[op::PLAY as f64]);
        let (l, _) = render(&mut e, 1.5);
        rms(&l)
    };
    assert!(level(0.08) < level(0.5) * 0.3);
}

#[test]
fn every_insert_effect_is_stable_and_audible() {
    let dry = {
        let mut e = Engine::new(SR);
        loud_loop(&mut e);
        cmd(&mut e, &[op::PLAY as f64]);
        render(&mut e, 1.0).0
    };
    for fx in 1..fx_kind::COUNT {
        let mut e = Engine::new(SR);
        loud_loop(&mut e);
        cmd(&mut e, &[op::SET_FX as f64, 0.0, 0.0, fx as f64]);
        for (i, v) in [0.7, 0.7, 0.8].iter().enumerate() {
            cmd(&mut e, &[op::SET_FX_PARAM as f64, 0.0, 0.0, i as f64, *v]);
        }
        cmd(&mut e, &[op::PLAY as f64]);
        let (l, r) = render(&mut e, 1.0);
        assert!(
            l.iter().chain(&r).all(|v| v.is_finite()),
            "effect {fx} made NaN"
        );
        assert!(rms(&l) > 0.01, "effect {fx} silenced the track");
        let diff = rms(&l.iter().zip(&dry).map(|(a, b)| a - b).collect::<Vec<_>>());
        assert!(diff > 0.002, "effect {fx} changes nothing");
    }
}

#[test]
fn effects_in_both_slots_chain_and_can_be_removed() {
    let mut e = Engine::new(SR);
    loud_loop(&mut e);
    cmd(
        &mut e,
        &[op::SET_FX as f64, 0.0, 0.0, fx_kind::DISTORTION as f64],
    );
    cmd(
        &mut e,
        &[op::SET_FX as f64, 0.0, 1.0, fx_kind::CHORUS as f64],
    );
    cmd(&mut e, &[op::PLAY as f64]);
    let (l, r) = render(&mut e, 0.5);
    assert!(rms(&l) > 0.01 && l.iter().chain(&r).all(|v| v.is_finite()));
    // The chorus makes left and right different.
    let side = rms(&l.iter().zip(&r).map(|(a, b)| a - b).collect::<Vec<_>>());
    assert!(side > 0.001, "chorus widens: side {side}");
    cmd(&mut e, &[op::SET_FX as f64, 0.0, 1.0, 0.0]);
    cmd(&mut e, &[op::SET_FX as f64, 0.0, 0.0, 0.0]);
    let (l, r) = render(&mut e, 0.5);
    // Skip the master limiter's short look-ahead, which still holds the chorus.
    let from = (0.05 * SR) as usize;
    let side = rms(&l[from..]
        .iter()
        .zip(&r[from..])
        .map(|(a, b)| a - b)
        .collect::<Vec<_>>());
    assert!(
        side < 1e-4,
        "without effects the track is mono again ({side})"
    );
}

#[test]
fn thirty_two_tracks_play_and_report_their_hits() {
    let mut e = Engine::new(SR);
    kind(&mut e, 31, kind::DRUM, 0);
    step(&mut e, 31, 0, 1, &[], &[]);
    cmd(
        &mut e,
        &[op::SET_MIX as f64, 31.0, mix::VOLUME_DB as f64, 0.0],
    );
    cmd(&mut e, &[op::PLAY as f64]);
    let (l, _) = render(&mut e, 0.05);
    assert!(rms(&l) > 0.01, "track 32 sounds");
    assert_eq!(
        e.status[st::TRIGGERS_HI] as u32 & (1 << 15),
        1 << 15,
        "its hit is reported"
    );
    assert!(
        e.status[st::TRACK_PEAKS + 31] > 0.01,
        "its level is reported"
    );
    // Sections can switch it off like any other track.
    let mut e = Engine::new(SR);
    kind(&mut e, 31, kind::DRUM, 0);
    step(&mut e, 31, 0, 1, &[], &[]);
    song(&mut e, 1, 1 << 30);
    cmd(&mut e, &[op::PLAY as f64]);
    let (l, _) = render(&mut e, 0.3);
    assert!(rms(&l) < 1e-4, "muted by the section mask");
}

#[test]
fn realtime_budget_with_everything_on() {
    // 32 busy tracks with effects and automation: still far faster than real time.
    let mut e = Engine::new(SR);
    cmd(&mut e, &[op::SET_BPM as f64, 128.0]);
    for t in 0..32u8 {
        let k = [kind::SUPER, kind::FM, kind::PLUCK, kind::POLY, kind::DRUM][t as usize % 5];
        kind(&mut e, t, k, t % 12);
        for s in (0..16).step_by(2) {
            step(&mut e, t, s, 2, &[48 + (t as i32 % 12), 55, 60], &[]);
        }
        cmd(
            &mut e,
            &[op::SET_FX as f64, t as f64, 0.0, (1 + t % 11) as f64],
        );
        cmd(
            &mut e,
            &[op::SET_MIX as f64, t as f64, mix::VOLUME_DB as f64, -20.0],
        );
    }
    song(&mut e, 8, u32::MAX);
    lane(
        &mut e,
        0,
        target::MASTER,
        0,
        master_param::FILTER,
        &[(0.0, 0.1, 0.5), (128.0, 0.5, 0.0)],
    );
    cmd(&mut e, &[op::PLAY as f64]);
    let t0 = std::time::Instant::now();
    let (l, _) = render(&mut e, 10.0);
    let el = t0.elapsed().as_secs_f32();
    assert!(l.iter().all(|v| v.is_finite()));
    assert!(el < 10.0, "10 s of a full project took {el} s");
    eprintln!("32 pistas con efectos: 10 s de audio en {el:.2} s");
}
