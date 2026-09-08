(function (root) {
  "use strict";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rms(samples) {
    if (!samples.length) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
    return Math.sqrt(sum / samples.length);
  }

  function peakFrequency(bins, sampleRate, fftSize) {
    if (!bins.length || !sampleRate || !fftSize) return 0;
    let index = 0;
    let peak = -Infinity;
    for (let i = 1; i < bins.length; i += 1) {
      if (bins[i] > peak) {
        peak = bins[i];
        index = i;
      }
    }
    return (index * sampleRate) / fftSize;
  }

  function downsample(samples, count) {
    if (!samples.length || count <= 0) return [];
    const target = Math.min(Math.floor(count), samples.length);
    const result = new Array(target);
    const bucket = samples.length / target;
    for (let i = 0; i < target; i += 1) {
      const start = Math.floor(i * bucket);
      const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
      let min = Infinity;
      let max = -Infinity;
      for (let j = start; j < end && j < samples.length; j += 1) {
        min = Math.min(min, samples[j]);
        max = Math.max(max, samples[j]);
      }
      result[i] = Math.abs(max) >= Math.abs(min) ? max : min;
    }
    return result;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }

  function pointsLatex(values, xMin, xMax, yScale, yOffset) {
    if (!values.length) return "[]";
    const denominator = Math.max(1, values.length - 1);
    const points = values.map((value, index) => {
      const x = xMin + ((xMax - xMin) * index) / denominator;
      const y = value * yScale + yOffset;
      return `(${Number(x.toFixed(6))},${Number(y.toFixed(6))})`;
    });
    return `[${points.join(",")}]`;
  }

  function spotifyEmbedUrl(input) {
    if (!input || typeof input !== "string") return null;
    const value = input.trim();
    const uri = value.match(/^spotify:(track|album|playlist|episode|show):([A-Za-z0-9]+)$/i);
    if (uri) return `https://open.spotify.com/embed/${uri[1].toLowerCase()}/${uri[2]}?utm_source=generator&theme=0`;
    try {
      const url = new URL(value);
      if (url.hostname !== "open.spotify.com") return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const offset = parts[0]?.startsWith("intl-") ? 1 : 0;
      const type = parts[offset];
      const id = parts[offset + 1];
      if (!["track", "album", "playlist", "episode", "show"].includes(type) || !/^[A-Za-z0-9]+$/.test(id || "")) return null;
      return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
    } catch {
      return null;
    }
  }

  const api = { clamp, rms, peakFrequency, downsample, formatTime, pointsLatex, spotifyEmbedUrl };
  root.AudioLabDSP = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
