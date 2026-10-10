/**
 * 鹿雨森｜官網森林與雨幕
 *
 * 專責 Canvas 背景的繪製與動畫。
 * 本檔不處理按鈕、頁面導覽，也不操作作品內容。
 */

(() => {
  "use strict";

  const forestCanvas = document.getElementById("forest");
  const weatherCanvas = document.getElementById("weather");

  if (!forestCanvas || !weatherCanvas) {
    return;
  }

  const forestContext = forestCanvas.getContext("2d");
  const weatherContext = weatherCanvas.getContext("2d");

  if (!forestContext || !weatherContext) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const MAX_DPR = 1.5;

  let width = 0;
  let height = 0;
  let drops = [];
  let fireflies = [];
  let previousFrame = 0;
  let animationId = null;
  let resizeTimer = null;

  /** 固定亂數種子，視窗尺寸相同時樹林輪廓一致。 */
  function seededRandom(initialSeed) {
    let seed = initialSeed;

    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }

  /** 繪製單棵松樹剪影。 */
  function drawPine(context, x, bottom, treeHeight, treeWidth) {
    context.beginPath();
    context.moveTo(x, bottom - treeHeight);

    for (let index = 1; index <= 6; index += 1) {
      const y = bottom - treeHeight + (index * treeHeight) / 6;
      context.lineTo(x + (treeWidth * index) / 12, y);
      context.lineTo(x + (treeWidth * index) / 25, y - treeHeight * 0.035);
    }

    context.lineTo(x + treeWidth * 0.025, bottom);
    context.lineTo(x - treeWidth * 0.025, bottom);

    for (let index = 6; index >= 1; index -= 1) {
      const y = bottom - treeHeight + (index * treeHeight) / 6;
      context.lineTo(x - (treeWidth * index) / 25, y - treeHeight * 0.035);
      context.lineTo(x - (treeWidth * index) / 12, y);
    }

    context.closePath();
    context.fill();
  }

  /** 重複繪製前後不同深度的林木。 */
  function drawTreeLayer(context, random, baseline, minimum, maximum, color) {
    context.fillStyle = color;

    for (let x = -55; x < width + 55;) {
      const treeHeight = height * (minimum + random() * (maximum - minimum));
      const treeWidth = treeHeight * (0.32 + random() * 0.14);

      drawPine(context, x, height * baseline, treeHeight, treeWidth);
      x += treeHeight * (0.13 + random() * 0.16);
    }

    context.fillRect(0, height * baseline, width, height);
  }

  /** 森林與背光是靜態背景，只有尺寸改變時重新繪製。 */
  function drawForest() {
    const random = seededRandom(23);
    const sky = forestContext.createLinearGradient(0, 0, 0, height);

    sky.addColorStop(0, "#071415");
    sky.addColorStop(0.55, "#1a3735");
    sky.addColorStop(1, "#071717");

    forestContext.fillStyle = sky;
    forestContext.fillRect(0, 0, width, height);

    const light = forestContext.createRadialGradient(
      width * 0.5,
      height * 0.28,
      0,
      width * 0.5,
      height * 0.3,
      height * 0.65
    );

    light.addColorStop(0, "rgba(190, 226, 215, 0.27)");
    light.addColorStop(1, "rgba(190, 226, 215, 0)");

    forestContext.fillStyle = light;
    forestContext.fillRect(0, 0, width, height);

    drawTreeLayer(forestContext, random, 0.82, 0.19, 0.39, "#173330");
    drawTreeLayer(forestContext, random, 0.93, 0.29, 0.51, "#0b2224");

    forestContext.fillStyle = "#071617";
    forestContext.fillRect(0, height * 0.95, width, height * 0.05);
  }

  /** 每次改變尺寸才重新配置雨滴與螢火蟲。 */
  function initializeWeather() {
    if (reduceMotion.matches) {
      drops = [];
      fireflies = [];
      return;
    }

    const dropCount = Math.min(115, Math.max(38, Math.floor(width / 8)));

    drops = Array.from({ length: dropCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      depth: 0.3 + Math.random() * 0.7
    }));

    fireflies = Array.from({ length: 22 }, () => ({
      x: Math.random() * width,
      y: height * (0.25 + Math.random() * 0.62),
      phase: Math.random() * 6
    }));
  }

  /** 使 Canvas 內部像素與螢幕尺寸相符。 */
  function prepareCanvas(canvas, context, ratio) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function resizeScene() {
    width = window.innerWidth;
    height = window.innerHeight;

    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    prepareCanvas(forestCanvas, forestContext, ratio);
    prepareCanvas(weatherCanvas, weatherContext, ratio);
    drawForest();
    initializeWeather();
    weatherContext.clearRect(0, 0, width, height);
  }

  function drawRain(frameStep) {
    weatherContext.lineCap = "round";

    for (const drop of drops) {
      weatherContext.strokeStyle = `rgba(210, 238, 236, ${0.1 + drop.depth * 0.17})`;
      weatherContext.lineWidth = 0.4 + drop.depth * 0.7;
      weatherContext.beginPath();
      weatherContext.moveTo(drop.x, drop.y);
      weatherContext.lineTo(drop.x - 2 * drop.depth, drop.y - 13 * drop.depth);
      weatherContext.stroke();

      drop.y += (6 + drop.depth * 6) * frameStep;
      drop.x += drop.depth * 1.4 * frameStep;

      if (drop.y > height + 20) {
        drop.y = -20;
        drop.x = Math.random() * width;
      }

      if (drop.x > width + 20) {
        drop.x = -20;
      }
    }
  }

  function drawFireflies(time, frameStep) {
    for (const firefly of fireflies) {
      const alpha = 0.08 + 0.26 * (0.5 + 0.5 * Math.sin(time / 1200 + firefly.phase));
      const radius = 1.2 + Math.sin(time / 1500 + firefly.phase) * 0.4;

      weatherContext.fillStyle = `rgba(205, 255, 213, ${alpha})`;
      weatherContext.beginPath();
      weatherContext.arc(firefly.x, firefly.y, radius, 0, Math.PI * 2);
      weatherContext.fill();

      firefly.x += Math.sin(time / 1800 + firefly.phase) * 0.07 * frameStep;
    }
  }

  function animateWeather(time) {
    // 只在可見、且沒有啟用減少動態時執行。
    if (document.hidden || reduceMotion.matches) {
      animationId = null;
      return;
    }

    const frameStep = Math.min(time - previousFrame || 16, 40) / 16;
    previousFrame = time;

    weatherContext.clearRect(0, 0, width, height);
    drawRain(frameStep);
    drawFireflies(time, frameStep);

    animationId = window.requestAnimationFrame(animateWeather);
  }

  function startAnimation() {
    if (animationId === null && !document.hidden && !reduceMotion.matches) {
      previousFrame = 0;
      animationId = window.requestAnimationFrame(animateWeather);
    }
  }

  function stopAnimation() {
    if (animationId !== null) {
      window.cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resizeScene, 170);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAnimation();
    } else {
      startAnimation();
    }
  });

  reduceMotion.addEventListener?.("change", () => {
    stopAnimation();
    initializeWeather();
    weatherContext.clearRect(0, 0, width, height);
    startAnimation();
  });

  resizeScene();
  startAnimation();
})();
