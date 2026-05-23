(function () {
  "use strict";

  function platformText() {
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      return navigator.userAgentData.platform;
    }
    return [navigator.platform, navigator.userAgent].filter(Boolean).join(" ");
  }

  function isAllowedDesktop() {
    var platform = platformText();
    var isMac = /mac/i.test(platform);
    var isWindows = /win/i.test(platform);
    var isMobileUA = /android|iphone|ipad|ipod|mobile|tablet/i.test(navigator.userAgent || "");
    var isTouchTablet = navigator.maxTouchPoints > 1 && isMac;
    var enoughCanvas = Math.min(window.innerWidth || 0, window.screen && window.screen.width || 0) >= 900;
    return (isMac || isWindows) && !isMobileUA && !isTouchTablet && enoughCanvas;
  }

  if (isAllowedDesktop()) {
    return;
  }

  document.documentElement.classList.add("desktop-gate-active");

  var style = document.createElement("style");
  style.textContent = [
    ".desktop-gate-active body{overflow:hidden!important}",
    ".desktop-gate-active body>*:not(.desktop-gate){filter:blur(8px);pointer-events:none;user-select:none}",
    ".desktop-gate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 20%,rgba(145,70,255,.24),rgba(10,6,18,.98) 54%,#05030a);color:#fff;font-family:Geist,-apple-system,BlinkMacSystemFont,system-ui,sans-serif}",
    ".desktop-gate__card{width:min(440px,100%);border:1px solid rgba(192,165,255,.2);border-radius:14px;background:rgba(13,8,24,.86);box-shadow:0 24px 80px rgba(0,0,0,.48);padding:26px;text-align:left}",
    ".desktop-gate__eyebrow{font:600 11px/1 Geist Mono,ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#b388ff;margin:0 0 12px}",
    ".desktop-gate__title{font-size:28px;line-height:1.05;margin:0 0 12px;letter-spacing:0;font-weight:700}",
    ".desktop-gate__copy{margin:0;color:#cfc7e7;font-size:14px;line-height:1.65}",
    ".desktop-gate__spec{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}",
    ".desktop-gate__spec span{border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:7px 10px;color:#e7ddff;background:rgba(255,255,255,.045);font:600 11px/1 Geist Mono,ui-monospace,Menlo,monospace}"
  ].join("");
  document.head.appendChild(style);

  function mountGate() {
    if (document.querySelector(".desktop-gate")) {
      return;
    }
    var gate = document.createElement("section");
    gate.className = "desktop-gate";
    gate.setAttribute("role", "alertdialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-label", "Desktop access required");
    gate.innerHTML = [
      '<div class="desktop-gate__card">',
      '<p class="desktop-gate__eyebrow">KC Live desktop only</p>',
      '<h1 class="desktop-gate__title">Open this on Mac or Windows desktop.</h1>',
      '<p class="desktop-gate__copy">This dashboard is built for a wide operator workspace with live charts, forecast tables, embeds, and API telemetry. Phones and tablets are blocked so the experience stays stable.</p>',
      '<div class="desktop-gate__spec"><span>Mac desktop</span><span>Windows desktop</span><span>900px+ viewport</span></div>',
      "</div>"
    ].join("");
    document.body.appendChild(gate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountGate);
  } else {
    mountGate();
  }

  window.addEventListener("resize", function () {
    if (isAllowedDesktop()) {
      document.documentElement.classList.remove("desktop-gate-active");
      var gate = document.querySelector(".desktop-gate");
      if (gate) {
        gate.remove();
      }
    } else {
      document.documentElement.classList.add("desktop-gate-active");
      mountGate();
    }
  });
})();
