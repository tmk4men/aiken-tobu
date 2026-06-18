# 愛犬が飛ぶ 🐕💨

愛犬の写真を撮って範囲を選び、その子を「ぶっ飛ばして」飛距離を競うゲームです。
（昔あった「おばちゃんが飛ぶ」のような遊び方の、愛犬バージョン）

- **Web版**（このリポジトリ）… ブラウザでそのまま遊べる。GitHub Pages で公開して動作確認できる。
- **Android版** … 同じコードを [Capacitor](https://capacitorjs.com/) で包んでアプリ化する（下記）。

## 遊び方

1. **写真をとる / えらぶ** … スマホならカメラ、PCならファイル選択
2. **範囲をえらぶ** … 枠をドラッグ／角でリサイズして、飛ばしたい部分を切り取る
3. タップで **パワー** → もう一度タップで **角度** を決めて発射
4. 空中で1回だけ **タップでブースト**。骨🦴を拾うとさらに加速
5. 止まったところまでの **飛距離** がスコア。自己ベストを更新しよう

写真がなくても「サンプル犬であそぶ」で試せます。

---

## ローカルで動かす

ファイル読み込みの都合で、簡易サーバー経由で開きます。

```bash
# このフォルダで
npx serve .
# または
python -m http.server 8000
```

表示されたURL（例 http://localhost:8000 ）をブラウザで開く。
スマホのカメラを使いたい場合は、後述の GitHub Pages（https） で開くのが確実です。

---

## GitHub Pages で公開（動作確認用）

1. GitHub で新しいリポジトリを作る
2. このフォルダを push する

   ```bash
   git init
   git add .
   git commit -m "愛犬が飛ぶ v1"
   git branch -M main
   git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
   git push -u origin main
   ```

3. リポジトリの **Settings → Pages** で、Source を `main` ブランチの `/ (root)` に設定
4. 数十秒後、`https://<ユーザー名>.github.io/<リポジトリ名>/` で遊べる

> Pages は https なので、スマホのカメラ撮影もそのまま動きます。

---

## Android アプリにする（Capacitor）

Web版をそのままネイティブアプリの中で動かします。Web側のコードは変更不要です。

事前に必要: **Node.js / Android Studio（JDK 17 含む）**

```bash
# 初回だけ
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init "愛犬が飛ぶ" com.example.aikentobu --web-dir .

# Androidプラットフォーム追加
npm install @capacitor/android
npx cap add android

# Web資産を同期して Android Studio を開く
npx cap sync
npx cap open android
```

Android Studio で実機/エミュレータに **Run**（▶）すれば動きます。
配布用APK/AABは Android Studio の **Build → Generate Signed Bundle / APK** から作成します。

> カメラを `<input type="file" capture>` で使っているため、追加の権限プラグインは基本不要です。
> 端末によって権限ダイアログが出たら許可してください。

---

## ファイル構成

```
index.html      画面の枠組み
style.css       見た目
js/crop.js      写真のトリミング（範囲選択）
js/game.js      物理＋描画のゲーム本体
js/main.js      画面遷移とスコア管理
```

## カスタムしたいとき（メモ）

`js/game.js` 冒頭の物理パラメータで手触りが変わります。

- `PX_PER_M` … 何pxを1mとするか（スコアの伸び）
- `G` / `REST` / `FRICTION` … 重力・反発・摩擦
- `BOOST_VX` … 空中ブーストの強さ
