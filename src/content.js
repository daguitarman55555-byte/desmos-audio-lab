(() => {
  "use strict";
  if (window.__desmosAudioLabLoaded) return;
  window.__desmosAudioLabLoaded = true;

  const DSP = globalThis.AudioLabDSP;
  const qualityConfig = {
    performance: { fftSize: 1024, fps: 24, waveformPoints: 160, spectrumPoints: 128 },
    balanced: { fftSize: 2048, fps: 40, waveformPoints: 256, spectrumPoints: 192 },
    quality: { fftSize: 4096, fps: 60, waveformPoints: 384, spectrumPoints: 256 }
  };

  const state = {
    audioContext: null,
    analyser: null,
    source: null,
    captureStream: null,
    objectUrl: null,
    timeData: new Float32Array(0),
    frequencyData: new Float32Array(0),
    frameId: 0,
    lastFrame: 0,
    view: localStorage.getItem("audioLab.view") || "both",
    quality: localStorage.getItem("audioLab.quality") || "balanced",
    open: localStorage.getItem("audioLab.open") !== "false"
  };

  const panel = document.createElement("aside");
  panel.id = "dal-panel";
  panel.innerHTML = `
    <header class="dal-header">
      <div><h1>Audio Lab</h1><span>v1</span></div>
      <button class="dal-icon-button" data-action="close" aria-label="Close Audio Lab">×</button>
    </header>
    <main class="dal-main">
      <section class="dal-spotify-load">
        <label for="dal-spotify-url">Spotify link</label>
        <div><input id="dal-spotify-url" type="url" placeholder="Paste a track, album, or playlist link"><button id="dal-load-spotify" class="dal-primary dal-inline">Load</button></div>
        <small>Playback stays inside this Desmos panel.</small>
      </section>
      <iframe id="dal-spotify-player" class="dal-spotify-player" title="Audio Lab Spotify player" allow="autoplay; encrypted-media" hidden></iframe>
      <button id="dal-analyze" class="dal-secondary dal-analyze" disabled>Analyze this tab</button>
      <p class="dal-capture-note">For live waveform data, select this Desmos tab and enable “Share tab audio” in Chrome’s prompt.</p>
      <details class="dal-local-details"><summary>Use a local audio file instead</summary>
      <label class="dal-dropzone" tabindex="0">
        <input id="dal-file" type="file" accept="audio/*" hidden>
        <span class="dal-file-icon" aria-hidden="true">♫</span>
        <strong>Choose audio</strong>
        <small>Drop a local audio file here or click to select</small>
      </label></details>
      <section class="dal-file-row" hidden>
        <div class="dal-file-copy"><strong id="dal-filename"></strong><small id="dal-filemeta"></small></div>
        <button class="dal-secondary" data-action="change">Change</button>
      </section>
      <audio id="dal-audio" preload="metadata"></audio>
      <section class="dal-transport" aria-label="Playback controls">
        <button id="dal-play" class="dal-play" aria-label="Play" disabled>▶</button>
        <div class="dal-timeline">
          <div class="dal-time-row"><span id="dal-time">0:00 / 0:00</span><span id="dal-state">No audio loaded</span></div>
          <input id="dal-seek" type="range" min="0" max="1000" value="0" disabled aria-label="Seek">
        </div>
        <div class="dal-volume"><span aria-hidden="true">◖</span><input id="dal-volume" type="range" min="0" max="1" step="0.01" value="0.8" aria-label="Volume"></div>
      </section>
      <div class="dal-tabs" role="group" aria-label="Visualization">
        <button data-view="waveform">Waveform</button><button data-view="spectrum">Spectrum</button><button data-view="both">Both</button>
      </div>
      <section id="dal-wave-section" class="dal-plot-section"><div class="dal-plot-title"><span>Waveform</span><span>amplitude</span></div><canvas id="dal-wave" height="150"></canvas></section>
      <section id="dal-spectrum-section" class="dal-plot-section"><div class="dal-plot-title"><span>Spectrum</span><span>0–20 kHz</span></div><canvas id="dal-spectrum" height="150"></canvas></section>
      <section class="dal-metrics">
        <div><span>Peak</span><strong id="dal-peak">—</strong><small>Hz</small></div>
        <div><span>RMS</span><strong id="dal-rms">—</strong></div>
        <div><span>Sample rate</span><strong id="dal-rate">—</strong><small>Hz</small></div>
      </section>
      <label class="dal-quality"><span><strong>Performance</strong><small>Analysis load and refresh rate</small></span><select id="dal-quality"><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="quality">Quality</option></select></label>
      <button id="dal-export" class="dal-primary" disabled>Send snapshot to Desmos</button>
      <p id="dal-status" class="dal-status" role="status" aria-live="polite"></p>
    </main>`;

  const launcher = document.createElement("button");
  launcher.id = "dal-launcher";
  launcher.type = "button";
  launcher.title = "Open Audio Lab";
  launcher.setAttribute("aria-label", "Open Audio Lab");
  launcher.textContent = "♫";
  document.body.append(panel, launcher);

  const $ = (selector) => panel.querySelector(selector);
  const audio = $("#dal-audio");
  const fileInput = $("#dal-file");
  const dropzone = $(".dal-dropzone");
  const waveCanvas = $("#dal-wave");
  const spectrumCanvas = $("#dal-spectrum");
  const playButton = $("#dal-play");
  const seek = $("#dal-seek");
  const status = $("#dal-status");

  function setOpen(open) {
    state.open = open;
    panel.classList.toggle("dal-closed", !open);
    launcher.classList.toggle("dal-visible", !open);
    localStorage.setItem("audioLab.open", String(open));
  }

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function applyView(view) {
    state.view = ["waveform", "spectrum", "both"].includes(view) ? view : "both";
    panel.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("dal-active", button.dataset.view === state.view));
    $("#dal-wave-section").hidden = state.view === "spectrum";
    $("#dal-spectrum-section").hidden = state.view === "waveform";
    localStorage.setItem("audioLab.view", state.view);
    resizeCanvases();
  }

  function configureAnalyser() {
    if (!state.analyser) return;
    const config = qualityConfig[state.quality];
    state.analyser.fftSize = config.fftSize;
    state.analyser.smoothingTimeConstant = 0.72;
    state.timeData = new Float32Array(state.analyser.fftSize);
    state.frequencyData = new Float32Array(state.analyser.frequencyBinCount);
  }

  function ensureLocalAudioGraph() {
    if (state.audioContext) {
      if (state.audioContext.state === "suspended") state.audioContext.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
    state.analyser = state.audioContext.createAnalyser();
    state.source = state.audioContext.createMediaElementSource(audio);
    state.source.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);
    configureAnalyser();
  }

  async function startTabAnalysis() {
    try {
      if (state.captureStream) state.captureStream.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude"
      });
      const audioTracks = stream.getAudioTracks();
      stream.getVideoTracks().forEach((track) => track.stop());
      if (!audioTracks.length) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("No tab audio was shared. Enable “Share tab audio” and try again.");
      }
      state.captureStream = new MediaStream(audioTracks);
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!state.audioContext) state.audioContext = new AudioContextClass();
      if (state.source) state.source.disconnect();
      state.analyser = state.audioContext.createAnalyser();
      state.source = state.audioContext.createMediaStreamSource(state.captureStream);
      state.source.connect(state.analyser);
      configureAnalyser();
      audioTracks[0].addEventListener("ended", () => setStatus("Live analysis stopped."));
      $("#dal-export").disabled = false;
      $("#dal-analyze").textContent = "Analyzing tab audio";
      setStatus("Live waveform and spectrum are active.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Tab-audio analysis was cancelled.", "error");
    }
  }

  function loadSpotify() {
    const embedUrl = DSP.spotifyEmbedUrl($("#dal-spotify-url").value);
    if (!embedUrl) {
      setStatus("Paste a valid Spotify track, album, playlist, show, or episode link.", "error");
      return;
    }
    const player = $("#dal-spotify-player");
    // Spotify checks the complete iframe ancestor chain. Embedding its player
    // directly avoids the extension-page wrapper that Spotify correctly rejects.
    player.src = embedUrl;
    player.hidden = false;
    $("#dal-analyze").disabled = false;
    localStorage.setItem("audioLab.spotifyUrl", $("#dal-spotify-url").value.trim());
    setStatus("Spotify loaded. Press play in the player.", "success");
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith("audio/")) {
      setStatus("Choose a supported audio file.", "error");
      return;
    }
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = URL.createObjectURL(file);
    audio.src = state.objectUrl;
    $("#dal-filename").textContent = file.name;
    $("#dal-filemeta").textContent = `${(file.size / 1048576).toFixed(2)} MB`;
    $(".dal-file-row").hidden = false;
    dropzone.hidden = true;
    playButton.disabled = false;
    seek.disabled = false;
    $("#dal-export").disabled = false;
    setStatus("Audio ready. Press play or export the current frame.", "success");
  }

  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function resizeCanvases() {
    resizeCanvas(waveCanvas);
    resizeCanvas(spectrumCanvas);
  }

  function prepareContext(canvas) {
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "rgba(255,255,255,.08)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();
    return { context, width, height };
  }

  function drawWaveform() {
    const { context, width, height } = prepareContext(waveCanvas);
    if (!state.timeData.length) return;
    context.strokeStyle = "#20d6df";
    context.lineWidth = Math.max(1.5, window.devicePixelRatio || 1);
    context.beginPath();
    for (let i = 0; i < state.timeData.length; i += 1) {
      const x = (i / (state.timeData.length - 1)) * width;
      const y = (0.5 - state.timeData[i] * 0.43) * height;
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }

  function drawSpectrum() {
    const { context, width, height } = prepareContext(spectrumCanvas);
    if (!state.frequencyData.length) return;
    const nyquist = (state.audioContext?.sampleRate || 44100) / 2;
    const maxFrequency = Math.min(20000, nyquist);
    const bins = Math.floor((maxFrequency / nyquist) * state.frequencyData.length);
    const barCount = Math.min(128, Math.max(32, Math.floor(width / 5)));
    const step = bins / barCount;
    const barWidth = width / barCount;
    context.fillStyle = "#f6ad3c";
    for (let i = 0; i < barCount; i += 1) {
      let peak = -100;
      const start = Math.floor(i * step);
      const end = Math.max(start + 1, Math.floor((i + 1) * step));
      for (let j = start; j < end; j += 1) peak = Math.max(peak, state.frequencyData[j]);
      const normalized = DSP.clamp((peak + 100) / 100, 0, 1);
      const barHeight = normalized * height;
      context.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth - 1), barHeight);
    }
  }

  function updateMetrics() {
    if (!state.analyser) return;
    state.analyser.getFloatTimeDomainData(state.timeData);
    state.analyser.getFloatFrequencyData(state.frequencyData);
    $("#dal-rms").textContent = DSP.rms(state.timeData).toFixed(3);
    $("#dal-peak").textContent = Math.round(DSP.peakFrequency(state.frequencyData, state.audioContext.sampleRate, state.analyser.fftSize)).toLocaleString();
    $("#dal-rate").textContent = state.audioContext.sampleRate.toLocaleString();
  }

  function frame(timestamp) {
    state.frameId = requestAnimationFrame(frame);
    const config = qualityConfig[state.quality];
    if (timestamp - state.lastFrame < 1000 / config.fps) return;
    state.lastFrame = timestamp;
    if (state.analyser) updateMetrics();
    if (state.view !== "spectrum") drawWaveform();
    if (state.view !== "waveform") drawSpectrum();
    if (audio.duration) {
      seek.value = String((audio.currentTime / audio.duration) * 1000 || 0);
      $("#dal-time").textContent = `${DSP.formatTime(audio.currentTime)} / ${DSP.formatTime(audio.duration)}`;
    }
  }

  function exportSnapshot() {
    if (!state.analyser) {
      setStatus("Start live analysis before exporting a snapshot.", "error");
      return;
    }
    updateMetrics();
    const config = qualityConfig[state.quality];
    const wave = DSP.downsample(state.timeData, config.waveformPoints);
    const spectrumBins = state.frequencyData.slice(0, Math.min(state.frequencyData.length, Math.floor(20000 / (state.audioContext.sampleRate / state.analyser.fftSize))));
    const spectrum = DSP.downsample(spectrumBins, config.spectrumPoints).map((db) => DSP.clamp((db + 100) / 100, 0, 1));
    const expressions = [
      { id: "audio-lab-folder", type: "folder", title: "Audio Lab snapshot" },
      { id: "audio-lab-waveform", folderId: "audio-lab-folder", latex: DSP.pointsLatex(wave, -10, 10, 2.5, 2.5), color: "#20d6df", lines: true, pointOpacity: 0, lineWidth: 2 },
      { id: "audio-lab-spectrum", folderId: "audio-lab-folder", latex: DSP.pointsLatex(spectrum, -10, 10, 4, -5), color: "#f6ad3c", lines: true, pointOpacity: 0, lineWidth: 2 },
      { id: "audio-lab-position", folderId: "audio-lab-folder", latex: `t_{audio}=${Number(audio.currentTime.toFixed(3))}`, hidden: true }
    ];
    window.dispatchEvent(new CustomEvent("desmos-audio-lab-export", { detail: { expressions } }));
    setStatus("Sending snapshot…");
  }

  panel.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "close") setOpen(false);
    if (action === "change") fileInput.click();
    const view = event.target.closest("[data-view]")?.dataset.view;
    if (view) applyView(view);
  });
  launcher.addEventListener("click", () => setOpen(true));
  fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]));
  dropzone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") fileInput.click(); });
  ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.add("dal-dragging"); }));
  ["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.remove("dal-dragging"); }));
  dropzone.addEventListener("drop", (event) => loadFile(event.dataTransfer?.files?.[0]));
  playButton.addEventListener("click", async () => {
    ensureLocalAudioGraph();
    if (audio.paused) await audio.play(); else audio.pause();
  });
  audio.addEventListener("play", () => { playButton.textContent = "❚❚"; playButton.setAttribute("aria-label", "Pause"); $("#dal-state").textContent = "Playing"; });
  audio.addEventListener("pause", () => { playButton.textContent = "▶"; playButton.setAttribute("aria-label", "Play"); $("#dal-state").textContent = audio.ended ? "Finished" : "Paused"; });
  audio.addEventListener("loadedmetadata", () => { $("#dal-filemeta").textContent += ` · ${DSP.formatTime(audio.duration)}`; $("#dal-time").textContent = `0:00 / ${DSP.formatTime(audio.duration)}`; });
  seek.addEventListener("input", () => { if (audio.duration) audio.currentTime = (Number(seek.value) / 1000) * audio.duration; });
  $("#dal-volume").addEventListener("input", (event) => { audio.volume = Number(event.target.value); });
  $("#dal-quality").addEventListener("change", (event) => { state.quality = event.target.value; localStorage.setItem("audioLab.quality", state.quality); configureAnalyser(); });
  $("#dal-export").addEventListener("click", exportSnapshot);
  $("#dal-load-spotify").addEventListener("click", loadSpotify);
  $("#dal-spotify-url").addEventListener("keydown", (event) => { if (event.key === "Enter") loadSpotify(); });
  $("#dal-analyze").addEventListener("click", startTabAnalysis);
  window.addEventListener("desmos-audio-lab-export-result", (event) => setStatus(event.detail?.message || "Export complete.", event.detail?.ok ? "success" : "error"));
  window.addEventListener("resize", resizeCanvases, { passive: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden && !audio.paused) audio.pause(); });
  window.addEventListener("pagehide", () => { if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); cancelAnimationFrame(state.frameId); });

  $("#dal-quality").value = state.quality;
  $("#dal-spotify-url").value = localStorage.getItem("audioLab.spotifyUrl") || "";
  audio.volume = 0.8;
  applyView(state.view);
  setOpen(state.open);
  resizeCanvases();
  state.frameId = requestAnimationFrame(frame);
})();
