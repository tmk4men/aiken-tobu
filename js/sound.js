/* =========================================================
   sound.js  ―  効果音（WebAudioで合成。音声ファイル不要・オフラインOK）
   Sound.play("jump"|"coin"|"power"|"hit"|"near"|"best")
   Sound.unlock() を最初のタップで呼ぶ（モバイルの自動再生制限対策）。
   Sound.toggleMute() / Sound.muted で消音切替。
   ========================================================= */
(function (global) {
  "use strict";

  let actx = null;
  let muted = localStorage.getItem("aiken-dash-mute") === "1";

  function ctx() {
    if (!actx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === "suspended") actx.resume();
    return actx;
  }

  /** 単音（任意で周波数スイープ）。t0は発音の遅延(秒) */
  function blip(freq, dur, type, vol, to, t0) {
    const ac = ctx(); if (!ac || muted) return;
    const o = ac.createOscillator(), g = ac.createGain();
    const start = ac.currentTime + (t0 || 0);
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, start);
    if (to) o.frequency.exponentialRampToValueAtTime(to, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(ac.destination);
    o.start(start); o.stop(start + dur + 0.03);
  }

  /** ノイズ（吠え声/衝突音っぽさに使う） */
  function noise(dur, vol, filterType, freq, t0) {
    const ac = ctx(); if (!ac || muted) return;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = filterType || "bandpass"; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(ac.destination);
    src.start(ac.currentTime + (t0 || 0));
  }

  const SOUNDS = {
    // 「ワン！」風の二連ノイズ
    jump() { noise(0.12, 0.22, "bandpass", 620); noise(0.10, 0.16, "bandpass", 900, 0.09); },
    coin() { blip(900, 0.10, "square", 0.14, 1320); blip(1320, 0.10, "square", 0.10, null, 0.06); },
    power() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.14, "triangle", 0.16, null, i * 0.07)); },
    hit() { noise(0.30, 0.30, "lowpass", 240); blip(150, 0.32, "sawtooth", 0.22, 55); },
    near() { blip(1500, 0.09, "sine", 0.10, 600); },
    best() { [523, 659, 784, 1046, 1318].forEach((f, i) => blip(f, 0.22, "triangle", 0.18, null, i * 0.11)); },
  };

  global.Sound = {
    play(name) { const s = SOUNDS[name]; if (s) s(); },
    unlock() { ctx(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      localStorage.setItem("aiken-dash-mute", muted ? "1" : "0");
      return muted;
    },
  };
})(window);
