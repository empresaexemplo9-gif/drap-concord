"""Monta o ícone do macOS (.icns) a partir dos PNGs do ícone original."""
import struct
import sys

icons, out = sys.argv[1], sys.argv[2]
# Tipo icns -> tamanho do PNG
types = [("icp4", 16), ("icp5", 32), ("icp6", 48), ("ic07", 128), ("ic08", 256), ("ic09", 512), ("ic10", 1024)]
chunks = b""
for t, size in types:
    path = f"{icons}/icon-{size}.png"
    try:
        data = open(path, "rb").read()
    except FileNotFoundError:
        continue
    chunks += t.encode() + struct.pack(">I", len(data) + 8) + data
open(out, "wb").write(b"icns" + struct.pack(">I", len(chunks) + 8) + chunks)
