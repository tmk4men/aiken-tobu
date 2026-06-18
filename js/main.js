/* =========================================================
   main.js  ―  画面遷移と全体制御（うちの子ダッシュ）
   タイトル → (写真トリミング | キャラ選択) → プレイ → リザルト
   ========================================================= */
(function () {
  "use strict";

  const screens = {
    title: document.getElementById("screen-title"),
    select: document.getElementById("screen-select"),
    crop: document.getElementById("screen-crop"),
    play: document.getElementById("screen-play"),
    result: document.getElementById("screen-result"),
  };
  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ===== ハイスコア =====
  const BEST_KEY = "uchinoko-dash-best";
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
  document.getElementById("title-best").textContent = best;
  Game.setBest(best);

  // タイトルの犬
  (function () {
    const c = document.getElementById("title-dog");
    Characters.drawDog(c.getContext("2d"), Characters.ROSTER[0].opts, c.width);
  })();

  // ===== タイトル操作 =====
  const fileInput = document.getElementById("file-input");
  document.getElementById("btn-photo").addEventListener("click", () => fileInput.click());
  document.getElementById("btn-select").addEventListener("click", () => { buildCharGrid(); show("select"); });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { show("crop"); Crop.load(reader.result, onCropDone); };
    reader.readAsDataURL(file);
    fileInput.value = "";
  });

  // ===== キャラ選択 =====
  const charGrid = document.getElementById("char-grid");
  const selectPlayBtn = document.getElementById("btn-select-play");
  let selectedOpts = null, gridBuilt = false;

  function buildCharGrid() {
    if (gridBuilt) return;
    gridBuilt = true;
    Characters.ROSTER.forEach((ch, i) => {
      const card = document.createElement("button");
      card.className = "char-card";
      card.style.animationDelay = (i * 0.05) + "s";
      card.appendChild(Characters.makeSprite(ch.opts, 192));
      const name = document.createElement("span");
      name.className = "cname";
      name.textContent = ch.name;
      card.appendChild(name);
      card.addEventListener("click", () => {
        charGrid.querySelectorAll(".char-card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedOpts = ch.opts;
        selectPlayBtn.disabled = false;
      });
      charGrid.appendChild(card);
    });
  }

  document.getElementById("btn-select-back").addEventListener("click", () => show("title"));
  selectPlayBtn.addEventListener("click", () => {
    if (!selectedOpts) return;
    Game.setDog(Characters.makeSprite(selectedOpts, 220));
    startPlay();
  });

  // ===== トリミング =====
  document.getElementById("btn-crop-ok").addEventListener("click", () => Crop.confirm());
  document.getElementById("btn-crop-back").addEventListener("click", () => show("title"));
  function onCropDone(croppedCanvas) { Game.setDog(croppedCanvas); startPlay(); }

  // ===== プレイ =====
  const hudDist = document.getElementById("hud-dist");
  const hudCoins = document.getElementById("hud-coins");
  const tapBtn = document.getElementById("btn-tap");
  const tapText = document.getElementById("tap-text");

  function startPlay() {
    show("play");
    Game.reset();
    Game.start();
    updateHudLoop();
  }

  function updateHudLoop() {
    if (!screens.play.classList.contains("active")) return;
    hudDist.textContent = Math.round(Game.distance);
    hudCoins.textContent = Game.coins;
    const phase = Game.phase;
    if (phase === "idle") tapText.textContent = "タップでスタート";
    else if (phase === "running") tapText.textContent = Game.distance < 28 ? "タップでジャンプ！" : "";
    else tapText.textContent = "";
    requestAnimationFrame(updateHudLoop);
  }

  tapBtn.addEventListener("click", (e) => { e.preventDefault(); Game.tap(); });

  // ===== リザルト =====
  const rDist = document.getElementById("result-dist");
  const rCoins = document.getElementById("result-coins");
  const rBest = document.getElementById("result-best");
  const rCap = document.getElementById("result-cap");

  Game.onResult((dist, gameBest, coins) => {
    rDist.textContent = dist;
    rCoins.textContent = "🦴 " + coins;
    if (gameBest > best) {
      best = gameBest;
      localStorage.setItem(BEST_KEY, String(best));
      document.getElementById("title-best").textContent = best;
      rCap.textContent = "🎉 しんきろく！";
      rBest.textContent = "BEST " + best + " m";
    } else {
      rCap.textContent = "きろく";
      rBest.textContent = "BEST " + best + " m";
    }
    show("result");
  });

  document.getElementById("btn-retry").addEventListener("click", () => startPlay());
  document.getElementById("btn-newphoto").addEventListener("click", () => show("title"));

  show("title");
})();
