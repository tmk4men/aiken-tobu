/* =========================================================
   crop.js  ―  写真の「飛ばす範囲」を選ぶトリミングUI
   画像を表示し、ドラッグで移動・角でリサイズできる枠を出す。
   決定すると、その範囲を切り出した <canvas> を返す。
   ========================================================= */
(function (global) {
  "use strict";

  const stage = document.getElementById("crop-stage");
  const canvas = document.getElementById("crop-canvas");
  const ctx = canvas.getContext("2d");
  const box = document.getElementById("crop-box");

  let img = null;          // 読み込んだ画像
  let view = { w: 0, h: 0 }; // キャンバスの表示サイズ(px)
  let sel = { x: 0, y: 0, w: 0, h: 0 }; // 枠（表示座標）
  let onDoneCb = null;

  const MIN = 40; // 枠の最小サイズ(px)

  /** 画像を読み込み、トリミングUIを初期化する */
  function load(src, onDone) {
    onDoneCb = onDone;
    img = new Image();
    img.onload = () => {
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

      // 初期枠は中央 60%
      sel.w = Math.round(view.w * 0.6);
      sel.h = Math.round(view.h * 0.6);
      sel.x = Math.round((view.w - sel.w) / 2);
      sel.y = Math.round((view.h - sel.h) / 2);
      renderBox();
    };
    img.src = src;
  }

  /** 枠のDOM位置を更新 */
  function renderBox() {
    box.style.left = sel.x + "px";
    box.style.top = sel.y + "px";
    box.style.width = sel.w + "px";
    box.style.height = sel.h + "px";
  }

  // ===== ドラッグ操作 =====
  let drag = null; // { mode, startX, startY, orig }

  function pointFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function startDrag(mode, e) {
    e.preventDefault();
    drag = {
      mode,
      start: pointFromEvent(e),
      orig: { ...sel },
    };
  }

  function moveDrag(e) {
    if (!drag) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    const o = drag.orig;

    if (drag.mode === "move") {
      sel.x = clamp(o.x + dx, 0, view.w - sel.w);
      sel.y = clamp(o.y + dy, 0, view.h - sel.h);
    } else {
      // 角リサイズ。mode は tl/tr/bl/br
      let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
      if (drag.mode.includes("l")) x1 = clamp(o.x + dx, 0, x2 - MIN);
      if (drag.mode.includes("r")) x2 = clamp(o.x + o.w + dx, x1 + MIN, view.w);
      if (drag.mode.includes("t")) y1 = clamp(o.y + dy, 0, y2 - MIN);
      if (drag.mode.includes("b")) y2 = clamp(o.y + o.h + dy, y1 + MIN, view.h);
      sel.x = x1; sel.y = y1; sel.w = x2 - x1; sel.h = y2 - y1;
    }
    renderBox();
  }

  function endDrag() { drag = null; }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // 枠本体＝移動
  box.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("handle")) return;
    startDrag("move", e);
  });
  box.addEventListener("touchstart", (e) => {
    if (e.target.classList.contains("handle")) return;
    startDrag("move", e);
  }, { passive: false });

  // 角＝リサイズ
  box.querySelectorAll(".handle").forEach((h) => {
    const mode = h.classList.contains("tl") ? "tl"
      : h.classList.contains("tr") ? "tr"
      : h.classList.contains("bl") ? "bl" : "br";
    h.addEventListener("mousedown", (e) => { e.stopPropagation(); startDrag(mode, e); });
    h.addEventListener("touchstart", (e) => { e.stopPropagation(); startDrag(mode, e); }, { passive: false });
  });

  window.addEventListener("mousemove", moveDrag);
  window.addEventListener("touchmove", moveDrag, { passive: false });
  window.addEventListener("mouseup", endDrag);
  window.addEventListener("touchend", endDrag);

  /** いま選択している範囲を元画像の解像度で切り出して canvas を返す */
  function getCroppedCanvas() {
    const scale = img.width / view.w; // 表示→元画像 への倍率
    const sx = sel.x * scale;
    const sy = sel.y * scale;
    const sw = sel.w * scale;
    const sh = sel.h * scale;

    // 出力は最大256pxに正規化（ゲーム用スプライト）
    const out = document.createElement("canvas");
    const maxOut = 256;
    const r = Math.min(maxOut / sw, maxOut / sh, 1);
    out.width = Math.round(sw * r);
    out.height = Math.round(sh * r);
    out.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out;
  }

  function confirm() {
    if (onDoneCb) onDoneCb(getCroppedCanvas());
  }

  global.Crop = { load, confirm };
})(window);
