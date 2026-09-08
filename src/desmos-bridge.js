(() => {
  "use strict";
  if (window.__desmosAudioLabBridge) return;
  window.__desmosAudioLabBridge = true;

  window.addEventListener("desmos-audio-lab-export", (event) => {
    const expressions = event.detail?.expressions;
    const calculator = window.Calc;
    if (!Array.isArray(expressions)) return;
    if (!calculator || typeof calculator.setExpressions !== "function") {
      window.dispatchEvent(new CustomEvent("desmos-audio-lab-export-result", {
        detail: { ok: false, message: "Desmos calculator is not ready." }
      }));
      return;
    }

    try {
      calculator.setExpressions(expressions);
      window.dispatchEvent(new CustomEvent("desmos-audio-lab-export-result", {
        detail: { ok: true, message: "Snapshot added to the expression list." }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent("desmos-audio-lab-export-result", {
        detail: { ok: false, message: error instanceof Error ? error.message : "Export failed." }
      }));
    }
  });
})();
