#!/bin/sh
# Gera os instaladores de Linux (.deb e .tar.gz) e macOS (.zip com o app),
# todos com o ícone original. Requer dpkg-deb, zip e Python 3.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
OUT=${1:-$ROOT/public/downloads}
VERSION=1.0.0
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT
ICONS=$ROOT/public/icons

# ---------- Linux: .deb ----------
D=$W/deb
mkdir -p "$D/DEBIAN" "$D/usr/bin" "$D/usr/share/applications"
install -m 755 "$HERE/drap-concord.sh" "$D/usr/bin/drap-concord"
install -m 644 "$HERE/drap-concord.desktop" "$D/usr/share/applications/drap-concord.desktop"
for s in 48 128 256 512; do
  mkdir -p "$D/usr/share/icons/hicolor/${s}x${s}/apps"
  install -m 644 "$ICONS/icon-$s.png" "$D/usr/share/icons/hicolor/${s}x${s}/apps/drap-concord.png"
done
mkdir -p "$D/usr/share/icons/hicolor/scalable/apps" && install -m 644 "$ICONS/icon.svg" "$D/usr/share/icons/hicolor/scalable/apps/drap-concord.svg"
cat > "$D/DEBIAN/control" <<CTRL
Package: drap-concord
Version: $VERSION
Section: office
Priority: optional
Architecture: all
Depends: xdg-utils
Recommends: chromium | chromium-browser | google-chrome-stable | microsoft-edge-stable
Maintainer: DRAP Concord <contato@drapconcord.app>
Homepage: https://drap-concord.vercel.app
Description: DRAP Concord: agenda, atendimentos e chamadas de vídeo
 Abre a plataforma DRAP Concord em janela própria, com ícone no menu de
 aplicativos. Usa o navegador Chromium, Chrome, Edge ou Brave do sistema.
CTRL
printf '#!/bin/sh\ncommand -v update-desktop-database >/dev/null && update-desktop-database -q || true\ncommand -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q /usr/share/icons/hicolor || true\n' > "$D/DEBIAN/postinst"
chmod 755 "$D/DEBIAN/postinst"
dpkg-deb --root-owner-group --build "$D" "$OUT/drap-concord_${VERSION}_all.deb" >/dev/null

# ---------- Linux: .tar.gz (Fedora, Arch e outras) ----------
T=$W/drap-concord
mkdir -p "$T"
cp "$HERE/drap-concord.sh" "$T/drap-concord" && chmod 755 "$T/drap-concord"
cp "$HERE/drap-concord.desktop" "$ICONS/icon-256.png" "$T/"
cat > "$T/instalar.sh" <<'INST'
#!/bin/sh
# Instala o DRAP Concord para o usuário atual (sem precisar de administrador).
set -e
cd "$(dirname "$0")"
mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/256x256/apps"
install -m 755 drap-concord "$HOME/.local/bin/drap-concord"
install -m 644 icon-256.png "$HOME/.local/share/icons/hicolor/256x256/apps/drap-concord.png"
sed "s|^Exec=.*|Exec=$HOME/.local/bin/drap-concord|" drap-concord.desktop > "$HOME/.local/share/applications/drap-concord.desktop"
command -v update-desktop-database >/dev/null && update-desktop-database -q "$HOME/.local/share/applications" || true
echo "DRAP Concord instalado. Procure por \"DRAP Concord\" no menu de aplicativos."
INST
chmod 755 "$T/instalar.sh"
tar -C "$W" -czf "$OUT/drap-concord-linux.tar.gz" drap-concord

# ---------- macOS: DRAP Concord.app ----------
A="$W/mac/DRAP Concord.app/Contents"
mkdir -p "$A/MacOS" "$A/Resources"
cat > "$A/MacOS/DRAP Concord" <<'MAC'
#!/bin/sh
# Abre o DRAP Concord em janela própria (modo app) no Chrome, Edge ou Brave;
# sem eles, no Safari.
URL="https://drap-concord.vercel.app/?origem=mac"
for app in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium" "Vivaldi"; do
  if [ -d "/Applications/$app.app" ] || [ -d "$HOME/Applications/$app.app" ]; then
    exec open -na "$app" --args --app="$URL"
  fi
done
exec open "$URL"
MAC
chmod 755 "$A/MacOS/DRAP Concord"
cat > "$A/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>DRAP Concord</string>
  <key>CFBundleDisplayName</key><string>DRAP Concord</string>
  <key>CFBundleIdentifier</key><string>app.drapconcord.mac</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>DRAP Concord</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
python3 -I "$HERE/icns.py" "$ICONS" "$A/Resources/AppIcon.icns"
(cd "$W/mac" && zip -qry "$OUT/DRAP-Concord-macOS.zip" "DRAP Concord.app")

echo "Linux e macOS prontos em $OUT"
