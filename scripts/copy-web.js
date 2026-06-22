/* Webアプリ本体を Capacitor の webDir (www/) に束ねる。
   ルートの静的ファイルを www/ にコピーするだけ。
   ※ OneDrive上では fs.cpSync がクラッシュするため手動再帰コピーを使う。 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const www = path.join(root, "www");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

for (const f of ["index.html", "style.css", "manifest.json"]) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(www, f));
}
for (const d of ["js", "icons"]) {
  const src = path.join(root, d);
  if (fs.existsSync(src)) copyDir(src, path.join(www, d));
}
console.log("web -> www/ done");
