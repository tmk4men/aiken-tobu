/* =========================================================
   characters.js  ―  プリセットのキャラクター（犬）たち
   愛犬の写真がない人向け。canvasに手描きでかわいい犬を生成する。
   各キャラは drawDog() のパラメータ違い。makeSprite() で
   ゲーム用スプライト(canvas)を返す。
   ========================================================= */
(function (global) {
  "use strict";

  /** 1キャラ分の絵を square canvas の中央に描く */
  function drawDog(g, o, S) {
    const cx = S / 2;
    const cy = S * 0.52;
    const headR = S * 0.27;

    g.save();
    g.lineJoin = "round";
    g.lineCap = "round";

    // ---- 体（頭のうしろ） ----
    g.fillStyle = o.coat;
    ellipse(g, cx, cy + headR * 0.95, headR * 0.92, headR * 0.78);

    // 足
    g.fillStyle = shade(o.coat, -12);
    ellipse(g, cx - headR * 0.5, cy + headR * 1.55, headR * 0.22, headR * 0.16);
    ellipse(g, cx + headR * 0.5, cy + headR * 1.55, headR * 0.22, headR * 0.16);

    // しっぽ
    g.save();
    g.translate(cx + headR * 0.82, cy + headR * 0.8);
    g.rotate(-0.5);
    g.fillStyle = o.coat;
    ellipse(g, 0, -headR * 0.3, headR * 0.16, headR * 0.34);
    g.restore();

    // ---- 耳（頭より先に描く＝後ろ側） ----
    drawEars(g, o, cx, cy, headR, true);

    // ---- 頭 ----
    g.fillStyle = o.coat;
    circle(g, cx, cy, headR);

    // ぶち模様
    if (o.spots) {
      g.fillStyle = o.spotColor || shade(o.coat, -30);
      ellipse(g, cx - headR * 0.45, cy - headR * 0.2, headR * 0.32, headR * 0.34);
      ellipse(g, cx + headR * 0.55, cy + headR * 0.35, headR * 0.22, headR * 0.2);
    }

    // 耳（手前側）
    drawEars(g, o, cx, cy, headR, false);

    // ---- マズル（口まわり） ----
    g.fillStyle = o.muzzle || lighten(o.coat, 28);
    ellipse(g, cx, cy + headR * 0.42, headR * 0.56, headR * 0.46);

    // ほっぺ（ピンク）
    g.fillStyle = "rgba(255,140,150,0.35)";
    circle(g, cx - headR * 0.62, cy + headR * 0.32, headR * 0.16);
    circle(g, cx + headR * 0.62, cy + headR * 0.32, headR * 0.16);

    // ---- 目 ----
    const eyeY = cy - headR * 0.02;
    const eyeDX = headR * 0.42;
    g.fillStyle = "#2b2320";
    circle(g, cx - eyeDX, eyeY, headR * 0.15);
    circle(g, cx + eyeDX, eyeY, headR * 0.15);
    // ハイライト
    g.fillStyle = "#fff";
    circle(g, cx - eyeDX + headR * 0.05, eyeY - headR * 0.05, headR * 0.05);
    circle(g, cx + eyeDX + headR * 0.05, eyeY - headR * 0.05, headR * 0.05);

    // ---- 鼻と口 ----
    g.fillStyle = "#2b2320";
    const noseY = cy + headR * 0.26;
    roundedNose(g, cx, noseY, headR * 0.13);
    g.strokeStyle = "#2b2320";
    g.lineWidth = Math.max(2, headR * 0.05);
    g.beginPath();
    g.moveTo(cx, noseY + headR * 0.12);
    g.lineTo(cx, noseY + headR * 0.24);
    g.moveTo(cx, noseY + headR * 0.24);
    g.quadraticCurveTo(cx - headR * 0.16, noseY + headR * 0.36, cx - headR * 0.26, noseY + headR * 0.24);
    g.moveTo(cx, noseY + headR * 0.24);
    g.quadraticCurveTo(cx + headR * 0.16, noseY + headR * 0.36, cx + headR * 0.26, noseY + headR * 0.24);
    g.stroke();

    // ---- アクセサリー ----
    if (o.accessory === "bandana") drawBandana(g, o, cx, cy, headR);
    if (o.accessory === "crown") drawCrown(g, cx, cy, headR);
    if (o.accessory === "glasses") drawGlasses(g, cx, eyeY, eyeDX, headR);
    if (o.accessory === "cap") drawCap(g, o, cx, cy, headR);

    g.restore();
  }

  function drawEars(g, o, cx, cy, headR, back) {
    g.fillStyle = o.earColor || shade(o.coat, -18);
    const style = o.ear || "floppy";
    if (style === "pointy") {
      if (!back) return; // とんがり耳は後ろ側だけ描く
      triangle(g, cx - headR * 0.72, cy - headR * 0.55, headR * 0.46, headR * 0.95, -0.35);
      triangle(g, cx + headR * 0.72, cy - headR * 0.55, headR * 0.46, headR * 0.95, 0.35);
    } else if (style === "round") {
      if (back) return;
      circle(g, cx - headR * 0.78, cy - headR * 0.55, headR * 0.42);
      circle(g, cx + headR * 0.78, cy - headR * 0.55, headR * 0.42);
    } else { // floppy（垂れ耳）
      if (!back) return;
      g.save();
      g.translate(cx - headR * 0.85, cy - headR * 0.2); g.rotate(-0.2);
      ellipse(g, 0, headR * 0.35, headR * 0.3, headR * 0.62); g.restore();
      g.save();
      g.translate(cx + headR * 0.85, cy - headR * 0.2); g.rotate(0.2);
      ellipse(g, 0, headR * 0.35, headR * 0.3, headR * 0.62); g.restore();
    }
  }

  // ----- アクセサリー -----
  function drawBandana(g, o, cx, cy, r) {
    g.fillStyle = o.accentColor || "#ef5350";
    g.beginPath();
    g.moveTo(cx - r * 0.95, cy + r * 0.78);
    g.lineTo(cx + r * 0.95, cy + r * 0.78);
    g.lineTo(cx, cy + r * 1.45);
    g.closePath();
    g.fill();
    // ドット
    g.fillStyle = "#fff";
    circle(g, cx - r * 0.2, cy + r * 0.95, r * 0.06);
    circle(g, cx + r * 0.25, cy + r * 1.02, r * 0.06);
    circle(g, cx, cy + r * 1.18, r * 0.06);
  }
  function drawCrown(g, cx, cy, r) {
    const y = cy - r * 1.05;
    g.fillStyle = "#ffd54f";
    g.strokeStyle = "#f9a825";
    g.lineWidth = r * 0.04;
    g.beginPath();
    g.moveTo(cx - r * 0.5, y + r * 0.35);
    g.lineTo(cx - r * 0.5, y - r * 0.05);
    g.lineTo(cx - r * 0.22, y + r * 0.18);
    g.lineTo(cx, y - r * 0.22);
    g.lineTo(cx + r * 0.22, y + r * 0.18);
    g.lineTo(cx + r * 0.5, y - r * 0.05);
    g.lineTo(cx + r * 0.5, y + r * 0.35);
    g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = "#ef5350";
    circle(g, cx, y + r * 0.12, r * 0.07);
  }
  function drawGlasses(g, cx, eyeY, eyeDX, r) {
    g.strokeStyle = "#3b3b3b";
    g.lineWidth = r * 0.07;
    g.beginPath();
    g.arc(cx - eyeDX, eyeY, r * 0.26, 0, Math.PI * 2);
    g.arc(cx + eyeDX, eyeY, r * 0.26, 0, Math.PI * 2);
    g.moveTo(cx - eyeDX + r * 0.26, eyeY);
    g.lineTo(cx + eyeDX - r * 0.26, eyeY);
    g.stroke();
  }
  function drawCap(g, o, cx, cy, r) {
    const y = cy - r * 0.85;
    g.fillStyle = o.accentColor || "#42a5f5";
    g.beginPath();
    g.arc(cx, y, r * 0.6, Math.PI, 0);
    g.closePath();
    g.fill();
    g.fillRect(cx - r * 0.6, y - 1, r * 0.95, r * 0.16); // つば
    g.fillStyle = "#fff";
    circle(g, cx, y - r * 0.45, r * 0.08);
  }

  // ----- 図形ヘルパ -----
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  function triangle(g, x, y, w, h, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath(); g.moveTo(-w / 2, h / 2); g.lineTo(w / 2, h / 2); g.lineTo(0, -h / 2); g.closePath(); g.fill();
    g.restore();
  }
  function roundedNose(g, x, y, r) {
    g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
  }

  // ----- 色ヘルパ -----
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbToHex(r, g, b) { return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join(""); }
  function shade(hex, p) { const [r, g, b] = hexToRgb(hex); return rgbToHex(r + p, g + p, b + p); }
  function lighten(hex, p) { return shade(hex, p); }

  /** ゲーム用スプライト(canvas)を作る */
  function makeSprite(opts, size) {
    const S = size || 220;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    drawDog(c.getContext("2d"), opts, S);
    return c;
  }

  // ===== キャラクター一覧 =====
  const ROSTER = [
    { id: "shiba",  name: "しばっち", opts: { coat: "#e3a86b", ear: "pointy", muzzle: "#fbe7cf", accessory: "bandana", accentColor: "#ef5350" } },
    { id: "kuro",   name: "くろまる", opts: { coat: "#5a5350", ear: "pointy", muzzle: "#cdbcae" } },
    { id: "poodle", name: "もこ",     opts: { coat: "#efe3cf", ear: "round", muzzle: "#fff6ea", earColor: "#e4d4ba", accessory: "crown" } },
    { id: "dalmat", name: "ぶちお",   opts: { coat: "#f4f1ee", ear: "floppy", muzzle: "#ffffff", earColor: "#3a3a3a", spots: true, spotColor: "#3a3a3a" } },
    { id: "beagle", name: "ハッチ",   opts: { coat: "#d9b48a", ear: "floppy", muzzle: "#f6ead7", earColor: "#7a5230", spots: true, spotColor: "#7a5230", accessory: "cap", accentColor: "#42a5f5" } },
    { id: "chihua", name: "ちび",     opts: { coat: "#e8c79a", ear: "pointy", muzzle: "#fbeede", accessory: "glasses" } },
    { id: "husky",  name: "ゆき",     opts: { coat: "#cfd8e3", ear: "pointy", muzzle: "#ffffff", earColor: "#6b7785", spots: true, spotColor: "#6b7785" } },
    { id: "pink",   name: "ももた",   opts: { coat: "#f6c6d0", ear: "floppy", muzzle: "#fff0f3", earColor: "#ef9aac", accessory: "crown" } },
  ];

  global.Characters = { makeSprite, drawDog, ROSTER };
})(window);
