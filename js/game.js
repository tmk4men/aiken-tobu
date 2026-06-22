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
    parts: [],
    nextObX: 0,
    nextBoneX: 0,
    distance: 0,
    coins: 0,
    best: 0,
    hintT: 0,
    deadFlash: 0,
    onResult: null,
  };

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
    S.parts = [];
    S.distance = 0;
    S.coins = 0;
    S.hintT = 0;
    S.deadFlash = 0;
    S.nextObX = W * 1.1;       // 最初の障害物までの猶予
    S.nextBoneX = W * 0.7;
  }

  // ===== 入力 =====
  function tap() {
    // 最初のタップは「走り出す」だけ。ジャンプはしない（次のタップから）。
    if (S.phase === "idle") { S.phase = "running"; return; }
    if (S.phase === "running") jump();
  }
  function jump() {
    const d = S.dog;
    if (d.onGround) { d.vy = JUMP_V1; d.onGround = false; d.jumps = 1; d.sy = 0.78; d.sx = 1.18; }
    else if (d.jumps < 2) { d.vy = JUMP_V2; d.jumps = 2; spawnPuff(dogScreenX(), d.feetY - dogH * 0.3, 6); d.sy = 0.82; d.sx = 1.14; }
  }

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
      d.vy += GRAVITY;
      d.feetY += d.vy;
      if (d.feetY >= groundY) {
        if (!d.onGround) { spawnPuff(dogScreenX(), groundY, 7); }
        d.feetY = groundY; d.vy = 0; d.onGround = true; d.jumps = 0;
      }
      // スカッシュ＆ストレッチを徐々に戻す
      d.sx += (1 - d.sx) * 0.2; d.sy += (1 - d.sy) * 0.2;
      // 空中は進行方向に少し傾く
      const targetRot = d.onGround ? 0 : Math.max(-0.35, Math.min(0.5, d.vy * 0.018));
      d.rot += (targetRot - d.rot) * 0.2;

      // 画面外に出た障害物/骨を掃除
      const cutoff = d.worldX - dogScreenX() - 80;
      if (S.obstacles.length && S.obstacles[0].worldX < cutoff) S.obstacles.shift();

      // 当たり判定
      const dx = dogScreenX();
      const dl = dx - dogW * 0.30, dr = dx + dogW * 0.30;
      const dtop = d.feetY - dogH * 0.88, dbot = d.feetY - dogH * 0.06;
      for (const o of S.obstacles) {
        const ox = dx + (o.worldX - d.worldX);
        if (ox + o.w < dl || ox - o.w > dr) continue;
        const otop = groundY - o.h;
        if (dr > ox - o.w * 0.5 && dl < ox + o.w * 0.5 && dbot > otop && dtop < groundY) {
          die(); break;
        }
      }
      // 骨の取得
      for (const b of S.bones) {
        if (b.taken) continue;
        const bx = dx + (b.worldX - d.worldX);
        if (Math.abs(bx - dx) < dogW * 0.5 && Math.abs(b.y - (d.feetY - dogH * 0.4)) < dogH * 0.6) {
          b.taken = true; S.coins++; spawnSpark(bx, b.y);
        }
      }
    }

    // パーティクル更新
    for (const p of S.parts) {
      p.x -= (S.phase === "running" ? S.speed * 0.4 : 0);
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.03;
    }
    S.parts = S.parts.filter((p) => p.life > 0);

    if (S.deadFlash > 0) S.deadFlash -= 0.05;
  }

  let dyingCb = false;
  function die() {
    if (S.phase !== "running") return;
    S.phase = "dead";
    S.deadFlash = 1;
    spawnPuff(dogScreenX(), S.dog.feetY - dogH * 0.4, 12);
    const dist = Math.round(S.distance);
    if (dist > S.best) S.best = dist;
    if (S.onResult && !dyingCb) {
      dyingCb = true;
      setTimeout(() => { dyingCb = false; S.onResult(dist, S.best, S.coins); }, 350);
    }
  }

  // ===== 描画 =====
  function draw() {
    drawSky();
    drawSun();
    drawClouds();
    drawHills(groundY - dogH * 1.5, dogH * 1.1, "#bfe6a8", 0.18);
    drawHills(groundY - dogH * 0.7, dogH * 0.9, "#9ed47f", 0.36);
    drawGround();
    drawBones();
    drawObstacles();
    drawParticles();
    drawDog();
    if (S.deadFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${S.deadFlash * 0.5})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, "#9bd0ff");
    g.addColorStop(0.55, "#cfeaff");
    g.addColorStop(1, "#ffe9c9");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);
  }
  function drawSun() {
    const cx = W * 0.78, cy = groundY * 0.32, r = Math.min(W, H) * 0.10;
    const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.2);
    g.addColorStop(0, "rgba(255,247,210,.95)");
    g.addColorStop(1, "rgba(255,247,210,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff3c4"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  function drawClouds() {
    ctx.fillStyle = "rgba(255,255,255,.85)";
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
    ctx.fillStyle = "#7bbf56"; ctx.fillRect(0, groundY, W, 10);
    const g = ctx.createLinearGradient(0, groundY, 0, H);
    g.addColorStop(0, "#caa46b"); g.addColorStop(1, "#a9824f");
    ctx.fillStyle = g; ctx.fillRect(0, groundY + 10, W, H - groundY - 10);
    // 流れる地面の線
    ctx.strokeStyle = "rgba(120,85,45,.35)"; ctx.lineWidth = 3;
    const off = S.dog.worldX % 60;
    for (let x = -off; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, groundY + 28); ctx.lineTo(x + 22, groundY + 28); ctx.stroke();
    }
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

    ctx.save();
    ctx.translate(x, y - dogH / 2);
    ctx.rotate(d.rot);
    ctx.scale(d.sx, d.sy);
    if (S.dogImg) ctx.drawImage(S.dogImg, -dogW / 2, -dogH / 2, dogW, dogH);
    else { ctx.fillStyle = "#a1887f"; ctx.beginPath(); ctx.arc(0, 0, dogH / 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
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
