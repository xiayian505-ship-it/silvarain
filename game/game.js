/**
 * 鹿雨森遊戲入口｜場景與音效整合
 * 三種自然效果與 Audio 基礎積木均由軍火庫 CDN 提供，鹿雨森只配置、疊放和混音。
 * 獨有的漣漪與螢火蟲暫留專案，未替軍火庫重造雨或噪音核心。
 */
(() => {
  "use strict";

  const components = [];
  const expected = ["SlowlyPineForest", "SlowlyCanvasFog", "SlowlyCanvasRain"];
  const missing = expected.filter(name => !window[name]?.create);

  if (missing.length) {
    console.error("鹿雨森：缺少軍火庫自然特效", missing);
  } else {
    try {
      components.push(window.SlowlyPineForest.create({
        canvas: "#back", seed: 11, density: 1.03, maxDpr: 1.5,
        layers: [
          { baseline: 0.70, minHeight: 0.16, maxHeight: 0.30, color: "#1d3b3a", width: 0.36 },
          { baseline: 0.82, minHeight: 0.22, maxHeight: 0.40, color: "#10272a", width: 0.38 }
        ]
      }));
      components.push(window.SlowlyPineForest.create({
        canvas: "#front", seed: 47, maxDpr: 1.5,
        layers: [
          { baseline: 1.06, minHeight: 0.5, maxHeight: 0.85, color: "#050d0e", width: 0.39, fillBelow: false }
        ]
      }));
      components.push(window.SlowlyCanvasFog.create({
        canvas: "#fog", count: 24, color: "#c3ddd4", opacity: 0.85,
        size: 1.15, speed: 0.9, maxDpr: 1.5, autoStart: true
      }));
      components.push(window.SlowlyCanvasRain.create({
        canvas: "#rain", count: Math.min(320, Math.floor(innerWidth / 4)),
        color: "#c8e6e6", opacity: 1, speed: 1,
        wind: 0.2, length: 1, maxDpr: 1.5, autoStart: true
      }));
    } catch (error) {
      console.error("鹿雨森：場景零件初始化失敗", error);
    }
  }

  // 專案獨有的水紋與螢火蟲（目前軍火庫尚無適用的同等零件）。
  const particleCanvas = document.querySelector("#particles");
  const particleContext = particleCanvas?.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let dpr = 1;
  let fireflies = [];
  let ripples = [];
  let glowSprite = null;
  let raf = 0;
  let resizeTimer = 0;
  let last = 0;
  let rippleCooldown = 0;

  function buildGlow() {
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    const context = sprite.getContext("2d");
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(210,255,215,.95)");
    gradient.addColorStop(.25, "rgba(150,235,190,.4)");
    gradient.addColorStop(1, "rgba(150,235,190,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return sprite;
  }

  function resizeParticles() {
    if (!particleContext) return;
    const bounds = particleCanvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    particleCanvas.width = Math.round(width * dpr);
    particleCanvas.height = Math.round(height * dpr);
    particleContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    fireflies = Array.from({ length: reduced.matches ? 10 : 28 }, () => ({
      x: Math.random() * width,
      y: height * (.35 + Math.random() * .6),
      phase: Math.random() * 6,
      speed: .5 + Math.random() * 1.5,
      sway: Math.random() * 6.28
    }));
    ripples = [];
    if (!glowSprite) glowSprite = buildGlow();
  }

  function paintParticles(time) {
    if (!particleContext) return;
    particleContext.clearRect(0, 0, width, height);
    if (reduced.matches) return;

    rippleCooldown -= 16;
    if (rippleCooldown <= 0 && ripples.length < 25) {
      rippleCooldown = 100 + Math.random() * 270;
      ripples.push({
        x: Math.random() * width,
        y: height * (.86 + Math.random() * .14),
        radius: 1,
        alpha: .17 + Math.random() * .18
      });
    }

    particleContext.strokeStyle = "#c8e6e6";
    for (let i = ripples.length - 1; i >= 0; i--) {
      const ripple = ripples[i];
      ripple.radius += .55;
      ripple.alpha -= .008;
      if (ripple.alpha <= 0) { ripples.splice(i, 1); continue; }
      particleContext.globalAlpha = ripple.alpha;
      particleContext.beginPath();
      particleContext.ellipse(ripple.x, ripple.y, ripple.radius * 2.4, ripple.radius * .6, 0, 0, Math.PI * 2);
      particleContext.lineWidth = .8;
      particleContext.stroke();
    }
    particleContext.globalAlpha = 1;
    particleContext.globalCompositeOperation = "lighter";

    for (const fly of fireflies) {
      fly.sway += .01;
      fly.x += Math.sin(fly.sway * .7 + fly.phase) * .35;
      fly.y += Math.cos(fly.sway * .5) * .25 - .03;
      if (fly.y < height * .3) fly.y = height * .95;
      if (fly.x < 0) fly.x = width;
      if (fly.x > width) fly.x = 0;
      const brightness = .5 + .5 * Math.sin(time / 900 * fly.speed + fly.phase);
      const radius = 12 + fly.speed * 9;
      particleContext.globalAlpha = brightness * brightness * .9;
      particleContext.drawImage(glowSprite, fly.x - radius, fly.y - radius, radius * 2, radius * 2);
    }
    particleContext.globalAlpha = 1;
    particleContext.globalCompositeOperation = "source-over";
  }

  function animateParticles(time) {
    raf = 0;
    if (document.hidden || reduced.matches) return;
    last = time;
    paintParticles(time);
    raf = requestAnimationFrame(animateParticles);
  }

  function startParticles() {
    if (!raf && !reduced.matches && !document.hidden && particleContext) raf = requestAnimationFrame(animateParticles);
  }
  function stopParticles() { cancelAnimationFrame(raf); raf = 0; }
  function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(resizeParticles, 150); }
  function onVisibility() { if (document.hidden) stopParticles(); else startParticles(); }
  function onMotion() { stopParticles(); resizeParticles(); startParticles(); }
  if (particleContext) {
    resizeParticles();
    startParticles();
    addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener?.("change", onMotion);
  }

  // 由 Audio 軍火庫提供 AudioContext、噪音、濾波、Gain、Envelope。
  // 宿主只決定雨聲的兩條聲道、音量與雷聲的觸發時機。
  const audio = { on: false, context: null, master: null, sources: [] };
  function audioAvailable() {
    return ["SlowlyAudioContext", "SlowlyAudioNoise", "SlowlyAudioGain",
      "SlowlyAudioBiquadFilter", "SlowlyAudioEnvelope"].every(name => Boolean(window[name]));
  }

  function makeRainChannel(type, frequency, q, gain) {
    const src = window.SlowlyAudioNoise.create(audio.context, { type, duration: 3, loop: true });
    const filter = window.SlowlyAudioBiquadFilter.create(audio.context, {
      type: type === "white" ? "bandpass" : "lowpass", frequency, Q: q
    });
    const channelGain = window.SlowlyAudioGain.create(audio.context, gain);
    src.connect(filter).connect(channelGain).connect(audio.master);
    src.start();
    audio.sources.push(src);
  }

  async function toggleRainSound() {
    if (!audioAvailable() || !window.SlowlyAudioContext.isSupported()) {
      throw new Error("瀏覽器不支援聲音，或軍火庫 Audio 尚未載入。");
    }
    if (!audio.context) {
      audio.context = window.SlowlyAudioContext.create();
      audio.master = window.SlowlyAudioGain.create(audio.context, 0);
      audio.master.connect(audio.context.destination);
      makeRainChannel("white", 3200, .4, .5);
      makeRainChannel("brown", 380, 1, 1.1);
    }
    await window.SlowlyAudioContext.resume();
    audio.on = !audio.on;
    audio.master.gain.setTargetAtTime(audio.on ? .35 : 0, audio.context.currentTime, .6);
    return audio.on;
  }

  function thunder() {
    if (!audio.on || !audio.context || !audioAvailable()) return;
    const context = audio.context;
    const source = window.SlowlyAudioNoise.create(context, { type: "brown", duration: 3, loop: false });
    const filter = window.SlowlyAudioBiquadFilter.create(context, {
      type: "lowpass", frequency: 160
    });
    const gain = window.SlowlyAudioGain.create(context, 0);
    const at = context.currentTime + 1.2;
    window.SlowlyAudioEnvelope.set(gain.gain, 0, at);
    window.SlowlyAudioEnvelope.linear(gain.gain, 1.2, at + .4);
    window.SlowlyAudioEnvelope.exponential(gain.gain, .001, at + 2.9);
    source.connect(filter).connect(gain).connect(audio.master);
    source.start(at);
    source.stop(at + 3);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  let lightningTimer = 0;
  function lightning() {
    if (!reduced.matches && !document.hidden) {
      document.querySelector("#flash")?.animate(
        [{ opacity: 0 }, { opacity: .22 }, { opacity: .04 }, { opacity: .15 }, { opacity: 0 }],
        { duration: 1100 }
      );
      if (audio.on) thunder();
    }
    lightningTimer = setTimeout(lightning, 9000 + Math.random() * 14000);
  }
  if (!reduced.matches) lightningTimer = setTimeout(lightning, 6000);

  window.SilvarainScene = Object.freeze({ toggleRainSound, isSoundOn: () => audio.on });
  addEventListener("pagehide", () => {
    stopParticles();
    clearTimeout(lightningTimer);
    clearTimeout(resizeTimer);
    removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    reduced.removeEventListener?.("change", onMotion);
    components.forEach(component => component.destroy());
    audio.sources.forEach(source => { try { source.stop(); } catch { /* 已停止 */ } });
    if (audio.master) audio.master.disconnect();
  }, { once: true });
})();
