/* =========================================================
   crop.js  ―  写真の「飛ばす範囲」を指でなぞって選ぶUI
   画像を表示し、指（マウス）でぐるっと囲んだ形に切り抜く。
   決定すると、なぞった輪郭の内側だけを切り出した（背景透明の）
   <canvas> を返す。
   ========================================================= */
(function (global) {
  "use strict";

  const stage = document.getElementById("crop-stage");
  const canvas = document.getElementById("crop-canvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("crop-overlay");
  const octx = overlay.getContext("2d");
  const okBtn = document.getElementById("btn-crop-ok");

  let img = null;            // 読み込んだ画像（必要なら縮小した作業用キャンバス）
  let view = { w: 0, h: 0 }; // キャンバスの表示サイズ(px)
  let points = [];           // なぞった軌跡（表示座標）
  let closed = false;        // なぞり終わったか
  let onDoneCb = null;

  const MAX_SRC = 1600;      // 作業用にこのサイズまで縮小（iOSのcanvas上限/メモリ対策）
  const MIN_POINTS = 8;      // これ未満は「なぞれてない」とみなす

  /** 大きな写真は長辺 MAX_SRC まで縮小した作業用キャンバスにして使う */
  function toWorkingSource(image) {
    const long = Math.max(image.width, image.height);
    if (long <= MAX_SRC) return image;
    const r = MAX_SRC / long;
    const work = document.createElement("canvas");
    work.width = Math.round(image.width * r);
    work.height = Math.round(image.height * r);
    work.getContext("2d").drawImage(image, 0, 0, work.width, work.height);
    return work;
  }

  /** 画像を読み込み、なぞりUIを初期化する */
  function load(src, onDone) {
    onDoneCb = onDone;
    const loaded = new Image();
    loaded.onload = () => {
      img = toWorkingSource(loaded);

      // 画面に収まるサイズを計算（CSSの上限と合わせる）
      const maxW = stage.parentElement.clientWidth || window.innerWidth;
      const maxH = window.innerHeight * 0.62;
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      view.w = Math.round(img.width * ratio);
      view.h = Math.round(img.height * ratio);

      canvas.width = view.w;
      canvas.height = view.h;
      canvas.style.width = view.w + "px";
      canvas.style.height = view.h + "px";
      ctx.drawImage(img, 0, 0, view.w, view.h);

      overlay.width = view.w;
      overlay.height = view.h;
      overlay.style.width = view.w + "px";
      overlay.style.height = view.h + "px";

      reset();
    };
    loaded.src = src;
  }

  /** なぞりをまっさらに戻す */
  function reset() {
    points = [];
    closed = false;
    okBtn.disabled = true;
    octx.clearRect(0, 0, view.w, view.h);
  }

  // ===== なぞり操作 =====
  let drawing = false;

  function pointFromEvent(e) {
    const r = overlay.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    // 表示は縮小されている場合があるので実ピクセルへ換算
    const sx = overlay.width / r.width;
    const sy = overlay.height / r.height;
    // 画像の外を選ばないようキャンバス内にクランプ
    const x = Math.max(0, Math.min(view.w, (t.clientX - r.left) * sx));
    const y = Math.max(0, Math.min(view.h, (t.clientY - r.top) * sy));
    return { x, y };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    closed = false;
    points = [pointFromEvent(e)];
    okBtn.disabled = true;
    redraw();
  }

  function moveDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    const last = points[points.length - 1];
    // 細かすぎる点は間引く
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 3) {
      points.push(p);
      redraw();
    }
  }

  function endDraw() {
    if (!drawing) return;
    drawing = false;
    closed = true;
    okBtn.disabled = points.length < MIN_POINTS;
    redraw();
  }

  /** なぞった軌跡をパスとして octx に積む */
  function tracePath(c) {
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y);
  }

  /** オーバーレイを描き直す（外側を暗く＋輪郭線） */
  function redraw() {
    octx.clearRect(0, 0, view.w, view.h);
    if (points.length < 2) return;

    // 外側を暗くして、なぞった内側だけ明るく見せる
    octx.save();
    octx.fillStyle = "rgba(0,0,0,.5)";
    octx.fillRect(0, 0, view.w, view.h);
    octx.globalCompositeOperation = "destination-out";
    tracePath(octx);
    octx.closePath();
    octx.fill();
    octx.restore();

    // 輪郭線
    octx.save();
    tracePath(octx);
    if (closed) octx.closePath();
    octx.lineJoin = "round";
    octx.lineCap = "round";
    octx.lineWidth = 3;
    octx.strokeStyle = "#fff";
    octx.setLineDash([9, 7]);
    octx.stroke();
    octx.restore();
  }

  /** なぞった形で元画像から切り出した canvas（背景透明）を返す */
  function getCroppedCanvas() {
    const scale = img.width / view.w; // 表示→元画像 への倍率

    // 元画像座標での外接矩形
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      const sx = p.x * scale, sy = p.y * scale;
      if (sx < minX) minX = sx;
      if (sy < minY) minY = sy;
      if (sx > maxX) maxX = sx;
      if (sy > maxY) maxY = sy;
    }
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);

    // 出力は最大256pxに正規化（ゲーム用スプライト）
    const maxOut = 256;
    const r = Math.min(maxOut / bw, maxOut / bh, 1);
    const out = document.createElement("canvas");
    out.width = Math.round(bw * r);
    out.height = Math.round(bh * r);
    const oc = out.getContext("2d");

    // なぞった形でクリップ（外接矩形の左上を原点に）
    oc.beginPath();
    oc.moveTo((points[0].x * scale - minX) * r, (points[0].y * scale - minY) * r);
    for (let i = 1; i < points.length; i++) {
      oc.lineTo((points[i].x * scale - minX) * r, (points[i].y * scale - minY) * r);
    }
    oc.closePath();
    oc.clip();

    oc.drawImage(img, minX, minY, bw, bh, 0, 0, out.width, out.height);
    return out;
  }

  function confirm() {
    if (closed && points.length >= MIN_POINTS && onDoneCb) onDoneCb(getCroppedCanvas());
  }

  // マウス
  overlay.addEventListener("mousedown", startDraw);
  window.addEventListener("mousemove", moveDraw);
  window.addEventListener("mouseup", endDraw);
  // タッチ
  overlay.addEventListener("touchstart", startDraw, { passive: false });
  window.addEventListener("touchmove", moveDraw, { passive: false });
  window.addEventListener("touchend", endDraw);

  global.Crop = { load, confirm, reset };
})(window);
