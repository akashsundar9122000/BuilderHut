# Brand assets

The masters. Nothing here is served — these are the files the shipped assets
are cut from, kept so the next size can be cut from the artwork rather than
from an already-downscaled copy.

## `app-icon.png`

The app icon: a lit hut on a rounded tile, 1254×1254, exactly as rendered.
Pixel-identical to the original — re-encode it losslessly or not at all, since
everything else is derived from it.

Three files are cut from it, all by Next's file conventions in `app/`
(see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`):

| File                 | Size                | Where it shows                  |
| -------------------- | ------------------- | ------------------------------- |
| `app/favicon.ico`    | 16, 32, 48 (32-bit) | browser tab, bookmarks, history |
| `app/icon.png`       | 512                 | tab on modern browsers, search  |
| `app/apple-icon.png` | 180                 | iOS home screen                 |

Each is cropped to `left: 97, top: 94, 1052×1052` first. That is the tile
itself: the master floats it on a near-black field, and at 16px that field is
dead margin around an already-small drawing. The crop is what makes the roof
and the lit doorway still readable in a tab.

The 512 and 180 are palette-quantised, which costs nothing visible on artwork
this flat and about five sixths of the bytes. The `.ico` frames are not —
its directory declares 32bpp, and a palette payload would make that a lie.

Note for anyone regenerating these with sharp: passing `effort` to `.png()`
turns on palette quantisation implicitly. A "lossless" re-encode of the master
written that way comes back quantised, with per-channel error up to 61.

## `mark.svg`

The older BuilderHut mark — a roof over a B. It lived at `app/icon.svg` and was
the tab icon until the hut replaced it; `components/brand/Mark.tsx` is still
this drawing, and still what the product shows beside its own name.
