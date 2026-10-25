#!/bin/sh
# Compila o APK Android do DRAP Concord sem Android Studio/Gradle.
# Ferramentas (todas abertas): aapt2 (dentro do Apktool), android.jar da API 34,
# dx (AOSP) e uber-apk-signer (zipalign + apksigner).
#   TOOLS=pasta-com-aapt2_64,android.jar,dx.jar,signer.jar
#   KEYSTORE=chave.jks KEY_ALIAS=concord KEY_PASS=... (a MESMA chave sempre: atualizações dependem dela)
#   sh apps/android/build.sh public/downloads/drap-concord.apk
set -eu
OUT=${1:?informe o arquivo de saída}
HERE=$(cd "$(dirname "$0")" && pwd)
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT

"$TOOLS/aapt2_64" compile --dir "$HERE/res" -o "$W/res.zip"
"$TOOLS/aapt2_64" link -o "$W/base.apk" -I "$TOOLS/android.jar" --manifest "$HERE/AndroidManifest.xml" \
  --min-sdk-version 24 --target-sdk-version 34 --java "$W/gen" "$W/res.zip"
mkdir -p "$W/classes"
javac -nowarn -source 8 -target 8 -bootclasspath "$TOOLS/android.jar" -classpath "$TOOLS/android.jar" -d "$W/classes" \
  $(find "$HERE/src" "$W/gen" -name '*.java') 2>&1 | grep -v "bootstrap class path\|obsolete\|warning" || true
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 --output="$W/classes.dex" "$W/classes"
(cd "$W" && cp base.apk app.apk && zip -q -j app.apk classes.dex)
mkdir -p "$W/signed"
java -jar "$TOOLS/signer.jar" -a "$W/app.apk" -o "$W/signed" --ks "$KEYSTORE" --ksAlias "$KEY_ALIAS" --ksPass "$KEY_PASS" --ksKeyPass "$KEY_PASS" --allowResign >/dev/null
cp "$W"/signed/*.apk "$OUT"
echo "APK pronto: $OUT ($(du -h "$OUT" | cut -f1))"
