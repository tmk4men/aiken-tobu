/* =========================================================
   game.js  ―  ぶっ飛ばしゲーム本体（物理＋描画）
   状態: idle → power → angle → flying → done
   操作はタップ1つ。
     1回目: パワー決定（メーターが往復→タップで確定）
     2回目: 角度決定（同上）
     発射後: 空中でタップすると1回だけブースト
   ========================================================= */
(function (global) {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // ----- 物理パラメータ -----
  const G = 0.45;            // 重力
  const REST = 0.62;         // 地面の反発係数
  const FRICTION = 0.86;     // 着地時の水平減衰
  const PX_PER_M = 12;       // 12px = 1m
  const GROUND_Y_RATIO = 0.82; // 画面下からの地面位置
  const BOOST_VX = 7;        // 空中ブーストの水平加速

  let W = 0, H = 0, groundY = 0, dpr = 1;

  // ----- ゲーム状態 -----
  const game = {
    phase: "idle",
    dogImg: null,     // スプライト(canvas)
    dog: { x: 0, y: 0, vx: 0, vy: 0, r: 30, rot: 0, vr: 0 },
    cam: 0,           // カメラのワールドX
    power: 0,         // 0..1
    angle: 0,         // 0..1 (0=水平, 1=高角)
    meterT: 0,        // メーター往復用タイマ
    boostUsed: false,
    distance: 0,
    best: 0,
    items: [],        // 空中のブーストアイテム
    stopTimer: 0,
    onResult: null,
  };

  // ----- 背景の雲（飾り） -----
  const clouds = [];
  for (let i = 0; i < 24; i++) {
    clouds.push({ x: i * 380 + 100, y: 40 + (i % 4) * 60, s: 0.6 + (i % 3) * 0.25 });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = H * GROUND_Y_RATIO;
  }
  window.addEventListener("resize", resize);
  resize();

  function setDog(spriteCanvas) {
    game.dogImg = spriteCanvas;
    const ratio = spriteCanvas.height / spriteCanvas.width;
    game.dog.r = 34;
    game.dog._w = 68;
    game.dog._h = 68 * ratio;
  }

  function setBest(v) { game.best = v; }

  /** 新しい1投をセット */
  function reset() {
    game.phase = "idle";
    game.cam = 0;
    game.power = 0;
    game.angle = 0;
    game.meterT = 0;
    game.boostUsed = false;
    game.distance = 0;
    game.stopTimer = 0;
    game.dog.x = 60;
    game.dog.y = groundY - 40;
    game.dog.vx = 0;
    game.dog.vy = 0;
    game.dog.rot = 0;
    game.dog.vr = 0;
    spawnItems();
  }

  /** 空中のブーストアイテム（骨）をランダム配置 */
  function spawnItems() {
    game.items = [];
    let x = 600;
    for (let i = 0; i < 60; i++) {
      x += 350 + Math.floor((i * 137) % 400); // 擬似ランダム間隔（Math.random不使用）
      const y = groundY - 120 - ((i * 53) % 260);
      game.items.push({ x, y, taken: false });
    }
  }

  // ----- 入力（タップ）処理 -----
  function tap() {
    if (game.phase === "idle") {
      game.phase = "power";
    } else if (game.phase === "power") {
      game.phase = "angle";
      game.meterT = 0;
    } else if (game.phase === "angle") {
      launch();
    } else if (game.phase === "flying" && !game.boostUsed) {
      game.dog.vx += BOOST_VX;
      game.dog.vy -= 2;
      game.boostUsed = true;
    }
  }

  function launch() {
    const maxSpeed = 26;
    const speed = 6 + game.power * maxSpeed;
    const ang = (12 + game.angle * 66) * Math.PI / 180; // 12°〜78°
    game.dog.vx = Math.cos(ang) * speed;
    game.dog.vy = -Math.sin(ang) * speed;
    game.dog.vr = 0.12 + game.power * 0.2;
    game.phase = "flying";
  }

  // ----- 毎フレーム更新 -----
  function update() {
    if (game.phase === "power") {
      game.meterT += 0.045;
      game.power = (Math.sin(game.meterT) + 1) / 2;
    } else if (game.phase === "angle") {
      game.meterT += 0.05;
      game.angle = (Math.sin(game.meterT) + 1) / 2;
    } else if (game.phase === "flying") {
      const d = game.dog;
      d.vy += G;
      d.x += d.vx;
      d.y += d.vy;
      d.rot += d.vr;

      // 着地判定
      const floor = groundY - 30;
      if (d.y >= floor) {
        d.y = floor;
        if (Math.abs(d.vy) > 1.2) {
          d.vy = -d.vy * REST;     // バウンド
          d.vx *= FRICTION;
          d.vr *= 0.6;
        } else {
          d.vy = 0;
          d.vx *= 0.92;            // 転がって減速
          d.vr *= 0.9;
        }
      }

      // アイテム取得でブースト
      for (const it of game.items) {
        if (it.taken) continue;
        if (Math.abs(it.x - d.x) < 36 && Math.abs(it.y - d.y) < 40) {
          it.taken = true;
          d.vx += 3.5;
          d.vy -= 4.5;
        }
      }

      // カメラ追従
      const targetCam = d.x - W * 0.32;
      game.cam += (targetCam - game.cam) * 0.12;
      if (game.cam < 0) game.cam = 0;

      game.distance = Math.max(game.distance, (d.x - 60) / PX_PER_M);

      // 停止判定
      const onGround = d.y >= floor - 0.5;
      if (onGround && Math.abs(d.vx) < 0.35 && Math.abs(d.vy) < 0.5) {
        game.stopTimer++;
        if (game.stopTimer > 30) finish();
      } else {
        game.stopTimer = 0;
      }
    }
  }

  function finish() {
    game.phase = "done";
    const dist = Math.round(game.distance);
    if (dist > game.best) game.best = dist;
    if (game.onResult) game.onResult(dist, game.best);
  }

  // ----- 描画 -----
  function draw() {
    // 空グラデーション
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, "#4fa9e8");
    sky.addColorStop(1, "#b3e5fc");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, groundY);

    // 雲（ゆっくり視差スクロール）
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const c of clouds) {
      const cx = c.x - game.cam * 0.4;
      const sx = ((cx % (clouds.length * 380)) + clouds.length * 380) % (clouds.length * 380);
      drawCloud(sx, c.y, c.s);
    }

    // 地面
    ctx.fillStyle = "#7cb342";
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = "#689f38";
    ctx.fillRect(0, groundY, W, 8);

    // 距離マーカー（10mごと）
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    const startM = Math.floor(game.cam / PX_PER_M / 10) * 10;
    for (let m = startM; m < startM + (W / PX_PER_M) + 20; m += 10) {
      const sx = 60 + m * PX_PER_M - game.cam;
      if (sx < -20 || sx > W + 20) continue;
      ctx.fillRect(sx, groundY, 2, 12);
      ctx.fillText(m + "m", sx, groundY + 26);
    }

    // アイテム（骨）
    for (const it of game.items) {
      if (it.taken) continue;
      const sx = it.x - game.cam;
      if (sx < -40 || sx > W + 40) continue;
      drawBone(sx, it.y);
    }

    // 犬
    drawDog();

    // 発射前のガイド矢印
    if (game.phase === "idle" || game.phase === "power" || game.phase === "angle") {
      drawAimArrow();
    }
  }

  function drawCloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 24 * s, y + 6 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(x - 24 * s, y + 6 * s, 16 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBone(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#fffde7";
    ctx.strokeStyle = "#d7c98a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-10, -6, 6, 0, Math.PI * 2);
    ctx.arc(-10, 6, 6, 0, Math.PI * 2);
    ctx.arc(10, -6, 6, 0, Math.PI * 2);
    ctx.arc(10, 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-10, -5, 20, 10);
    ctx.restore();
  }

  function drawDog() {
    const d = game.dog;
    const sx = d.x - game.cam;
    const sy = d.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(d.rot);
    if (game.dogImg) {
      const w = d._w, h = d._h;
      ctx.drawImage(game.dogImg, -w / 2, -h / 2, w, h);
    } else {
      // スプライト未設定時の仮の犬
      ctx.fillStyle = "#a1887f";
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 影
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(sx, groundY - 6, 26, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAimArrow() {
    const d = game.dog;
    const sx = d.x - game.cam;
    const sy = d.y;
    const ang = (12 + game.angle * 66) * Math.PI / 180;
    const len = 50 + game.power * 80;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-ang);
    ctx.strokeStyle = "rgba(255,87,34,0.9)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(len - 14, -10);
    ctx.lineTo(len - 14, 10);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,87,34,0.9)";
    ctx.fill();
    ctx.restore();
  }

  // ----- メインループ -----
  let running = false;
  function loop() {
    if (!running) return;
    update();
    draw();
    requestAnimationFrame(loop);
  }
  function start() { if (!running) { running = true; loop(); } }

  global.Game = {
    start, reset, tap, setDog, setBest,
    get phase() { return game.phase; },
    get power() { return game.power; },
    get angle() { return game.angle; },
    get distance() { return game.distance; },
    get best() { return game.best; },
    get boostUsed() { return game.boostUsed; },
    onResult(cb) { game.onResult = cb; },
  };
})(window);
