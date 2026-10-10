/**
 * 鹿雨森官網｜森林場景組裝
 * 全部繪圖零件從 lib.stillnessbyslowly.com 透過絕對 HTTPS URL 載入。
 * 本檔只有鹿雨森的參數與組合邏輯，不包含軍火庫函式實作。
 */
(() => {
  "use strict";

  const instances = [];
  const required = ["SlowlyPineForest", "SlowlyCanvasFog", "SlowlyCanvasRain"];
  const unavailable = required.filter(name => !window[name]?.create);
  if (unavailable.length) {
    console.error("鹿雨森：軍火庫零件載入失敗", unavailable);
    return;
  }

  try {
    instances.push(window.SlowlyPineForest.create({
      canvas: "#forest",
      seed: 23,
      maxDpr: 1.5,
      density: 0.95,
      layers: [
        { baseline: 0.82, minHeight: 0.19, maxHeight: 0.39, color: "#173330", width: 0.39 },
        { baseline: 0.93, minHeight: 0.29, maxHeight: 0.51, color: "#0b2224", width: 0.39 }
      ]
    }));

    const fog = window.SlowlyCanvasFog.create({
      canvas: "#fog",
      count: 17,
      color: "#a4c9bd",
      opacity: 0.38,
      speed: 0.5,
      size: 1.1,
      maxDpr: 1.5,
      autoStart: true
    });
    instances.push(fog);

    const rain = window.SlowlyCanvasRain.create({
      canvas: "#weather",
      count: Math.min(115, Math.max(38, Math.floor(innerWidth / 8))),
      color: "#d2eeec",
      opacity: 0.65,
      speed: 0.7,
      wind: 0.13,
      length: 0.55,
      maxDpr: 1.5,
      autoStart: true
    });
    instances.push(rain);
  } catch (error) {
    console.error("鹿雨森：森林場景初始化失敗", error);
  }

  addEventListener("pagehide", () => instances.forEach(instance => instance.destroy()), { once: true });
})();
