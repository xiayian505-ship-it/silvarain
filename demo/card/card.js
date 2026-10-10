/**
 * 鹿雨森｜卡牌 Demo 遊戲層。
 * 只有牌組、平衡參數與流程對接；完全不複製軍火庫的 Deck、戰鬥或 AI 實作。
 * 卡面渲染、背景及視覺反應由 card_style.js 提供。
 */
(() => {
  "use strict";

  // 所有 id 唯一，效果型別與結構遵照軍火庫 Card Battle v1 文件。
  const cards = [
    { id: "mist-strike-a", name: "穿霧", cost: 1, description: "對迷霧之影造成 6 點傷害。", effects: [{ type: "attack", amount: 6 }], meta: { kind: "attack", symbol: "⌁" } },
    { id: "mist-strike-b", name: "穿霧", cost: 1, description: "對迷霧之影造成 6 點傷害。", effects: [{ type: "attack", amount: 6 }], meta: { kind: "attack", symbol: "⌁" } },
    { id: "forest-light", name: "林間微光", cost: 0, description: "恢復 1 點能量。", effects: [{ type: "energy", amount: 1 }], meta: { kind: "energy", symbol: "✧" } },
    { id: "forest-light-2", name: "林間微光", cost: 0, description: "恢復 1 點能量。", effects: [{ type: "energy", amount: 1 }], meta: { kind: "energy", symbol: "✧" } },
    { id: "moss-shield", name: "苔痕", cost: 1, description: "獲得 7 點護盾。", effects: [{ type: "guard", amount: 7 }], meta: { kind: "guard", symbol: "❖" } },
    { id: "rain-screen", name: "雨幕", cost: 1, description: "獲得 5 點護盾。", effects: [{ type: "guard", amount: 5 }], meta: { kind: "guard", symbol: "◈" } },
    { id: "cold-rain", name: "雨聲", cost: 2, description: "恢復 7 點生命。", effects: [{ type: "heal", amount: 7 }], meta: { kind: "heal", symbol: "☽" } },
    { id: "long-shadow", name: "樹影", cost: 1, description: "造成 4 點傷害，並獲得 3 點護盾。", effects: [{ type: "attack", amount: 4 }, { type: "guard", amount: 3 }], meta: { kind: "hybrid", symbol: "✦" } },
    { id: "reindeer-echo", name: "鹿角餘音", cost: 2, description: "造成 8 點傷害，並恢復 4 點生命。", effects: [{ type: "attack", amount: 8 }, { type: "heal", amount: 4 }], meta: { kind: "hybrid", symbol: "✶" } },
    { id: "moon-strike", name: "殘月", cost: 2, description: "造成 11 點傷害。", effects: [{ type: "attack", amount: 11 }], meta: { kind: "attack", symbol: "☾" } },
    { id: "wanderer-step", name: "林中足跡", cost: 1, description: "造成 5 點傷害。", effects: [{ type: "attack", amount: 5 }], meta: { kind: "attack", symbol: "↟" } },
    { id: "mist-whisper", name: "低語", cost: 0, description: "獲得 2 點護盾。", effects: [{ type: "guard", amount: 2 }], meta: { kind: "guard", symbol: "❂" } }
  ];

  const errorArea = document.querySelector("#battle-error");
  const restartButton = document.querySelector("#restart");
  const required = ["Deck", "CombatStats", "DamageRoll", "ChargeState", "CombatantConfig", "ActionPattern", "SlowlyCardBattle"];
  const missing = required.filter(name => !window[name]);
  if (missing.length) {
    if (errorArea) {
      errorArea.hidden = false;
      errorArea.textContent = "卡牌戰鬥零件載入失敗，請檢查網路或軍火庫引用：" + missing.join("、");
    }
    restartButton.disabled = true;
    console.error("鹿雨森卡牌 Demo：缺少軍火庫依賴", missing);
    return;
  }

  let battle;
  try {
    battle = window.SlowlyCardBattle.mount("#battle", {
      player: { name: "旅人", maxHP: 34, currentHP: 34, shield: 0, energyMax: 3, energy: 3 },
      enemy: {
        name: "迷霧之影", maxHP: 49, currentHP: 49, shield: 0,
        attackMin: 3, attackMax: 5, guardValue: 4, chargeBonus: 3,
        pattern: ["attack", "guard", "attack", "charge", "attack"]
      },
      cards,
      rules: { handSize: 4, resetEnergyEachTurn: true },
      renderers: {
        player: window.SilvarainCardUI?.renderPlayer,
        enemy: window.SilvarainCardUI?.renderEnemy,
        card: window.SilvarainCardUI?.renderCard
      },
      callbacks: {
        onCardPlay({ card }) { window.SilvarainCardUI?.cardPlayed(card); },
        onEnemyAction({ action }) { window.SilvarainCardUI?.enemyActed(action); },
        onWin() { window.SilvarainCardUI?.finished("won"); },
        onLose() { window.SilvarainCardUI?.finished("lost"); },
        onStart() { window.SilvarainCardUI?.started(); }
      }
    });
  } catch (error) {
    if (errorArea) { errorArea.hidden = false; errorArea.textContent = "無法開始試煉：" + error.message; }
    restartButton.disabled = true;
    console.error("鹿雨森卡牌 Demo 啟動失敗", error);
    return;
  }

  restartButton.addEventListener("click", () => {
    if (!window.confirm("要重新開始這場霧林試煉嗎？目前的戰鬥進度會重置。")) return;
    battle.restart();
  });
  addEventListener("pagehide", () => battle.destroy(), { once: true });
})();
