/* 王琪 · Kay 个人网站交互
   只做四件事：年份、手机号打码、滚动入场、作品集灯箱与章节高亮。
   全部为渐进增强，JS 失效时页面内容与导航仍然完整可读。 */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var raf = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 16); };

  /* --------------------------------- 年份 --------------------------------- */
  var yearNode = document.getElementById("year");
  if (yearNode) yearNode.textContent = String(new Date().getFullYear());

  /* ---------------------------- 手机号打码显示 ---------------------------- */
  var phoneValue = document.getElementById("phoneValue");
  var phoneReveal = document.getElementById("phoneReveal");
  if (phoneValue && phoneReveal) {
    var revealed = false;
    phoneReveal.setAttribute("aria-pressed", "false");
    phoneReveal.addEventListener("click", function () {
      revealed = !revealed;
      phoneValue.textContent = revealed
        ? phoneValue.getAttribute("data-full")
        : phoneValue.getAttribute("data-masked");
      phoneReveal.textContent = revealed ? "隐藏号码" : "显示完整号码";
      phoneReveal.setAttribute("aria-pressed", revealed ? "true" : "false");
    });
  }

  /* ------------------------------ 滚动入场动画 ----------------------------
     用位置判定而不是 IntersectionObserver：锚点跳转、快速滚动或页内搜索
     会把某些元素整段跳过，只靠交叉观察回调会让它们永远停在透明状态。 */
  var revealNodes = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (revealNodes.length) {
    if (reduceMotion) {
      revealNodes.forEach(function (node) {
        node.classList.add("is-in");
      });
    } else {
      var pending = revealNodes.slice();
      var revealFrame = 0;

      var sweep = function () {
        revealFrame = 0;
        var limit = window.innerHeight * 0.92;
        pending = pending.filter(function (node) {
          if (node.getBoundingClientRect().top < limit) {
            node.classList.add("is-in");
            return false;
          }
          return true;
        });
        if (!pending.length) {
          window.removeEventListener("scroll", scheduleReveal);
          window.removeEventListener("resize", scheduleReveal);
        }
      };
      var scheduleReveal = function () {
        if (!revealFrame) revealFrame = raf(sweep);
      };

      revealNodes.forEach(function (node, index) {
        node.style.transitionDelay = Math.min(index % 6, 5) * 60 + "ms";
      });
      window.addEventListener("scroll", scheduleReveal, { passive: true });
      window.addEventListener("resize", scheduleReveal);
      sweep();
    }
  }

  /* ---------------------------- 作品集章节滚动高亮 --------------------------
     同样用位置判定：取「顶部已经越过视口 32% 线」的最后一个章节作为当前章节。 */
  var portfolioNav = document.querySelector(".pf-nav-inner");
  if (portfolioNav) {
    var navLinks = Array.prototype.slice.call(portfolioNav.querySelectorAll('a[href^="#"]'));
    var groups = navLinks
      .map(function (link) {
        return document.getElementById(link.getAttribute("href").slice(1));
      })
      .filter(Boolean);
    var activeId = "";

    var setActive = function (id) {
      if (!id || id === activeId) return;
      activeId = id;
      navLinks.forEach(function (link) {
        var on = link.getAttribute("href") === "#" + id;
        link.classList.toggle("is-active", on);
        if (on && portfolioNav.scrollWidth > portfolioNav.clientWidth) {
          var left = link.offsetLeft - portfolioNav.clientWidth / 2 + link.offsetWidth / 2;
          portfolioNav.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
        }
      });
    };

    if (groups.length) {
      var spyFrame = 0;
      var spy = function () {
        spyFrame = 0;
        var line = window.innerHeight * 0.32;
        var current = groups[0].id;
        groups.forEach(function (group) {
          if (group.getBoundingClientRect().top <= line) current = group.id;
        });
        setActive(current);
      };
      var scheduleSpy = function () {
        if (!spyFrame) spyFrame = raf(spy);
      };
      window.addEventListener("scroll", scheduleSpy, { passive: true });
      window.addEventListener("resize", scheduleSpy);
      spy();
    }
  }

  /* -------------------------------- 灯箱 -------------------------------- */
  var lightbox = document.getElementById("lightbox");
  if (lightbox) {
    var lightboxImg = document.getElementById("lightboxImg");
    var lightboxCount = document.getElementById("lightboxCount");
    var closeButton = lightbox.querySelector(".lightbox-close");
    var lastFocus = null;

    var close = function () {
      lightbox.classList.remove("is-open");
      lightboxImg.removeAttribute("src");
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    var open = function (button) {
      var full = button.getAttribute("data-slide");
      if (!full) return;
      lastFocus = button;
      lightboxImg.src = full;
      var source = button.querySelector("img");
      lightboxImg.alt = source ? source.alt : "作品集大图";
      lightboxCount.textContent = (button.getAttribute("data-index") || "") + " / 28";
      lightbox.classList.add("is-open");
      document.body.style.overflow = "hidden";
      closeButton.focus();
    };

    Array.prototype.forEach.call(document.querySelectorAll(".pf-slide-btn"), function (button) {
      button.addEventListener("click", function () {
        open(button);
      });
    });

    closeButton.addEventListener("click", close);
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && lightbox.classList.contains("is-open")) close();
    });
  }
})();
