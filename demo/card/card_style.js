/**
 * 鹿雨森｜卡牌 Demo 美術層。
 * 控制軍火庫自然效果的參數、卡面呈現、戰鬥特效。
 * 所有可見美術均為程式樣式，日後正式立繪與卡圖可由宿主替換。
 */
(() => {
  "use strict";
  const instances = [];
  const forest = window.SlowlyPineForest;
  const fog = window.SlowlyCanvasFog;
  const rain = window.SlowlyCanvasRain;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // 這些繪圖函式完全來自軍火庫，鹿雨森只有配置，沒有複製演算法。
  try {
    if (forest?.create) instances.push(forest.create({
      canvas: "#forest", seed: 31, maxDpr: 1.4, density: 0.86,
      layers: [
        { baseline: 0.75, minHeight: 0.18, maxHeight: 0.34, color: "#193a35", width: 0.4 },
        { baseline: 0.94, minHeight: 0.32, maxHeight: 0.51, color: "#071b1e", width: 0.4 }
      ]
    }));
    if (fog?.create) instances.push(fog.create({
      canvas: "#fog", count: reduceMotion.matches ? 8 : 19, color: "#b3d2c9", opacity: 0.48,
      size: 1.15, speed: reduceMotion.matches ? 0 : 0.45, maxDpr: 1.4, autoStart: !reduceMotion.matches
    }));
    if (rain?.create) instances.push(rain.create({
      canvas: "#weather", count: reduceMotion.matches ? 18 : Math.min(145, Math.max(55, Math.floor(innerWidth / 9))),
      color: "#c7e4e0", opacity: 0.52, speed: 0.72, wind: 0.17, length: 0.6,
      maxDpr: 1.4, autoStart: !reduceMotion.matches
    }));
  } catch (error) {
    console.warn("鹿雨森：場景部分特效無法載入，仍可正常遊玩卡牌。", error);
  }

  // 利用軍火庫 renderer 插槽放入宿主的符號美術，與正式美術資產脫鉤。
  function makeVisual(container, side) {
    container.replaceChildren();
    const emblem = document.createElement("div");
    emblem.className = `silva-combat-symbol silva-combat-symbol--${side}`;
    emblem.setAttribute("aria-hidden", "true");
    const core = document.createElement("span");
    core.className = "silva-combat-symbol-core";
    core.textContent = side === "player" ? "✧" : "◈";
    const ring = document.createElement("span");
    ring.className = "silva-combat-symbol-ring";
    emblem.append(ring, core);
    container.appendChild(emblem);
  }
  function renderPlayer(container) { makeVisual(container, "player"); }
  // Boss 的原型採用宿主 CSS 程式美術：沒有「卡牌外框」，之後可換正式立繪。
  function renderEnemy(container) {
    container.replaceChildren();
    const figure = document.createElement("div");
    figure.className = "silva-foe";
    figure.setAttribute("aria-hidden", "true");
    ["halo", "antler left", "antler right", "cloak", "face", "eyes", "ground"].forEach((piece) => {
      const part = document.createElement("span");
      part.className = piece.startsWith("antler ")
        ? `silva-foe-antler ${piece.split(" ")[1]}`
        : `silva-foe-${piece}`;
      figure.appendChild(part);
    });
    container.appendChild(figure);
  }

  const kinds = {
    attack: "攻擊", guard: "守護", heal: "治癒", energy: "靈息", hybrid: "共鳴"
  };
  function renderCard(button, { card }) {
    const kind = kinds[card.meta?.kind] ? card.meta.kind : "hybrid";
    button.dataset.kind = kind;
    button.replaceChildren();

    const upper = document.createElement("span");
    upper.className = "silva-card-upper";
    const family = document.createElement("span");
    family.className = "silva-card-family";
    family.textContent = kinds[kind];
    const cost = document.createElement("span");
    cost.className = "silva-card-cost";
    cost.textContent = String(card.cost);
    cost.setAttribute("aria-label", `耗費 ${card.cost} 點能量`);
    upper.append(family, cost);

    const art = document.createElement("span");
    art.className = "silva-card-art";
    art.setAttribute("aria-hidden", "true");
    const sigil = document.createElement("span");
    sigil.textContent = card.meta?.symbol || "✧";
    art.append(sigil);

    const name = document.createElement("strong");
    name.className = "scb-card-name";
    name.textContent = card.name;
    const desc = document.createElement("span");
    desc.className = "scb-card-description";
    desc.textContent = card.description;
    button.append(upper, art, name, desc);
  }

  // 宿主視覺互動：選牌提示與飛牌純動畫，不處理戰鬥規則。
  let selectionHint = null;
  function installSelectionHint() {
    const section = document.querySelector("#battle .scb-hand-section");
    if (!section || selectionHint?.isConnected) return;
    selectionHint = document.createElement("p");
    selectionHint.className = "silva-selection-hint";
    selectionHint.setAttribute("role", "status");
    selectionHint.setAttribute("aria-live", "polite");
    section.prepend(selectionHint);
  }
  function setHint(message) {
    if (!selectionHint?.isConnected) installSelectionHint();
    if (selectionHint) selectionHint.textContent = message;
  }

  const flights = new Set();
  const waitAnimation = async (element, frames, options) => {
    const animation = element.animate(frames, options);
    try { await animation.finished; } catch (_) { /* canceled by navigation/restart */ }
  };
  async function flyCard(source, card) {
    if (reduceMotion.matches || !source?.isConnected) return;
    const attack = (card.effects || []).some(effect => effect.type === "attack");
    const heal = (card.effects || []).some(effect => effect.type === "heal");
    const kind = attack ? "attack" : heal ? "heal" : "guard";
    const target = document.querySelector(attack
      ? "#battle .scb-enemy-panel .scb-visual"
      : "#battle .scb-player-panel .scb-visual");
    if (!target) return;

    const from = source.getBoundingClientRect();
    const dest = target.getBoundingClientRect();
    const dx = dest.left + dest.width / 2 - (from.left + from.width / 2);
    const dy = dest.top + dest.height / 2 - (from.top + from.height / 2);
    const copy = source.cloneNode(true);
    copy.classList.remove("silva-selected");
    copy.classList.add("silva-card-flight", `silva-card-flight--${kind}`);
    copy.removeAttribute("aria-pressed");
    copy.setAttribute("aria-hidden", "true");
    copy.tabIndex = -1;
    copy.disabled = true;
    Object.assign(copy.style, {
      left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`,
      height: `${from.height}px`, minHeight: "0", margin: "0", transform: "none"
    });
    document.body.append(copy);
    flights.add(copy);
    source.classList.add("silva-launching");
    try {
      await waitAnimation(copy, [
        { transform: "translate(0px,0px) rotate(0deg) scale(1)", opacity: 1, offset: 0 },
        { transform: `translate(${dx * .42}px,${dy * .41 - 38}px) rotate(-7deg) scale(.86)`, opacity: 1, offset: .5 },
        { transform: `translate(${dx}px,${dy}px) rotate(9deg) scale(.24)`, opacity: 0, offset: 1 }
      ], { duration: 520, easing: "cubic-bezier(.22,.67,.3,1)", fill: "forwards" });
      impact(dest, kind);
    } finally {
      flights.delete(copy);
      copy.remove();
      source.classList.remove("silva-launching");
    }
  }
  function impact(rect, kind) {
    if (reduceMotion.matches) return;
    const flare = document.createElement("span");
    flare.className = `silva-card-flare silva-card-flare--${kind}`;
    flare.setAttribute("aria-hidden", "true");
    flare.style.left = `${rect.left + rect.width / 2}px`;
    flare.style.top = `${rect.top + rect.height / 2}px`;
    document.body.appendChild(flare);
    void waitAnimation(flare, [
      { transform: "translate(-50%,-50%) scale(.3)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(.95)", opacity: .82, offset: .32 },
      { transform: "translate(-50%,-50%) scale(1.65)", opacity: 0 }
    ], { duration: 460, easing: "ease-out", fill: "forwards" }).finally(() => flare.remove());
  }

  let effectTimeout = 0;
  const burst = document.querySelector("#card-burst");
  function pulse(target, effectClass) {
    if (reduceMotion.matches) return;
    const panel = document.querySelector(`#battle .scb-${target}-panel`);
    if (!panel) return;
    panel.classList.remove("card-impact", "card-protect", "card-recover");
    void panel.offsetWidth;
    panel.classList.add(effectClass);
  }
  function flash(kind) {
    if (reduceMotion.matches || !burst) return;
    burst.className = "card-burst";
    void burst.offsetWidth;
    burst.classList.add("card-burst", `card-burst--${kind}`);
    clearTimeout(effectTimeout);
    effectTimeout = setTimeout(() => { burst.className = "card-burst"; }, 690);
  }
  function cardPlayed(card) {
    const effects = card.effects || [];
    if (effects.some(effect => effect.type === "attack")) pulse("enemy", "card-impact");
    else if (effects.some(effect => effect.type === "heal")) pulse("player", "card-recover");
    else pulse("player", "card-protect");
    flash(card.meta?.kind === "attack" ? "attack" : "heal");
  }
  function enemyActed(action) {
    pulse(action === "attack" ? "player" : "enemy", action === "attack" ? "card-impact" : "card-protect");
    flash(action === "attack" ? "attack" : "heal");
  }
  function finished(result) {
    const stage = document.querySelector(".card-stage");
    if (stage) stage.dataset.result = result;
    flash(result === "won" ? "heal" : "attack");
  }
  function started() {
    const stage = document.querySelector(".card-stage");
    if (stage) stage.removeAttribute("data-result");
  }

  window.SilvarainCardUI = Object.freeze({
    renderPlayer, renderEnemy, renderCard, cardPlayed, enemyActed, finished, started,
    installSelectionHint, setHint, flyCard
  });
  addEventListener("pagehide", () => {
    clearTimeout(effectTimeout);
    flights.forEach(node => node.remove());
    flights.clear();
    instances.forEach(instance => { try { instance.destroy(); } catch (_) { /* already destroyed */ } });
  }, { once: true });
})();
