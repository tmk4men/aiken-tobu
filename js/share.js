/* =========================================================
   share.js  ―  リザルトのシェア画像づくり＆保存/共有＋紙吹雪
   Share.makeCard({dog, name, dist, best, coins}) -> canvas
   Share.save(canvas) / Share.share(canvas, text)
   Share.confetti()  … ベスト更新の紙吹雪
   ========================================================= */
(function (global) {
  "use strict";

  const SITE = "tmk4men.github.io/aiken-tobu";

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /** SNS向け 1080x1080 のシェア画像を作る */
  function makeCard(o) {
    const S = 1080;
    const cv = document.createElement("canvas");
    cv.width = S; cv.height = S;
    const c = cv.getContext("2d");

    // 背景グラデ
    const bg = c.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, "#ffd9a0");
    bg.addColorStop(0.5, "#ff9e7a");
    bg.addColorStop(1, "#ff7a59");
    c.fillStyle = bg; c.fillRect(0, 0, S, S);

    // うっすら光の玉
    c.fillStyle = "rgba(255,255,255,.12)";
    [[200, 240, 120], [880, 180, 80], [930, 820, 140], [160, 880, 90]].forEach(([x, y, r]) => {
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    });

    // ロゴ
    c.textAlign = "center";
    c.fillStyle = "#fff";
    c.font = "900 72px 'M PLUS Rounded 1c', sans-serif";
    c.fillText("愛犬ダッシュ", S / 2, 130);

    // 犬を白い円の中に
    const cx = S / 2, cy = 420, R = 220;
    c.save();
    c.shadowColor = "rgba(0,0,0,.25)"; c.shadowBlur = 30; c.shadowOffsetY = 12;
    c.fillStyle = "#fffdf9";
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    c.restore();
    if (o.dog) {
      c.save();
      c.beginPath(); c.arc(cx, cy, R - 12, 0, Math.PI * 2); c.clip();
      const dw = o.dog.width, dh = o.dog.height;
      const fit = Math.min((R * 1.8) / dw, (R * 1.8) / dh);
      const w = dw * fit, h = dh * fit;
      c.drawImage(o.dog, cx - w / 2, cy - h / 2, w, h);
      c.restore();
    }

    // 名前
    const name = (o.name || "").trim();
    c.fillStyle = "#fff";
    c.font = "800 52px 'M PLUS Rounded 1c', sans-serif";
    c.fillText(name ? name + " が走った！" : "走った きろく", S / 2, 720);

    // 距離（大）
    c.fillStyle = "#fff";
    c.font = "900 170px 'M PLUS Rounded 1c', sans-serif";
    c.fillText(String(o.dist), S / 2 - 30, 850 + 60);
    c.font = "800 64px 'M PLUS Rounded 1c', sans-serif";
    c.textAlign = "left";
    c.fillText("m", S / 2 + measure(c, String(o.dist), 170) / 2 - 20, 850 + 60);
    c.textAlign = "center";

    // ベスト＆コイン
    c.font = "700 40px 'M PLUS Rounded 1c', sans-serif";
    c.fillStyle = "rgba(255,255,255,.95)";
    c.fillText("🦴 " + o.coins + "    BEST " + o.best + " m", S / 2, 985);

    // フッターURL
    c.font = "700 34px 'M PLUS Rounded 1c', sans-serif";
    c.fillStyle = "rgba(255,255,255,.8)";
    c.fillText(SITE, S / 2, 1045);

    return cv;
  }

  function measure(c, text, size) {
    c.save();
    c.font = "900 " + size + "px 'M PLUS Rounded 1c', sans-serif";
    const w = c.measureText(text).width;
    c.restore();
    return w;
  }

  function toBlob(canvas) {
    return new Promise((res) => canvas.toBlob(res, "image/png"));
  }

  async function save(canvas) {
    const blob = await toBlob(canvas);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "aiken-dash.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function share(canvas, text) {
    const blob = await toBlob(canvas);
    const file = new File([blob], "aiken-dash.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return true; }
      catch (e) { return false; } // ユーザーがキャンセル
    }
    // 共有非対応端末は保存にフォールバック
    await save(canvas);
    return false;
  }

  // ===== 紙吹雪（全画面オーバーレイに1.6秒だけ降らせる） =====
  function confetti() {
    const cv = document.createElement("canvas");
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    const W = cv.width = global.innerWidth, H = cv.height = global.innerHeight;
    const colors = ["#ff7a59", "#ff6f91", "#4cc4c9", "#ffd23f", "#7bbf56", "#fff"];
    const N = 140;
    const ps = [];
    for (let i = 0; i < N; i++) {
      ps.push({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.5,
        vx: (Math.random() - 0.5) * 4, vy: 3 + Math.random() * 5,
        s: 6 + Math.random() * 8, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        color: colors[i % colors.length],
      });
    }
    let frames = 0;
    function tick() {
      c.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.rot += p.vr;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillStyle = p.color; c.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        c.restore();
      }
      frames++;
      if (frames < 110) requestAnimationFrame(tick);
      else cv.remove();
    }
    tick();
  }

  global.Share = { makeCard, save, share, confetti };
})(window);
