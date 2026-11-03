# Models

`u2netp.onnx`: U²-Net (small) salient object detection, used by the "Remove background" tool.

- Source: https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
- Original model: https://github.com/xuebinqin/U-2-Net (Apache-2.0)
- ONNX export: rembg (MIT). Both notices are in `public/THIRD-PARTY-NOTICES.txt`.
- Size: 4.6 MB

`scripts/copy-assets.mjs` copies it to `public/vendor/models/` before dev and build.
