#!/bin/sh
# Gera os .exe do Windows (x64 e ARM64) com o ícone original. Requer Go.
set -eu
cd "$(dirname "$0")"
OUT=${1:-../../public/downloads}
go run github.com/tc-hib/go-winres@v0.3.3 make --in winres/winres.json --arch amd64,arm64
for arch in amd64:x64 arm64:ARM64; do
  GOOS=windows GOARCH=${arch%%:*} CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o "$OUT/DRAP-Concord-Windows-${arch##*:}.exe" .
done
echo "Windows pronto em $OUT"
