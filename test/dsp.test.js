import test from "node:test";
import assert from "node:assert/strict";
import "../src/dsp.js";

const DSP = globalThis.AudioLabDSP;
test("RMS measures constant and alternating signals", () => {
  assert.equal(DSP.rms(new Float32Array([1, 1, 1])), 1);
  assert.equal(DSP.rms(new Float32Array([-1, 1, -1, 1])), 1);
  assert.equal(DSP.rms(new Float32Array()), 0);
});
test("peakFrequency maps a bin to hertz", () => {
  assert.equal(DSP.peakFrequency(new Float32Array([-100, -20, -40]), 48000, 8), 6000);
});
test("downsample preserves requested length and extrema", () => {
  assert.deepEqual(DSP.downsample(new Float32Array([0.1, -0.9, 0.2, 0.8]), 2).map((x) => Math.round(x * 10)), [-9, 8]);
});
test("formatTime and pointsLatex are deterministic", () => {
  assert.equal(DSP.formatTime(65.9), "1:05");
  assert.equal(DSP.pointsLatex([0, 1], -1, 1, 2, 3), "[(-1,3),(1,5)]");
});
test("Spotify links and URIs become constrained embed URLs", () => {
  assert.equal(DSP.spotifyEmbedUrl("spotify:track:abc123"), "https://open.spotify.com/embed/track/abc123?utm_source=generator&theme=0");
  assert.equal(DSP.spotifyEmbedUrl("https://open.spotify.com/playlist/xyz987?si=test"), "https://open.spotify.com/embed/playlist/xyz987?utm_source=generator&theme=0");
  assert.equal(DSP.spotifyEmbedUrl("https://example.com/track/abc"), null);
  assert.equal(DSP.spotifyEmbedUrl("https://open.spotify.com/track/0USK9GYk8n1FQg5rUTWadD?si=f3617250f0604e58"), "https://open.spotify.com/embed/track/0USK9GYk8n1FQg5rUTWadD?utm_source=generator&theme=0");
});
