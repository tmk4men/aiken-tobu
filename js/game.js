/* =========================================================
   game.js  ―  オートランナー（愛犬が自動で走る／タップでジャンプ）
   状態: idle（スタート待ち）→ running → dead
   操作: タップでジャンプ。空中でもう一度タップでダブルジャンプ。
   障害物に当たると終了。骨を拾うとコイン。走るほどスピードアップ。
   ========================================================= */
(function (global) {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // ----- 物理パラメータ -----
  const GROUND_RATIO = 0.80;  // 地面の高さ（画面比）
  const GRAVITY = 0.85;
  const JUMP_V1 = -15.5;      // 1段目ジャンプ
  const JUMP_V2 = -13.0;      // 空中ジャンプ
  const BASE_SPEED = 6.2;
  const MAX_ADD = 5.0;        // スピード上限の上乗せ
  const PX_PER_M = 16;        // 16px = 1m

  let W = 0, H = 0, groundY = 0, dpr = 1, dogH = 80, dogW = 80;

  // ----- 状態 -----
  const S = {
    phase: "idle",
    dogImg: null,
    dog: { worldX: 0, feetY: 0, vy: 0, jumps: 0, onGround: true, rot: 0, sx: 1, sy: 1 },
    speed: BASE_SPEED,
    obstacles: [],
    bones: [],
    powerups: [],
    power: { magnet: 0, jet: 0, shield: false, invuln: 0 },
    parts: [],
    snow: [],
    shake: 0,
    nextObX: 0,
    nextBoneX: 0,
    nextPowX: 0,
    distance: 0,
    coins: 0,
    best: 0,
    hintT: 0,
    deadFlash: 0,
    onResult: null,
  };

  // 夜空の星（正規化座標。描画時にW/groundYを掛ける）
  const stars = [];
  for (let i = 0; i < 70; i++) {
    stars.push({ x: psd(i * 1.7), y: psd(i * 4.3) * 0.55, r: 0.6 + psd(i * 7.1) * 1.7, tw: psd(i * 2.2) });
  }
  // 位置から決定的に 0..1（pseudoと同じ。初期化で使うため別名で先に用意）
  function psd(x) { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); }

  // 背景の雲（ワールド座標で配置・パララックス）
  const clouds = [];
  for (let i = 0; i < 14; i++) clouds.push({ x: i * 520 + 120, y: 50 + (i % 4) * 46, s: 0.7 + (i % 3) * 0.25 });

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = Math.round(H * GROUND_RATIO);
    dogH = Math.round(Math.max(40, Math.min(88, H * 0.105)));
    if (S.dogImg) dogW = dogH * (S.dogImg.width / S.dogImg.height);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  window.addEventListener("load", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  resize();

  function dogScreenX() { return W * 0.26; }

  function setDog(spriteCanvas) {
    S.dogImg = spriteCanvas;
    dogW = dogH * (spriteCanvas.width / spriteCanvas.height);
  }
  function setBest(v) { S.best = v; }

  function reset() {
    resize();
    S.phase = "idle";
    S.speed = BASE_SPEED;
    S.dog.worldX = 0;
    S.dog.feetY = groundY;
    S.dog.vy = 0;
    S.dog.jumps = 0;
    S.dog.onGround = true;
    S.dog.rot = 0; S.dog.sx = 1; S.dog.sy = 1;
    S.obstacles = [];
    S.bones = [];
    S.powerups = [];
    S.power = { magnet: 0, jet: 0, shield: false, invuln: 0 };
    S.parts = [];
    S.snow = [];
    S.shake = 0;
    S.distance = 0;
    S.coins = 0;
    S.hintT = 0;
    S.deadFlash = 0;
    S.nextObX = W * 1.1;       // 最初の障害物までの猶予
    S.nextBoneX = W * 0.7;
    S.nextPowX = W * 2.2;      // 最初のパワーアップまでの猶予
  }

  // ===== 入力 =====
  function tap() {
    // 最初のタップは「走り出す」だけ。ジャンプはしない（次のタップから）。
    if (S.phase === "idle") { S.phase = "running"; return; }
    if (S.phase === "running") jump();
  }
  function jump() {
    const d = S.dog;
    if (d.onGround) { d.vy = JUMP_V1; d.onGround = false; d.jumps = 1; d.sy = 0.78; d.sx = 1.18; sfx("jump"); }
    else if (d.jumps < 2) { d.vy = JUMP_V2; d.jumps = 2; spawnPuff(dogScreenX(), d.feetY - dogH * 0.3, 6); d.sy = 0.82; d.sx = 1.14; sfx("jump"); }
  }
  function sfx(name) { if (global.Sound) global.Sound.play(name); }

  // ===== スポーン =====
  const OB_TYPES = [
    { w: 44, h: 30, color: "#8d6e63" }, // 岩
    { w: 30, h: 34, color: "#6fae54" }, // 茂み
    { w: 52, h: 26, color: "#9c7a52" }, // 倒木
    { w: 24, h: 56, color: "#8a6d4b" }, // 切り株
  ];

  function airFrames(v) { return (2 * Math.abs(v)) / GRAVITY; }

  function spawnAhead() {
    const horizon = S.dog.worldX + (W - dogScreenX()) + 300;
    // 障害物
    while (S.nextObX < horizon) {
      const t = OB_TYPES[(Math.floor(S.nextObX / 53) + S.obstacles.length) % OB_TYPES.length];
      S.obstacles.push({ worldX: S.nextObX, w: t.w, h: t.h, color: t.color });
      // ジャンプで越えられる十分な間隔（スピードに比例）
      const reach = S.speed * airFrames(JUMP_V1);
      const r = pseudo(S.nextObX);
      S.nextObX += Math.max(240, reach * (0.95 + r * 0.9)) + t.w;
    }
    // 骨（コイン）
    while (S.nextBoneX < horizon) {
      const r = pseudo(S.nextBoneX * 1.7);
      const arc = r < 0.5;
      const y = arc ? groundY - dogH * (1.1 + r) : groundY - dogH * 0.45;
      S.bones.push({ worldX: S.nextBoneX, y, taken: false });
      S.nextBoneX += 200 + r * 260;
    }
    // パワーアップ（まれに出現）
    while (S.nextPowX < horizon) {
      const r = pseudo(S.nextPowX * 3.3);
      const types = ["magnet", "jet", "shield"];
      const type = types[Math.floor(r * 3) % 3];
      const y = groundY - dogH * (0.95 + r * 0.9);
      S.powerups.push({ worldX: S.nextPowX, y, type, taken: false });
      S.nextPowX += 1400 + r * 1100;
    }
  }
  // Math.random不使用の擬似乱数（位置から決定的に 0..1）
  function pseudo(x) { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); }

  // ===== パーティクル =====
  function spawnPuff(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      S.parts.push({ x, y, vx: Math.cos(a) * (1 + pseudo(i + x) * 2), vy: -1 - pseudo(i) * 2, life: 1, kind: "dust" });
    }
  }
  function spawnSpark(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      S.parts.push({ x, y, vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4 - 1, life: 1, kind: "spark" });
    }
  }

  // ===== 更新 =====
  function update() {
    if (S.phase === "running") {
      S.speed = BASE_SPEED + Math.min(MAX_ADD, S.dog.worldX / 2600);
      S.dog.worldX += S.speed;
      S.distance = S.dog.worldX / PX_PER_M;
      S.hintT += 1;
      spawnAhead();

      const d = S.dog;
      const P = S.power;
      if (P.magnet > 0) P.magnet--;
      if (P.jet > 0) P.jet--;
      if (P.invuln > 0) P.invuln--;

      if (P.jet > 0) {
        // ジェットパック中はふわっと上空を飛ぶ（障害物は当たらない）
        const targetFeet = groundY - dogH * 2.4;
        d.feetY += (targetFeet - d.feetY) * 0.12;
        d.vy = 0; d.onGround = false; d.jumps = 0;
        if (S.hintT % 2 === 0) spawnPuff(dogScreenX() - dogW * 0.25, d.feetY - dogH * 0.05, 2);
      } else {
        d.vy += GRAVITY;
        d.feetY += d.vy;
        if (d.feetY >= groundY) {
          if (!d.onGround) { spawnPuff(dogScreenX(), groundY, 7); }
          d.feetY = groundY; d.vy = 0; d.onGround = true; d.jumps = 0;
        }
      }
      // スカッシュ＆ストレッチを徐々に戻す
      d.sx += (1 - d.sx) * 0.2; d.sy += (1 - d.sy) * 0.2;
      // 空中は進行方向に少し傾く
      const targetRot = d.onGround ? 0 : Math.max(-0.35, Math.min(0.5, d.vy * 0.018));
      d.rot += (targetRot - d.rot) * 0.2;

      const dx = dogScreenX();

      // 画面外に出た障害物/パワーアップを掃除
      const cutoff = d.worldX - dx - 80;
      if (S.obstacles.length && S.obstacles[0].worldX < cutoff) S.obstacles.shift();
      S.powerups = S.powerups.filter((p) => !p.taken && p.worldX > cutoff);

      // 骨マグネット：近くの骨を吸い寄せる
      if (P.magnet > 0) {
        const dyc = d.feetY - dogH * 0.4;
        for (const b of S.bones) {
          if (b.taken) continue;
          const bx = dx + (b.worldX - d.worldX);
          if (bx > dx - dogW && bx < dx + dogW * 5) {
            b.worldX += (d.worldX - b.worldX) * 0.16;
            b.y += (dyc - b.y) * 0.16;
          }
        }
      }

      // 当たり判定（ジェット中・無敵中は無効）＋ギリ避け判定
      const dl = dx - dogW * 0.30, dr = dx + dogW * 0.30;
      const dtop = d.feetY - dogH * 0.88, dbot = d.feetY - dogH * 0.06;
      for (const o of S.obstacles) {
        const ox = dx + (o.worldX - d.worldX);
        const otop = groundY - o.h;
        const overlapX = ox - o.w * 0.5 < dr && ox + o.w * 0.5 > dl;
        if (overlapX) {
          const gap = otop - dbot; // 正なら頭上を通過中
          if (o.minGap === undefined || gap < o.minGap) o.minGap = gap;
          if (P.jet <= 0 && P.invuln <= 0 && dbot > otop && dtop < groundY) {
            if (P.shield) { P.shield = false; P.invuln = 70; spawnSpark(dx, d.feetY - dogH * 0.4); S.shake = 8; sfx("near"); }
            else { die(); break; }
          }
        }
        // ギリ避け（near miss）：頭上スレスレで通過したらボーナス＆演出
        if (!o.passed && ox + o.w * 0.5 < dl) {
          o.passed = true;
          if (o.minGap !== undefined && o.minGap > 4 && o.minGap < dogH * 0.5 && S.phase === "running") {
            S.shake = Math.min(9, S.shake + 6); S.coins++; spawnSpark(dx, dtop); sfx("near");
          }
        }
      }

      // 骨の取得
      for (const b of S.bones) {
        if (b.taken) continue;
        const bx = dx + (b.worldX - d.worldX);
        if (Math.abs(bx - dx) < dogW * 0.5 && Math.abs(b.y - (d.feetY - dogH * 0.4)) < dogH * 0.6) {
          b.taken = true; S.coins++; spawnSpark(bx, b.y); sfx("coin");
        }
      }

      // パワーアップ取得
      for (const p of S.powerups) {
        if (p.taken) continue;
        const px = dx + (p.worldX - d.worldX);
        if (Math.abs(px - dx) < dogW * 0.7 && Math.abs(p.y - (d.feetY - dogH * 0.4)) < dogH * 0.85) {
          p.taken = true; activatePower(p.type); spawnSpark(px, p.y); sfx("power");
        }
      }
    }

    updateWeather();
    S.shake = S.shake > 0.3 ? S.shake * 0.86 : 0;

    // パーティクル更新
    for (const p of S.parts) {
      p.x -= (S.phase === "running" ? S.speed * 0.4 : 0);
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.03;
    }
    S.parts = S.parts.filter((p) => p.life > 0);

    if (S.deadFlash > 0) S.deadFlash -= 0.05;
  }

  function activatePower(type) {
    if (type === "magnet") S.power.magnet = 360;       // 約6秒
    else if (type === "jet") S.power.jet = 240;        // 約4秒
    else if (type === "shield") S.power.shield = true; // 1回ぶん耐える
  }

  // 雪の更新（テーマのsnow量に応じて降らせる）
  function updateWeather() {
    const sn = curTheme().snow;
    const target = Math.round(80 * sn);
    while (S.snow.length < target) {
      S.snow.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.6, vx: -0.4 - Math.random(), vy: 0.8 + Math.random() * 1.6, sw: Math.random() * Math.PI });
    }
    if (S.snow.length > target) S.snow.length = target;
    for (const f of S.snow) {
      f.x += f.vx - S.speed * 0.05; f.y += f.vy; f.sw += 0.05; f.x += Math.sin(f.sw) * 0.3;
      if (f.y > H) { f.y = -5; f.x = Math.random() * W; }
      if (f.x < -5) f.x = W + 5;
    }
  }

  let dyingCb = false;
  function die() {
    if (S.phase !== "running") return;
    S.phase = "dead";
    S.deadFlash = 1;
    S.shake = 14;
    sfx("hit");
    spawnPuff(dogScreenX(), S.dog.feetY - dogH * 0.4, 12);
    const dist = Math.round(S.distance);
    if (dist > S.best) S.best = dist;
    if (S.onResult && !dyingCb) {
      dyingCb = true;
      setTimeout(() => { dyingCb = false; S.onResult(dist, S.best, S.coins); }, 350);
    }
  }

  // ===== ステージのテーマ（距離で 昼→夕方→夜→雪 に変化） =====
  const THEMES = [
    { at: 0,   skyTop: "#9bd0ff", skyMid: "#cfeaff", skyBot: "#ffe9c9", hillA: "#bfe6a8", hillB: "#9ed47f", grass: "#7bbf56", soilTop: "#caa46b", soilBot: "#a9824f", night: 0, snow: 0 },
    { at: 180, skyTop: "#ffb86b", skyMid: "#ff9e7a", skyBot: "#ffd9a0", hillA: "#a9cf8e", hillB: "#7fae63", grass: "#6fae54", soilTop: "#b58e57", soilBot: "#8f6a3f", night: 0, snow: 0 },
    { at: 380, skyTop: "#0f1f48", skyMid: "#243a6e", skyBot: "#3a4f7a", hillA: "#2c5238", hillB: "#1f3c2a", grass: "#2a5d3a", soilTop: "#46392a", soilBot: "#2f261b", night: 1, snow: 0 },
    { at: 650, skyTop: "#9fb4d6", skyMid: "#c7d6ea", skyBot: "#eef3fb", hillA: "#dfeaf2", hillB: "#c6d6e6", grass: "#e3edf3", soilTop: "#d0dce6", soilBot: "#b6c4d4", night: 0, snow: 1 },
  ];
  function hx(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function lc(a, b, t) { const A = hx(a), B = hx(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`; }
  function ln(a, b, t) { return a + (b - a) * t; }
  function curTheme() {
    const d = S.distance;
    let i = 0; while (i < THEMES.length - 1 && d >= THEMES[i + 1].at) i++;
    if (i >= THEMES.length - 1) return THEMES[THEMES.length - 1];
    const a = THEMES[i], b = THEMES[i + 1];
    const t = Math.max(0, Math.min(1, (d - a.at) / (b.at - a.at)));
    return {
      skyTop: lc(a.skyTop, b.skyTop, t), skyMid: lc(a.skyMid, b.skyMid, t), skyBot: lc(a.skyBot, b.skyBot, t),
      hillA: lc(a.hillA, b.hillA, t), hillB: lc(a.hillB, b.hillB, t),
      grass: lc(a.grass, b.grass, t), soilTop: lc(a.soilTop, b.soilTop, t), soilBot: lc(a.soilBot, b.soilBot, t),
      night: ln(a.night, b.night, t), snow: ln(a.snow, b.snow, t),
    };
  }

  // ===== 描画 =====
  let TH = null;
  function draw() {
    TH = curTheme();
    ctx.save();
    if (S.shake > 0.3) ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
    drawSky();
    drawStars();
    drawCelestial();
    drawMountains();
    drawClouds();
    drawHills(groundY - dogH * 1.5, dogH * 1.1, TH.hillA, 0.18);
    drawHills(groundY - dogH * 0.7, dogH * 0.9, TH.hillB, 0.36);
    drawTrees();
    drawGround();
    drawGroundDecor();
    drawBones();
    drawObstacles();
    drawPowerups();
    drawParticles();
    drawSnow();
    drawDog();
    drawPowerHud();
    if (S.deadFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${S.deadFlash * 0.5})`; ctx.fillRect(-30, -30, W + 60, H + 60); }
    ctx.restore();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, TH.skyTop);
    g.addColorStop(0.55, TH.skyMid);
    g.addColorStop(1, TH.skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);
  }
  function drawStars() {
    if (TH.night < 0.05) return;
    for (const st of stars) {
      const a = TH.night * (0.45 + 0.55 * Math.sin(S.dog.worldX * 0.02 + st.tw * 9));
      if (a <= 0) continue;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(st.x * W, st.y * groundY, st.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawCelestial() {
    const cx = W * 0.78, cy = groundY * 0.30, r = Math.min(W, H) * 0.10;
    const sun = 1 - TH.night;
    if (sun > 0.02) {
      const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.2);
      g.addColorStop(0, `rgba(255,247,210,${0.95 * sun})`);
      g.addColorStop(1, "rgba(255,247,210,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,243,196,${sun})`; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    if (TH.night > 0.02) {
      ctx.save();
      ctx.globalAlpha = TH.night;
      const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2);
      g.addColorStop(0, "rgba(230,238,255,.5)"); g.addColorStop(1, "rgba(230,238,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#eef3ff"; ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#16264f"; ctx.beginPath(); ctx.arc(cx + r * 0.35, cy - r * 0.2, r * 0.78, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  function drawClouds() {
    ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - TH.night * 0.65)})`;
    const span = clouds.length * 520;
    for (const c of clouds) {
      let x = c.x - S.dog.worldX * 0.12;
      x = ((x % span) + span) % span;
      blob(x, c.y, c.s);
    }
  }
  function blob(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 26 * s, 0, Math.PI * 2);
    ctx.arc(x + 30 * s, y + 8 * s, 20 * s, 0, Math.PI * 2);
    ctx.arc(x - 28 * s, y + 8 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(x + 4 * s, y + 14 * s, 22 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // 遠景の山（ゆっくりパララックス）
  function drawMountains() {
    const factor = 0.05, step = 360, baseY = groundY;
    const scroll = S.dog.worldX * factor;
    const col = TH.night > 0.5 ? "#2a3a63" : (TH.snow > 0.5 ? "#bccadd" : "#a9cdb0");
    const start = Math.floor((scroll - step) / step);
    for (let i = start; i * step - scroll < W + step; i++) {
      const x = i * step - scroll;
      const h = dogH * (1.8 + psd(i * 3.7) * 1.5);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - step * 0.62, baseY); ctx.lineTo(x, baseY - h); ctx.lineTo(x + step * 0.62, baseY);
      ctx.closePath(); ctx.fill();
      if (TH.snow > 0.2 || h > dogH * 2.7) {
        ctx.fillStyle = `rgba(255,255,255,${Math.max(TH.snow, 0.55)})`;
        ctx.beginPath();
        ctx.moveTo(x, baseY - h); ctx.lineTo(x - h * 0.17, baseY - h + h * 0.22); ctx.lineTo(x + h * 0.17, baseY - h + h * 0.22);
        ctx.closePath(); ctx.fill();
      }
    }
  }
  // 中景の並木（パララックス）
  function drawTrees() {
    const factor = 0.22, step = 230;
    const scroll = S.dog.worldX * factor;
    const start = Math.floor((scroll - step) / step);
    for (let i = start; i * step - scroll < W + step; i++) {
      const r = psd(i * 5.3);
      if (r < 0.4) continue; // まばらに
      drawTree(i * step - scroll, groundY, 0.85 + psd(i * 2.1) * 0.5);
    }
  }
  function drawTree(x, rootY, s) {
    const th = dogH * 1.3 * s, w = dogH * 0.62 * s;
    ctx.fillStyle = TH.night > 0.5 ? "#241c2e" : "#6e4b2e";
    ctx.fillRect(x - w * 0.07, rootY - th * 0.2, w * 0.14, th * 0.2);
    const green = TH.night > 0.5 ? "#1f3f2b" : "#5aa64a";
    for (let k = 0; k < 3; k++) {
      const ty = rootY - th * 0.2 - k * th * 0.26;
      const half = (w * 0.5) * (1 - k * 0.22);
      ctx.fillStyle = green;
      ctx.beginPath(); ctx.moveTo(x, ty - th * 0.38); ctx.lineTo(x - half, ty); ctx.lineTo(x + half, ty); ctx.closePath(); ctx.fill();
      if (TH.snow > 0.15) {
        ctx.fillStyle = `rgba(255,255,255,${0.85 * TH.snow})`;
        ctx.beginPath(); ctx.moveTo(x, ty - th * 0.38); ctx.lineTo(x - half * 0.5, ty - th * 0.16); ctx.lineTo(x + half * 0.5, ty - th * 0.16); ctx.closePath(); ctx.fill();
      }
    }
  }
  function drawHills(yBase, r, color, factor) {
    ctx.fillStyle = color;
    ctx.fillRect(0, yBase, W, H - yBase);
    const step = r * 1.4;
    const off = (S.dog.worldX * factor) % step;
    for (let x = -off - step; x < W + step; x += step) {
      ctx.beginPath(); ctx.arc(x + step / 2, yBase, r, Math.PI, Math.PI * 2); ctx.fill();
    }
  }
  function drawGround() {
    ctx.fillStyle = TH.grass; ctx.fillRect(0, groundY, W, 10);
    const g = ctx.createLinearGradient(0, groundY, 0, H);
    g.addColorStop(0, TH.soilTop); g.addColorStop(1, TH.soilBot);
    ctx.fillStyle = g; ctx.fillRect(0, groundY + 10, W, H - groundY - 10);
    // 流れる地面の線
    ctx.strokeStyle = TH.snow > 0.4 ? "rgba(150,170,190,.4)" : "rgba(120,85,45,.35)"; ctx.lineWidth = 3;
    const off = S.dog.worldX % 60;
    for (let x = -off; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, groundY + 28); ctx.lineTo(x + 22, groundY + 28); ctx.stroke();
    }
  }
  // 地面の手前の装飾（草・花・雪山）
  function drawGroundDecor() {
    const step = 92, scroll = S.dog.worldX;
    const start = Math.floor((scroll - step) / step);
    for (let i = start; i * step - scroll < W + step; i++) {
      const r = psd(i * 8.1);
      if (r < 0.45) continue;
      const x = i * step - scroll;
      if (TH.snow > 0.4) {
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.beginPath(); ctx.ellipse(x, groundY + 7, 16, 7, 0, Math.PI, 0); ctx.fill();
      } else {
        ctx.strokeStyle = TH.night > 0.5 ? "#1f3f2b" : "#5aa64a"; ctx.lineWidth = 2.5;
        for (let b = -1; b <= 1; b++) {
          ctx.beginPath(); ctx.moveTo(x + b * 4, groundY + 2); ctx.quadraticCurveTo(x + b * 4 + b * 3, groundY - 10, x + b * 6, groundY - 16); ctx.stroke();
        }
        if (r > 0.85) { ctx.fillStyle = TH.night > 0.5 ? "#caa6ff" : "#ff6f91"; ctx.beginPath(); ctx.arc(x + 6, groundY - 18, 3.2, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }
  function drawSnow() {
    if (TH.snow < 0.02) return;
    ctx.fillStyle = `rgba(255,255,255,${0.85 * TH.snow})`;
    for (const f of S.snow) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
  }
  // パワーアップのアイテム
  const POW_ICON = { magnet: "🧲", jet: "🚀", shield: "🛡️" };
  function drawPowerups() {
    const dx = dogScreenX();
    for (const p of S.powerups) {
      if (p.taken) continue;
      const x = dx + (p.worldX - S.dog.worldX);
      if (x < -40 || x > W + 40) continue;
      const y = p.y + Math.sin((S.dog.worldX + p.worldX) * 0.02) * 5;
      const g = ctx.createRadialGradient(x, y, 4, x, y, 26);
      g.addColorStop(0, "rgba(255,255,255,.85)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
      ctx.font = "24px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(POW_ICON[p.type] || "★", x, y + 1);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    }
  }
  // 発動中パワーアップの残量バー
  function drawPowerHud() {
    const items = [];
    if (S.power.jet > 0) items.push(["🚀", S.power.jet / 240, "#4cc4c9"]);
    if (S.power.magnet > 0) items.push(["🧲", S.power.magnet / 360, "#ff6f91"]);
    if (S.power.shield) items.push(["🛡️", 1, "#ffd23f"]);
    let y = 70;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (const [ico, frac, col] of items) {
      ctx.font = "20px serif"; ctx.fillText(ico, 14, y);
      ctx.fillStyle = "rgba(0,0,0,.18)"; roundRect(44, y - 6, 72, 11, 5.5); ctx.fill();
      ctx.fillStyle = col; roundRect(44, y - 6, 72 * frac, 11, 5.5); ctx.fill();
      y += 26;
    }
    ctx.textBaseline = "alphabetic";
  }
  function drawObstacles() {
    const dx = dogScreenX();
    for (const o of S.obstacles) {
      const x = dx + (o.worldX - S.dog.worldX);
      if (x + o.w < -20 || x - o.w > W + 20) continue;
      const top = groundY - o.h;
      // 影
      ctx.fillStyle = "rgba(0,0,0,.12)";
      ctx.beginPath(); ctx.ellipse(x, groundY + 4, o.w * 0.7, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = o.color;
      roundRect(x - o.w / 2, top, o.w, o.h, Math.min(8, o.w / 2));
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.16)";
      roundRect(x - o.w / 2, top, o.w * 0.4, o.h, Math.min(8, o.w / 2)); ctx.fill();
    }
  }
  function drawBones() {
    const dx = dogScreenX();
    for (const b of S.bones) {
      if (b.taken) continue;
      const x = dx + (b.worldX - S.dog.worldX);
      if (x < -30 || x > W + 30) continue;
      const bob = Math.sin((S.dog.worldX + b.worldX) * 0.02) * 4;
      drawBone(x, b.y + bob);
    }
  }
  function drawBone(x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
    // やわらかい光
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
    g.addColorStop(0, "rgba(255,240,170,.6)"); g.addColorStop(1, "rgba(255,240,170,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff7e0"; ctx.strokeStyle = "#e6cf8a"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-9, -5, 5.5, 0, Math.PI * 2); ctx.arc(-9, 5, 5.5, 0, Math.PI * 2);
    ctx.arc(9, -5, 5.5, 0, Math.PI * 2); ctx.arc(9, 5, 5.5, 0, Math.PI * 2);
    ctx.fill(); ctx.fillRect(-9, -4.5, 18, 9); ctx.stroke();
    ctx.restore();
  }
  function drawParticles() {
    for (const p of S.parts) {
      if (p.kind === "spark") {
        ctx.fillStyle = `rgba(255,224,130,${p.life})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.life + 1, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(190,160,120,${p.life * 0.7})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5 * p.life + 1, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function drawDog() {
    const d = S.dog;
    const x = dogScreenX();
    const bob = (d.onGround && S.phase !== "idle") ? Math.abs(Math.sin(d.worldX * 0.06)) * dogH * 0.06 : 0;
    const y = d.feetY - bob;
    // 影（高さで縮む）
    const air = Math.max(0, (groundY - d.feetY) / (dogH * 2.2));
    const shW = dogW * 0.5 * (1 - air * 0.5);
    ctx.fillStyle = `rgba(60,40,20,${0.22 * (1 - air * 0.6)})`;
    ctx.beginPath(); ctx.ellipse(x, groundY + 6, shW, 7 * (1 - air * 0.5), 0, 0, Math.PI * 2); ctx.fill();

    // ジェット噴射の炎
    if (S.power.jet > 0) {
      const fy = y, flick = dogH * (0.18 + Math.random() * 0.12);
      const g = ctx.createLinearGradient(0, fy, 0, fy + flick);
      g.addColorStop(0, "rgba(255,210,90,.95)"); g.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x - dogW * 0.12, fy, dogW * 0.16, flick, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y - dogH / 2);
    ctx.rotate(d.rot);
    ctx.scale(d.sx, d.sy);
    // 無敵中は点滅
    if (S.power.invuln > 0 && Math.floor(S.hintT / 4) % 2 === 0) ctx.globalAlpha = 0.45;
    if (S.dogImg) ctx.drawImage(S.dogImg, -dogW / 2, -dogH / 2, dogW, dogH);
    else { ctx.fillStyle = "#a1887f"; ctx.beginPath(); ctx.arc(0, 0, dogH / 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();

    // シールドの泡
    if (S.power.shield || S.power.invuln > 0) {
      const a = S.power.shield ? 0.9 : (0.35 + 0.35 * Math.sin(S.hintT * 0.5));
      ctx.strokeStyle = `rgba(120,200,255,${a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y - dogH / 2, dogH * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(120,200,255,${a * 0.12})`; ctx.beginPath(); ctx.arc(x, y - dogH / 2, dogH * 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ----- 図形ヘルパ -----
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ===== ループ =====
  let running = false;
  function loop() { if (!running) return; update(); draw(); requestAnimationFrame(loop); }
  function start() { if (!running) { running = true; loop(); } }

  global.Game = {
    start, reset, tap, setDog, setBest,
    get phase() { return S.phase; },
    get distance() { return S.distance; },
    get coins() { return S.coins; },
    get best() { return S.best; },
    onResult(cb) { S.onResult = cb; },
  };
})(window);
