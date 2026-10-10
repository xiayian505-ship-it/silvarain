/**
 * 鹿雨森｜官網 UI 互動
 *
 * 只負責內容的輕量入場動效。
 * 沒有 JavaScript 時，文字與按鈕也會正常顯示。
 */

(() => {
  "use strict";

  const revealItems = document.querySelectorAll("[data-reveal]");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!revealItems.length || prefersReducedMotion.matches) {
    return;
  }

  // IntersectionObserver 不支援時，保留全部內容直接顯示。
  if (!("IntersectionObserver" in window)) {
    return;
  }

  // 只觀察首次進場。已經看過的內容不用反覆消失再出現。
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        continue;
      }

      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, {
    threshold: 0.04,
    rootMargin: "0px 0px 30px 0px"
  });

  document.documentElement.classList.add("has-reveal");

  for (const item of revealItems) {
    observer.observe(item);
  }
})();
