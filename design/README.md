# App icon

`icon.svg` is the source. `icon-windows.svg` is the same drawing cropped to the
rounded square, because Windows shows icons without the padding that macOS
expects.

To rebuild the icons after changing `icon.svg`:

1. Make the Windows copy: `sed 's/viewBox="0 0 1024 1024"/viewBox="92 92 840 840"/' design/icon.svg > design/icon-windows.svg`
2. Render both SVGs to 1024 × 1024 PNGs with a transparent background, for
   example with headless Chrome (`--screenshot --default-background-color=00000000`).
3. Run `npx tauri icon design/icon.png`, then delete `src-tauri/icons/android` and `src-tauri/icons/ios`.
4. Run `npx tauri icon design/icon-windows.png -o <a temporary folder>` and copy
   its `icon.ico` over `src-tauri/icons/icon.ico`.
