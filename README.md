# うちの子ダッシュ 🐕💨

あなたの愛犬の写真（または用意したキャラ）が自動で走り続けるランゲーム。
**タップでジャンプ**して障害物をよけ、骨🦴を拾いながら、どこまで走れるかを競います。

- **Web版**（このリポジトリ）… ブラウザでそのまま遊べる。GitHub Pages で公開済み。
- **Android版** … 同じコードを [Capacitor](https://capacitorjs.com/) で包んでアプリ化（下記）。

▶ **遊ぶ:** https://tmk4men.github.io/aiken-tobu/

## 遊び方

1. **写真でつくる**（カメラ/ファイル）→ 走らせる範囲をトリミング、または **キャラをえらぶ**
2. タップでスタート＆ジャンプ。空中でもう一度タップで **ダブルジャンプ**
3. 岩・茂み・倒木などをよけ、骨🦴を拾う。走るほどスピードアップ
4. ぶつかったら終了。**飛距離(m)** がスコア。自己ベストを更新しよう

## ローカルで動かす

```bash
npx serve .        # または  python -m http.server 8000
```

## GitHub Pages 更新

```bash
git add -A
git commit -m "更新"
git push
```
push するだけで自動反映されます（数十秒）。
アセットは `?v=N` でキャッシュバスターしているので、変更時はバージョンを上げると確実に反映されます。

## Android アプリにする（Capacitor）

事前に必要: **Node.js / Android Studio（JDK 17）**

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "うちの子ダッシュ" com.example.uchinokodash --web-dir .
npx cap add android
npx cap sync
npx cap open android
```
Android Studio で実機/エミュレータに ▶ Run。配布用は **Build → Generate Signed Bundle / APK**。

## ファイル構成

```
index.html        画面構成 + OGP
style.css         見た目（レスポンシブ / スマホ風フレーム）
js/characters.js  プリセットキャラ（手描き生成）
js/crop.js        写真トリミング
js/game.js        オートランナー本体（物理＋描画）
js/main.js        画面遷移・スコア
ogp.png           シェア用画像(1200x630)
```

## 調整メモ（`js/game.js` 冒頭）

- `BASE_SPEED` / `MAX_ADD` … 走る速さ・加速
- `GRAVITY` / `JUMP_V1` / `JUMP_V2` … ジャンプの重さ・高さ
- `PX_PER_M` … 何pxを1mにするか（スコアの伸び）
