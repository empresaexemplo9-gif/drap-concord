#!/bin/sh
# Abre o DRAP Concord em janela própria (modo app) no navegador do sistema.
URL="https://drap-concord.vercel.app/?origem=linux"
for b in google-chrome-stable google-chrome chromium chromium-browser microsoft-edge-stable microsoft-edge brave-browser vivaldi-stable opera; do
  if command -v "$b" >/dev/null 2>&1; then
    exec "$b" --app="$URL" --class=DRAPConcord "$@"
  fi
done
# Chromium instalado pelo Flatpak
if command -v flatpak >/dev/null 2>&1 && flatpak info org.chromium.Chromium >/dev/null 2>&1; then
  exec flatpak run org.chromium.Chromium --app="$URL" --class=DRAPConcord
fi
exec xdg-open "$URL"
