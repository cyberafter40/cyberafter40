#!/usr/bin/env python3
"""
Generates MindCode's placeholder app assets.

These are real, valid PNGs so that `expo prebuild` and EAS Build succeed out of
the box — but they are a geometric stand-in, not final brand artwork. Replace
them before submitting to the App Store (see docs/DEPLOYMENT_APPSTORE.md).

The mark is the app's core idea reduced to two shapes: a filled slot (a digit
you have placed) beside an open one (a digit you have not).

    python3 scripts/generate-assets.py
"""

import struct
import zlib
from pathlib import Path

BG = (0x0E, 0x11, 0x16)
ACCENT = (0x7C, 0x6B, 0xFF)
ACCENT_DIM = (0x2A, 0x2F, 0x4A)

ASSETS = Path(__file__).resolve().parent.parent / "assets"


def write_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    """Writes an 8-bit RGB PNG. `pixels` is width*height*3 bytes, row-major."""
    raw = bytearray()
    stride = width * 3
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        raw.extend(pixels[y * stride : (y + 1) * stride])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    path.write_bytes(png)


def rounded_rect(pixels, canvas_w, x0, y0, x1, y1, radius, color, fill=True, thickness=0):
    """Draws a rounded rectangle, filled or as an outline of `thickness` px."""

    def inside(px, py, left, top, right, bottom, r):
        if px < left or px > right or py < top or py > bottom:
            return False
        cx = min(max(px, left + r), right - r)
        cy = min(max(py, top + r), bottom - r)
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r

    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            outer = inside(x, y, x0, y0, x1, y1, radius)
            if not outer:
                continue
            if not fill:
                inner = inside(
                    x,
                    y,
                    x0 + thickness,
                    y0 + thickness,
                    x1 - thickness,
                    y1 - thickness,
                    max(0, radius - thickness),
                )
                if inner:
                    continue
            offset = (y * canvas_w + x) * 3
            pixels[offset : offset + 3] = bytes(color)


def build(width: int, height: int, scale: float = 1.0) -> bytearray:
    pixels = bytearray()
    for _ in range(width * height):
        pixels.extend(BG)

    unit = int(min(width, height) * 0.20 * scale)
    gap = int(unit * 0.28)
    total = unit * 2 + gap
    left = (width - total) // 2
    top = (height - unit) // 2
    radius = int(unit * 0.28)

    # Filled slot — a digit you have placed.
    rounded_rect(pixels, width, left, top, left + unit, top + unit, radius, ACCENT)
    # Open slot — a digit still unknown.
    rounded_rect(
        pixels,
        width,
        left + unit + gap,
        top,
        left + total,
        top + unit,
        radius,
        ACCENT_DIM,
        fill=False,
        thickness=max(3, int(unit * 0.12)),
    )

    return pixels


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    targets = [
        ("icon.png", 1024, 1024, 1.0),
        ("adaptive-icon.png", 1024, 1024, 0.72),  # Android crops to a circle.
        ("splash.png", 1242, 2436, 0.42),
        ("favicon.png", 64, 64, 1.0),
    ]

    for name, width, height, scale in targets:
        write_png(ASSETS / name, width, height, build(width, height, scale))
        print(f"wrote assets/{name} ({width}x{height})")


if __name__ == "__main__":
    main()
