# Desmos Audio Lab

Current extension version: **1.0.1**

An independent Chrome extension that plays Spotify inside the ordinary Desmos graphing calculator, analyzes explicitly shared tab audio, and exports mathematical snapshots to Desmos expressions. Local files remain available as an optional fallback.

No audio is uploaded. Processing happens locally in the browser.

## Version 1 features

- Direct Spotify track, album, playlist, show, and episode embeds inside Desmos
- Explicit current-tab audio capture for genuine live analysis
- Optional local audio loading by picker or drag and drop
- Playback, seeking, volume, and elapsed time
- Live time-domain waveform and FFT spectrum
- Peak-frequency, RMS, and sample-rate readouts
- Waveform, Spectrum, and Both display modes
- Three performance presets
- Safe, explicit snapshot export to a dedicated Desmos folder
- Responsive panel, keyboard-accessible controls, and saved preferences
- No dependency on DesModder

## Install from source

1. Run `npm run check` and `npm run pack`.
2. Open Chrome's extensions management page.
3. Enable Developer mode.
4. Choose **Load unpacked** and select `dist/desmos-audio-lab`.
5. Open the Desmos graphing calculator. Audio Lab appears on the right.

The extension intentionally requests no broad host permissions and runs only on the Desmos calculator and 3D calculator URLs.

## Design and performance

Audio analysis stays in typed arrays and canvas. Desmos expressions are updated only when **Send snapshot to Desmos** is pressed, preventing expression-list churn during playback. The Performance, Balanced, and Quality presets change FFT size, visualization frame rate, and snapshot resolution.

## Privacy

Spotify playback uses Spotify's official embedded player. Tab analysis begins only after the user accepts Chrome's sharing prompt and ends when sharing is stopped. Selected local files use an in-memory object URL and are never uploaded.

## Development

```bash
npm run check
npm run pack
```

The browser-facing code has no runtime dependencies or build step. `src/desmos-bridge.js` runs in the page's main JavaScript world solely to call the calculator's expression methods. The isolated content script handles audio and UI, communicating with the bridge through a narrow event containing expression objects. Spotify's official embed is attached directly to the Desmos document so its frame-security checks see a normal HTTPS parent rather than a rejected double-iframe chain.

## Scope

Spotify search through a private API client, spectrograms, saved analysis sessions, and decorative particle effects are intentionally deferred. Version 1 provides direct embedded playback without requiring stored API credentials.
