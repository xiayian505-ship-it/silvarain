/** 鹿雨森遊戲入口 UI：只負責按鈕、提示與作品內的轉場流程。 */
(() => {
  "use strict";

  const CONFIG = {
    gameUrl: "", // 正式遊戲尚未連接，保留原本轉場後提示的行為。
    homeUrl: "https://silvarain.stillnessbyslowly.com/"
  };

  const byId = id => document.getElementById(id);
  const toast = window.SlowlyToast?.create("#toast", { duration: 2600, activeClass: "on" });
  const showToast = text => toast ? toast.show(text) : console.warn(text);

  // 鹿角是鹿雨森 Logo，保留原本的 SVG 生成與生長動畫。
  function makeAntlers() {
    let seed = 5;
    const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const paths = [];

    function branch(x, y, angle, length, depth) {
      const endX = x + Math.cos(angle) * length;
      const endY = y + Math.sin(angle) * length;
      const controlX = x + Math.cos(angle - .4) * length * .55;
      const controlY = y + Math.sin(angle - .4) * length * .55;
      paths.push(`M${x.toFixed(1)} ${y.toFixed(1)}Q${controlX.toFixed(1)} ${controlY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`);
      if (depth > 0) {
        branch(endX, endY, angle + .12 + (random() - .5) * .2, length * .8, depth - 1);
        branch(x + (endX - x) * .55, y + (endY - y) * .55,
          angle + .75 + (random() - .5) * .25, length * .5, depth - 1);
      }
      if (depth > 1) {
        branch(x + (endX - x) * .3, y + (endY - y) * .3,
          angle - .7, length * .42, depth - 2);
      }
    }

    branch(0, 0, -Math.PI / 2 - .55, 34, 3);
    const build = scale => `<g transform="translate(100 112)${scale}">${paths.map(d => `<path d="${d}"/>`).join("")}</g>`;
    const svg = byId("antler");
    if (!svg) return;
    svg.innerHTML = build("") + build(" scale(-1 1)");

    svg.querySelectorAll("path").forEach((path, index) => {
      const length = path.getTotalLength();
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
      path.style.transition = `stroke-dashoffset 2.2s ease ${.2 + index % paths.length * .07}s`;
    });
    setTimeout(() => svg.querySelectorAll("path").forEach(path => { path.style.strokeDashoffset = 0; }), 60);
  }
  makeAntlers();

  byId("sound")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const on = await window.SilvarainScene.toggleRainSound();
      button.textContent = `雨聲 · ${on ? "開" : "關"}`;
      button.setAttribute("aria-pressed", String(on));
    } catch (error) {
      console.error(error);
      showToast("雨聲目前無法播放");
    } finally {
      button.disabled = false;
    }
  });

  byId("start")?.addEventListener("click", () => {
    document.body.classList.add("entering");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("silvarain:start"));
      if (CONFIG.gameUrl) {
        location.href = CONFIG.gameUrl;
        return;
      }
      document.body.classList.remove("entering");
      showToast("遊戲場景尚未連接");
    }, 2400);
  });

  byId("leave")?.addEventListener("click", () => {
    location.href = CONFIG.homeUrl;
  });
})();
