# Third-party notices

## Author-supplied Boston water recording

The site author supplied the Boston water video used in
`articles/reverse-engineering-reflections.html`.
`articles/reverse-engineering-assets/boston-water-loop-hevc.mp4` preserves
the source HEVC video stream without re-encoding and removes the audio.
`articles/reverse-engineering-assets/boston-water-loop.mp4` is a silent H.264
compatibility version for inline looping playback, preserving the source's 960 × 544
resolution, full 6.6-second sequence, 30 fps, and BT.709 color metadata.
It is encoded at CRF 16; no spatial downscaling or frame dropping is used.
Browsers select the supported source; the page has no download links or
player controls. Playback pauses offscreen and respects reduced-motion settings.
`boston-water-still.png` is the first frame for reduced-motion/poster display.
The recording is presented as the author's personal observation, not a
rendering benchmark or third-party game footage.

## Death Stranding effects-study screenshot

`articles/reverse-engineering-assets/death-stranding-moss.jpg` is an unmodified
screenshot supplied by the site author for the personal essay
`articles/reverse-engineering-reflections.html` (2026-10-27). The author
describes it as a screenshot from their reverse-engineering study of
Death Stranding effects in an Unreal editor environment.

The cover and home-page entry display only the moss area through an SVG
viewport; the article also presents the complete original image. No scene
details have been generated or repainted. Game imagery and software UI
remain the property of their respective rightsholders; no open-content
license or redistribution rights to underlying game assets are asserted.

## Hexo Theme Redefine wallpapers

This site redistributes the following unmodified wallpaper assets from
[`EvanNotFound/hexo-theme-redefine`](https://github.com/EvanNotFound/hexo-theme-redefine):

- `backgrounds/wallhaven-wqery6-light.webp`
- `backgrounds/wallhaven-wqery6-dark.webp`

Source revision: `afa67f32e0e8af2705b7c4bf81a62227e665d90f`.

The upstream project is distributed under the GNU General Public License,
version 3. A copy is included at
`licenses/hexo-theme-redefine-GPL-3.0.txt`.

The DOTAFS HTML, CSS, and JavaScript are independently authored and do not copy
the Redefine theme implementation.

## Hexo Theme NexT layout adaptation

The personal home and paper-note pages adapt layout tokens and structural
conventions from [`next-theme/hexo-theme-next`](https://github.com/next-theme/hexo-theme-next),
including the Gemini/Pisces dual-column geometry, content widths, typography
scale, neutral palette, and sidebar behavior.

NexT is distributed under the GNU Affero General Public License version 3 with
additional terms. The upstream project notice is included at
`licenses/hexo-theme-next-LICENSE.txt`. The complete AGPL-3.0 text is available
from the upstream project at
[`docs/AGPL3.md`](https://github.com/next-theme/hexo-theme-next/blob/master/docs/AGPL3.md).

This adaptation was modified for DOTAFS on 2026-08-13. Corresponding source is
published in the `dotafs2/dotafs-pbf-site` repository. The required NexT
official-site attribution is retained in the footer of each adapted page.

## World Models article figures

The World Models learning note redistributes the following unmodified SVG
figures from
[`worldmodels/worldmodels.github.io`](https://github.com/worldmodels/worldmodels.github.io):

- `articles/world-models-assets/world_model_overview.svg`
- `articles/world-models-assets/vae.svg`
- `articles/world-models-assets/mdn_rnn_new.svg`

The figures are credited to David Ha and Jürgen Schmidhuber and are distributed
under the Creative Commons Attribution 4.0 International license. A copy is
included at `licenses/worldmodels-CC-BY-4.0.txt`.

The figures are reproduced without modification. The DOTAFS article text,
layout, charts, and interactive teaching examples are independently authored.

## WorldClaw and NaLA paper figure excerpts

The WorldClaw and NaLA learning notes include attributed figure excerpts from
the authors' paper and project pages for research commentary and explanation:

- `paper/worldclaw/terrain-stages.jpg`
- `paper/worldclaw/scene-refinement.jpg`
- `paper/nala/figure-3.png`
- `paper/nala/figure-4.png`
- `paper/nala/figure-6.png`
- `paper/nala/figure-7.png`
- `paper/nala/figure-9.png`

Sources:

- [WorldClaw project page](https://tencent-hunyuan.github.io/Hunyuan3D-WorldClaw/)
- [WorldClaw paper](https://arxiv.org/abs/2608.05248)
- [NaLA project page](https://adamcwan.github.io/NaLA/)
- [NaLA paper](https://arxiv.org/abs/2606.29395)

These excerpts remain credited to their respective authors. No open-content
license is asserted for them. The surrounding article text, layout, tables,
and interactive teaching examples are independently authored.

## Neural Texture Compression paper figure excerpts

The Neural Texture Compression learning note includes cropped, attributed
figure excerpts from the NVIDIA author version of *Random-Access Neural
Compression of Material Textures* for research commentary and explanation:

- `paper/ntc/figure-1-render-comparison.png`
- `paper/ntc/figure-4-method.png`
- `paper/ntc/figure-12-failures.png`

Source:

- [NVIDIA Research project page](https://research.nvidia.com/labs/rtr/neural_texture_compression/)
- [Author-version paper PDF](https://research.nvidia.com/labs/rtr/neural_texture_compression/assets/ntc_small_size.pdf)

The excerpts remain credited to Karthik Vaidyanathan, Marco Salvi,
Bartlomiej Wronski, Tomas Akenine-Möller, Pontus Ebelin, Aaron Lefohn, and
NVIDIA. No open-content license is asserted for them. The surrounding article
text, layout, tables, synthetic texture examples, and interactive teaching
tools are independently authored.


## Death Stranding 2 fireworks research note

`articles/death-stranding-2-fireworks.html` includes limited game-imagery
excerpts and a video of a local research reconstruction for technical commentary.
DEATH STRANDING 2: ON THE BEACH imagery and underlying assets remain the
property of their respective rightsholders, including KOJIMA PRODUCTIONS
and Sony Interactive Entertainment. No open-content license or permission
to redistribute the underlying game assets is asserted.

- `articles/ds2-fireworks-assets/original-capture-61699.png`: the original-game
  capture preview retained in the research evidence, unmodified, 1600×900.
- `ue-fireworks-1080p.mp4` and `ue-frame-*.png` in that directory: the author's
  local Unreal Engine research reconstruction, newly captured on 2026-11-07.
  The video is a fixed-step visual demonstration, not a real-time benchmark.
  PNGs are unchanged capture outputs; the browser video uses lossy H.264.
- `static-alpha.png` and `runtime-alpha.png`: limited 32×32 texture excerpts
  needed to explain the measured opacity mismatch; copied without alteration.
  White RGB with alpha is displayed over black to visualize coverage.
- `strip-reference.png` and `strip-recovered.png`: diagnostic silhouettes from
  the 2026-11-02 fixed-input position comparison, preserved unmodified.

The article links to the previously selected video reference at
https://www.bilibili.com/video/BV1yTQrBnEUa/ ; that video is not downloaded
or redistributed by this site. The original local video was not found.
The pipeline and strip-topology teaching diagrams are independently authored.
Public JSON and CSV contain research summaries and measurement values, with
source-report SHA256 hashes; no game packages, models, executable code or
shader bytecode are redistributed. Media details appear in
`articles/ds2-fireworks-assets/media-provenance.json`.
