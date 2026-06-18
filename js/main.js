/* =========================================================
   main.js  ―  画面遷移と全体の制御
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
  const BEST_KEY = "aiken-tobu-best";
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
  document.getElementById("title-best").textContent = best;
  Game.setBest(best);

  // ===== タイトルの犬を描く（アニメ用スプライト） =====
  (function drawTitleDog() {
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
  let selectedOpts = null;
  let gridBuilt = false;

  function buildCharGrid() {
    if (gridBuilt) return;
    gridBuilt = true;
    Characters.ROSTER.forEach((ch, i) => {
      const card = document.createElement("button");
      card.className = "char-card";
      card.style.animationDelay = (i * 0.05) + "s";
      const sprite = Characters.makeSprite(ch.opts, 192);
      sprite.className = "csprite";
      card.appendChild(sprite);
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
  const hudBest = document.getElementById("hud-best");
  const meters = document.getElementById("meters");
  const powerFill = document.getElementById("power-fill");
  const angleFill = document.getElementById("angle-fill");
  const tapBtn = document.getElementById("btn-tap");
  const tapText = document.getElementById("tap-text");

  function startPlay() {
    show("play");
    Game.reset();
    Game.start();
    hudBest.textContent = best;
    updateHudLoop();
  }

  function updateHudLoop() {
    if (!screens.play.classList.contains("active")) return;
    hudDist.textContent = Math.round(Game.distance);
    const phase = Game.phase;

    if (phase === "power" || phase === "angle") {
      meters.classList.remove("hidden");
      powerFill.style.width = (Game.power * 100) + "%";
      angleFill.style.width = (Game.angle * 100) + "%";
    } else {
      meters.classList.add("hidden");
    }

    if (phase === "idle") tapText.textContent = "タップでスタート";
    else if (phase === "power") tapText.textContent = "タップでパワー決定！";
    else if (phase === "angle") tapText.textContent = "タップで角度決定！";
    else if (phase === "flying") tapText.textContent = Game.boostUsed ? "" : "タップでブースト！";
    else tapText.textContent = "";

    requestAnimationFrame(updateHudLoop);
  }

  tapBtn.addEventListener("click", (e) => { e.preventDefault(); Game.tap(); });

  // ===== リザルト =====
  Game.onResult((dist, gameBest) => {
    document.getElementById("result-dist").textContent = dist;
    const rb = document.getElementById("result-best");
    const emoji = document.getElementById("result-emoji");
    if (gameBest > best) {
      best = gameBest;
      localStorage.setItem(BEST_KEY, String(best));
      rb.textContent = "🎉 自己ベスト更新！";
      emoji.textContent = "🏆";
      document.getElementById("title-best").textContent = best;
    } else {
      rb.textContent = "ベスト " + best + " m";
      emoji.textContent = dist >= best * 0.8 ? "😆" : "🐕";
    }
    setTimeout(() => show("result"), 650);
  });

  document.getElementById("btn-retry").addEventListener("click", () => startPlay());
  document.getElementById("btn-newphoto").addEventListener("click", () => show("title"));

  show("title");
})();
