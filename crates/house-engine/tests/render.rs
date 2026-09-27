//! Renders real patterns offline and checks what a listener would notice:
//! timing, levels, silence where there should be silence, and the pumping.

use house_engine::command::{master, mix, op};
use house_engine::*;

const SR: f32 = 48_000.0;

fn cmd(e: &mut Engine, a: &[f64]) {
    e.apply(decode(a).expect("valid command"));
}

fn drum(e: &mut Engine, track: u8, model: u8, steps: &[usize]) {
    cmd(
        e,
        &[
            op::SET_TRACK_KIND as f64,
            track as f64,
            kind::DRUM as f64,
            model as f64,
        ],
    );
    for &s in steps {
        cmd(
            e,
            &[
                op::SET_STEP as f64,
                track as f64,
                s as f64,
                1.0,
                0.9,
                1.0,
                0.0,
                0.0,
                -1.0,
                -1.0,
                -1.0,
                -1.0,
            ],
        );
    }
}

fn note(e: &mut Engine, track: u8, step: usize, n: i32, slide: bool) {
    cmd(
        e,
        &[
            op::SET_STEP as f64,
            track as f64,
            step as f64,
            1.0,
            0.85,
            1.0,
            0.0,
            if slide { 1.0 } else { 0.0 },
            n as f64,
            -1.0,
            -1.0,
            -1.0,
        ],
    );
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

fn tech_house() -> Engine {
    let mut e = Engine::new(SR);
    cmd(&mut e, &[op::SET_BPM as f64, 126.0]);
    drum(&mut e, 0, 0, &[0, 4, 8, 12]); // kick
    drum(&mut e, 1, 2, &[4, 12]); // clap
    drum(&mut e, 2, 4, &[2, 6, 10, 14]); // open hat
    cmd(
        &mut e,
        &[op::SET_TRACK_KIND as f64, 3.0, kind::ACID as f64, 0.0],
    );
    for (s, n) in [
        (2, 45),
        (3, 45),
        (6, 48),
        (7, 45),
        (10, 43),
        (11, 45),
        (14, 52),
    ] {
        note(&mut e, 3, s, n, s == 3);
    }
    cmd(&mut e, &[op::SET_MIX as f64, 3.0, mix::DUCK as f64, 0.8]);
    cmd(&mut e, &[op::SET_SIDECHAIN as f64, 0.0]);
    e
}

#[test]
fn tech_house_pattern_sounds_and_stays_under_the_ceiling() {
    let mut e = tech_house();
    cmd(&mut e, &[op::PLAY as f64]);
    let (l, r) = render(&mut e, 4.0);
    assert!(
        l.iter().chain(r.iter()).all(|v| v.is_finite()),
        "no NaN or inf"
    );
    let peak = l.iter().chain(r.iter()).fold(0.0f32, |a, v| a.max(v.abs()));
    assert!(peak > 0.2, "audible, peak {peak}");
    assert!(peak <= 0.9, "limiter keeps it under -1 dBFS, peak {peak}");
    assert!(rms(&l) > 0.03, "has body, rms {}", rms(&l));
}

#[test]
fn kick_lands_on_every_beat() {
    let mut e = Engine::new(SR);
    cmd(&mut e, &[op::SET_BPM as f64, 120.0]);
    drum(&mut e, 0, 0, &[0, 4, 8, 12]);
    cmd(&mut e, &[op::SET_MASTER as f64, master::GLUE as f64, 0.0]);
    cmd(&mut e, &[op::PLAY as f64]);
    let (l, _) = render(&mut e, 2.0);
    let beat = (SR * 0.5) as usize; // 120 BPM
    let la = 64; // limiter look-ahead delay
    for b in 0..4 {
        let at = b * beat + la;
        let before = rms(&l[at.saturating_sub(400)..at.saturating_sub(100)]);
        let after = rms(&l[at + 50..at + 1500]);
        assert!(
            after > 0.05 && after > before * 4.0,
            "beat {b}: before {before} after {after}"
        );
    }
}

#[test]
fn swing_delays_the_off_beat_sixteenths() {
    let mut e = Engine::new(SR);
    cmd(&mut e, &[op::SET_BPM as f64, 120.0]);
    cmd(&mut e, &[op::SET_SWING as f64, 0.66]);
    drum(&mut e, 0, 5, &[1]); // rim on the second sixteenth
    cmd(&mut e, &[op::PLAY as f64]);
    let (l, _) = render(&mut e, 0.5);
    let base = SR as f64 * 60.0 / 120.0 / 4.0;
    let expected = (2.0 * 0.66 * base) as usize + 64;
    let first = l.iter().position(|v| v.abs() > 0.01).unwrap();
    assert!(
        (first as i64 - expected as i64).abs() < 8,
        "first hit at {first}, expected {expected}"
    );
}

#[test]
fn song_sections_mute_tracks_outside_their_mask() {
    let mut e = Engine::new(SR);
    cmd(&mut e, &[op::SET_BPM as f64, 120.0]);
    drum(&mut e, 0, 0, &[0, 4, 8, 12]);
    // Section 0: 1 bar with nothing; section 1: 1 bar with the kick.
    cmd(&mut e, &[op::SET_SECTION_COUNT as f64, 2.0]);
    cmd(
        &mut e,
        &[op::SET_SECTION as f64, 0.0, 1.0, 0.0, section::INTRO as f64],
    );
    cmd(
        &mut e,
        &[op::SET_SECTION as f64, 1.0, 1.0, 1.0, section::DROP as f64],
    );
    cmd(&mut e, &[op::SET_MODE as f64, 1.0]);
    cmd(&mut e, &[op::PLAY as f64]);
    let (l, _) = render(&mut e, 4.0);
    let bar = (SR * 2.0) as usize;
    assert!(rms(&l[1000..bar - 1000]) < 0.001, "intro is silent");
    assert!(rms(&l[bar..bar * 2 - 1000]) > 0.05, "drop has the kick");
    assert_eq!(e.status[st::SECTION], 1.0);
}

#[test]
fn sidechain_pumps_the_bass() {
    let mut e = Engine::new(SR);
    cmd(&mut e, &[op::SET_BPM as f64, 120.0]);
    drum(&mut e, 0, 0, &[0, 4, 8, 12]);
    cmd(
        &mut e,
        &[op::SET_MIX as f64, 0.0, mix::VOLUME_DB as f64, -90.0],
    ); // hear only the bass
    cmd(
        &mut e,
        &[op::SET_TRACK_KIND as f64, 1.0, kind::POLY as f64, 0.0],
    );
    cmd(&mut e, &[op::SET_PARAM as f64, 1.0, 7.0, 1.0]); // full sustain
    cmd(
        &mut e,
        &[
            op::SET_STEP as f64,
            1.0,
            0.0,
            1.0,
            0.8,
            16.0,
            0.0,
            0.0,
            45.0,
            -1.0,
            -1.0,
            -1.0,
        ],
    );
    cmd(&mut e, &[op::SET_MIX as f64, 1.0, mix::DUCK as f64, 1.0]);
    cmd(&mut e, &[op::SET_SIDECHAIN as f64, 0.0]);
    cmd(&mut e, &[op::PLAY as f64]);
    let (l, _) = render(&mut e, 2.0);
    let beat = (SR * 0.5) as usize;
    let ducked = rms(&l[beat + 600..beat + 2400]);
    let open = rms(&l[beat + 16_000..beat + 18_000]);
    assert!(open > ducked * 2.0, "open {open} vs ducked {ducked}");
}

#[test]
fn every_instrument_makes_sound() {
    for (k, model) in [
        (kind::DRUM, 0u8),
        (kind::DRUM, 2),
        (kind::DRUM, 3),
        (kind::DRUM, 6),
        (kind::DRUM, 11),
        (kind::ACID, 0),
        (kind::BASS808, 0),
        (kind::POLY, 0),
    ] {
        let mut e = Engine::new(SR);
        cmd(&mut e, &[op::SET_BPM as f64, 120.0]);
        cmd(
            &mut e,
            &[op::SET_TRACK_KIND as f64, 0.0, k as f64, model as f64],
        );
        cmd(
            &mut e,
            &[
                op::SET_STEP as f64,
                0.0,
                0.0,
                1.0,
                0.9,
                4.0,
                0.0,
                0.0,
                57.0,
                60.0,
                64.0,
                -1.0,
            ],
        );
        cmd(&mut e, &[op::PLAY as f64]);
        let (l, _) = render(&mut e, if model == 11 { 4.5 } else { 0.6 });
        assert!(rms(&l) > 0.002, "kind {k} model {model} is silent");
        assert!(l.iter().all(|v| v.is_finite()));
    }
}

#[test]
fn sampler_plays_loaded_audio() {
    let mut e = Engine::new(SR);
    let tone: Vec<f32> = (0..24_000).map(|i| (i as f32 * 0.05).sin() * 0.5).collect();
    assert!(e.load_sample(3, tone.into_boxed_slice(), SR).is_none());
    cmd(
        &mut e,
        &[op::SET_TRACK_KIND as f64, 0.0, kind::SAMPLER as f64, 0.0],
    );
    cmd(&mut e, &[op::SET_SAMPLE_SLOT as f64, 0.0, 3.0]);
    cmd(&mut e, &[op::NOTE_ON as f64, 0.0, 60.0, 1.0]);
    let (l, _) = render(&mut e, 0.3);
    assert!(rms(&l) > 0.05);
}

#[test]
fn stop_resets_and_silences() {
    let mut e = tech_house();
    cmd(&mut e, &[op::PLAY as f64]);
    render(&mut e, 1.0);
    cmd(&mut e, &[op::STOP as f64]);
    let (l, _) = render(&mut e, 2.5);
    assert!(rms(&l[48_000..]) < 0.01, "silence after the tails");
    assert_eq!(e.status[st::PLAYING], 0.0);
}

#[test]
fn renders_much_faster_than_real_time() {
    let mut e = tech_house();
    cmd(&mut e, &[op::PLAY as f64]);
    let t = std::time::Instant::now();
    render(&mut e, 20.0);
    let el = t.elapsed().as_secs_f32();
    // Debug builds are slow; this still catches accidental O(n²) work.
    assert!(el < 20.0, "20 s of audio took {el} s");
    eprintln!("20 s de audio en {el:.3} s");
}

/// Soundboard shots sound on the master even with the transport stopped,
/// never on the pre-listen bus, and are not cut by Stop.
#[test]
fn soundboard_shot_plays_on_master() {
    let sr = 48_000.0;
    let mut e = Engine::new(sr);
    let mut params = [0.5f32; 8];
    params[1] = 0.6;
    e.apply(Command::Shot {
        kind: house_engine::kind::DRUM,
        model: 0,
        note: 60,
        vel: 1.0,
        slot: 0,
        params,
    });
    e.apply(Command::Stop);
    let (mut peak, mut cue) = (0.0f32, 0.0f32);
    for _ in 0..40 {
        e.process(256);
        for i in 0..256 {
            peak = peak.max(e.out_l[i].abs());
            cue = cue.max(e.out_cue_l[i].abs());
        }
    }
    assert!(peak > 0.1, "shot too quiet: {peak}");
    assert!(cue < 1e-6, "shot leaked to the cue bus: {cue}");
}

/// A host that reads status less often than the engine writes it keeps every
/// trigger and the highest peaks, with the newest position.
#[test]
fn merged_status_keeps_hits_between_reads() {
    use house_engine::{merge_status, st, STATUS_LEN};
    let mut a = [0.0f32; STATUS_LEN];
    let mut b = [0.0f32; STATUS_LEN];
    a[st::TRIGGERS] = 0b0001 as f32;
    a[st::PEAK_L] = 0.9;
    a[st::TRACK_PEAKS + 3] = 0.7;
    a[st::STEP] = 4.0;
    b[st::TRIGGERS] = 0b0100 as f32;
    b[st::PEAK_L] = 0.2;
    b[st::STEP] = 5.0;
    merge_status(&mut a, &b);
    assert_eq!(a[st::TRIGGERS] as u32, 0b0101);
    assert_eq!(a[st::PEAK_L], 0.9);
    assert_eq!(a[st::TRACK_PEAKS + 3], 0.7);
    assert_eq!(a[st::STEP], 5.0);
}
