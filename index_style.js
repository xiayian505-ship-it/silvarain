/** 鹿雨森官網 UI：透過慢慢軍火庫 Auto Reveal 管理入場觀察。 */
(() => {
  "use strict";

  if (!window.SlowlyReveal?.create) {
    console.warn("鹿雨森：Auto Reveal 尚未載入，內容保持可見。");
    return;
  }

  const items = document.querySelectorAll("[data-reveal]");
  items.forEach(item => item.classList.add("slowly-fade-up"));
  const reveal = window.SlowlyReveal.create({
    selector: "[data-reveal]",
    className: "is-visible",
    threshold: 0.04,
    rootMargin: "0px 0px 30px 0px",
    once: true
  });
  addEventListener("pagehide", () => reveal.destroy(), { once: true });
})();
