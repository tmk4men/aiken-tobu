# 署名付き release AAB を生成する。
# 事前準備（初回のみ）:
#   1) キーストア作成（パスワードは自分で決める）:
#      & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" `
#        -genkeypair -v -keystore android\aiken-dash-release.keystore `
#        -alias aiken-dash -keyalg RSA -keysize 2048 -validity 10000
#   2) android\keystore.properties を作成（android\keystore.properties.example 参照）
#   ※ キーストアは必ずバックアップ。紛失するとアプリ更新が二度とできません。
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
node scripts/copy-web.js
npx cap sync android
Set-Location (Join-Path $root "android")
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
.\gradlew.bat bundleRelease --no-daemon
Write-Host ""
Write-Host "AAB: android\app\build\outputs\bundle\release\app-release.aab"
