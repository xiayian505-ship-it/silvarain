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

  // 外部只操控官方公開 API：一次選取，第二次才 playCard(index)。
  // 不改動、不複製軍火庫的戰鬥與出牌流程。
  const battleRoot = document.querySelector("#battle");
  let selected = null;
  let playing = false;
  let playGeneration = 0;
  let enemyBusy = false;
  let enemyGeneration = 0;
  let pendingEnemyVisual = null;
  let battle;

  function hint(text) {
    window.SilvarainCardUI?.setHint(text);
  }

  function deselect({ quiet = false } = {}) {
    if (selected?.isConnected) {
      selected.classList.remove("silva-selected");
      selected.setAttribute("aria-pressed", "false");
    }
    selected = null;
    if (!quiet && !playing) hint("點一下選牌，再點同一張出牌。點空白處取消。");
  }

  function select(button) {
    deselect({ quiet: true });
    selected = button;
    button.classList.add("silva-selected");
    button.setAttribute("aria-pressed", "true");
    hint(`已選取「${button.querySelector(".scb-card-name")?.textContent || "卡牌"}」｜再點一次出牌`);
  }

  function cancelEnemySequence() {
    // 重新開始時廢止等待中的動畫，絕不把舊回合的攻擊提交到新戰局。
    enemyGeneration += 1;
    enemyBusy = false;
    pendingEnemyVisual = null;
    battleRoot.classList.remove("silva-enemy-busy");
    window.SilvarainCardUI?.clearEnemyEffects();
  }

  function resetInteraction() {
    // 新回合、重開或戰鬥結束時，舊動畫不可以再提交舊的出牌操作。
    playGeneration += 1;
    playing = false;
    battleRoot.classList.remove("silva-card-busy");
    deselect();
  }

  async function commit(button) {
    if (playing || button.disabled) return;
    const index = Number(button.dataset.cardIndex);
    const state = battle.getState();
    const card = state.deck.hand[index];
    if (state.status !== "playing" || state.turn !== "player" || !card) return;
    if (state.player.energy < Number(card.cost || 0)) return;

    playing = true;
    battleRoot.classList.add("silva-card-busy");
    const generation = ++playGeneration;
    hint(`施放「${card.name}」…`);

    try {
      // 從「已抬起的卡牌」位置起飛；複製出飛牌後才解除選取外觀。
      // 純視覺飛牌，不計算傷害。動畫抵達時才正式呼叫軍火庫。
      const flight = window.SilvarainCardUI?.flyCard(button, card);
      deselect({ quiet: true });
      await flight;
      if (generation !== playGeneration) return;
      battle.playCard(index);
    } catch (error) {
      if (generation === playGeneration) {
        console.error("鹿雨森：卡牌施放失敗", error);
        hint("卡牌施放未成功，請再試一次。");
      }
    } finally {
      if (generation === playGeneration) {
        playing = false;
        battleRoot.classList.remove("silva-card-busy");
        if (battle.getState().status === "playing") deselect();
      }
    }
  }

  // 軍火庫預設的 endTurn() 是同步結算：Boss 雖會造成傷害，卻會瞬間回到玩家回合。
  // 由宿主攔住按鈕，先呈現出手動作，之後仍只呼叫官方 endTurn()。
  async function commitEnemyTurn() {
    if (!battleReady || enemyBusy || playing) return;
    const current = battle.getState();
    if (current.status !== "playing" || current.turn !== "player") return;

    enemyBusy = true;
    const generation = ++enemyGeneration;
    battleRoot.classList.add("silva-enemy-busy");
    deselect({ quiet: true });
    pendingEnemyVisual = null;
    try {
      await window.SilvarainCardUI?.enemyWindup();
      if (generation !== enemyGeneration) return;
      const result = battle.endTurn();
      if (result.ended && pendingEnemyVisual) await pendingEnemyVisual;
    } catch (error) {
      if (generation === enemyGeneration) {
        console.error("鹿雨森：敵方行動展示失敗", error);
        hint("敵方回合發生問題，請再試一次。");
      }
    } finally {
      if (generation === enemyGeneration) {
        enemyBusy = false;
        pendingEnemyVisual = null;
        battleRoot.classList.remove("silva-enemy-busy");
      }
    }
  }

  let battleReady = false;
  // capture 階段先阻止軍火庫原本的「一點即出牌」click handler。
  // 完整保留軍火庫自身 disable、energy、effect、AI、回合管理。
  battleRoot.addEventListener("click", event => {
    const endButton = event.target.closest(".scb-end-turn");
    if (endButton && battleRoot.contains(endButton)) {
      event.stopPropagation();
      event.preventDefault();
      if (!endButton.disabled) void commitEnemyTurn();
      return;
    }
    const button = event.target.closest(".scb-card");
    if (button && battleRoot.contains(button)) {
      event.stopPropagation();
      event.preventDefault();
      if (!battleReady || playing || enemyBusy || button.disabled) return;
      if (button === selected) void commit(button);
      else select(button);
      return;
    }
    if (!playing && !enemyBusy) deselect();
  }, true);

  // 點卡牌以外的區域或按 Escape 都可以取消當前選擇。
  document.addEventListener("click", event => {
    if (!battleRoot.contains(event.target) && !playing && !enemyBusy) deselect({ quiet: true });
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !playing && !enemyBusy && selected) {
      const previous = selected;
      deselect();
      previous?.focus();
    }
  });

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
        onEnemyAction({ action, result }) {
          // onEnemyAction 會在軍火庫完成真正結算後觸發；只用結果繪製傷害回饋。
          pendingEnemyVisual = window.SilvarainCardUI?.enemyActed(action, result);
        },
        onWin() { window.SilvarainCardUI?.finished("won"); },
        onLose() { window.SilvarainCardUI?.finished("lost"); },
        onStart() { resetInteraction(); window.SilvarainCardUI?.started(); },
        onTurnStart() { resetInteraction(); },
        onFinish() { resetInteraction(); }
      }
    });
  } catch (error) {
    if (errorArea) { errorArea.hidden = false; errorArea.textContent = "無法開始試煉：" + error.message; }
    restartButton.disabled = true;
    console.error("鹿雨森卡牌 Demo 啟動失敗", error);
    return;
  }

  battleReady = true;
  window.SilvarainCardUI?.installSelectionHint();
  window.SilvarainCardUI?.installEnemyStatus();
  hint("點一下選牌，再點同一張出牌。點空白處取消。");

  restartButton.addEventListener("click", () => {
    if (!window.confirm("要重新開始這場霧林試煉嗎？目前的戰鬥進度會重置。")) return;
    cancelEnemySequence();
    resetInteraction();
    battle.restart();
  });
  addEventListener("pagehide", () => { cancelEnemySequence(); resetInteraction(); battle.destroy(); }, { once: true });
})();
