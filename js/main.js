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

  /* --------------------------- 吸顶高度实测 ---------------------------
     两处吸顶元素（顶部导航、作品集章节条）高度随断点与触摸端内边距变化，
     锚点偏移量必须按实测值算：触摸端章节条实测 71px，写死 54px 会让标题
     正好压在章节条下面（实测差 9px）。 */
  var syncStickyOffsets = function () {
    var root = document.documentElement;
    var header = document.querySelector(".site-header");
    if (header) {
      var headerHeight = Math.round(header.getBoundingClientRect().height);
      if (headerHeight > 0) root.style.setProperty("--header-total", headerHeight + "px");
    }
    var nav = document.querySelector(".pf-nav");
    if (nav) {
      var navHeight = Math.round(nav.getBoundingClientRect().height);
      if (navHeight > 0) root.style.setProperty("--pf-nav-h", navHeight + "px");
    }
  };
  syncStickyOffsets();
  window.addEventListener("resize", function () {
    raf(syncStickyOffsets);
  });
  // 字体替换后行高会变，吸顶高度要重新量一次
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncStickyOffsets);

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

  /* -------------------------------- 灯箱 --------------------------------
     手机上的核心体验：左右滑动翻页、下滑关闭、双指缩放看细节、放大后拖动平移。 */
  var lightbox = document.getElementById("lightbox");
  if (lightbox) {
    var stage = document.getElementById("lightboxStage");
    var image = document.getElementById("lightboxImg");
    var counter = document.getElementById("lightboxCount");
    var prevButton = document.getElementById("lightboxPrev");
    var nextButton = document.getElementById("lightboxNext");
    var closeButton = lightbox.querySelector(".lightbox-close");
    var triggers = Array.prototype.slice.call(document.querySelectorAll(".pf-slide-btn"));

    // 3200px 源在 2x 屏桌面放到 6x 已是纯拉伸（密度 < 0.3），收到 4x 更实在
    var MAX_SCALE = 4;
    var DOUBLE_TAP_MS = 320;
    var slides = triggers.map(function (trigger) {
      var source = trigger.querySelector("img");
      var src = trigger.getAttribute("data-slide") || "";
      return {
        src: src,
        // 灯箱专用高清档。页内两档（900 / 2160px）在 2x 屏放大后像素不够，
        // 3200px 的 xl 档才能撑住视网膜屏 1:1 以及放大细看。
        xl: trigger.getAttribute("data-slide-xl") || src.replace(/-w\.webp$/, "-xl.webp"),
        alt: source ? source.alt : "作品集大图",
      };
    });
    var sharpToken = 0;

    var view = { scale: 1, tx: 0, ty: 0 };
    var base = { width: 1, height: 1 };
    var current = -1;
    var lastFocus = null;
    var pointers = new Map();
    var pinch = null;
    var drag = null;
    var lastTap = { time: 0, x: 0, y: 0 };
    var lockY = 0;
    var locked = false;

    function apply() {
      var idle = view.scale === 1 && view.tx === 0 && view.ty === 0;
      image.style.transform = idle
        ? ""
        : "translate(" + view.tx + "px, " + view.ty + "px) scale(" + view.scale + ")";
      lightbox.classList.toggle("is-zoomed", view.scale > 1);
    }

    function clampView() {
      if (view.scale <= 1) {
        view.scale = 1;
        view.tx = 0;
        view.ty = 0;
        return;
      }
      var slackX = Math.max(0, (base.width * view.scale - stage.clientWidth) / 2);
      var slackY = Math.max(0, (base.height * view.scale - stage.clientHeight) / 2);
      view.tx = Math.min(slackX, Math.max(-slackX, view.tx));
      view.ty = Math.min(slackY, Math.max(-slackY, view.ty));
    }

    function measure() {
      base.width = image.offsetWidth || 1;
      base.height = image.offsetHeight || 1;
    }

    function resetView() {
      image.style.transition = "";
      view.scale = 1;
      view.tx = 0;
      view.ty = 0;
      apply();
    }

    function animate(ms, mutate) {
      image.style.transition =
        "transform " + ms + "ms cubic-bezier(0.22, 1, 0.36, 1), opacity " + ms + "ms ease";
      mutate();
      window.setTimeout(function () {
        image.style.transition = "";
      }, ms + 40);
    }

    // 以屏幕上某个点为中心缩放：该点下方的内容保持不动
    function zoomAt(clientX, clientY, factor) {
      var box = image.getBoundingClientRect();
      var centerX = box.left + box.width / 2 - view.tx;
      var centerY = box.top + box.height / 2 - view.ty;
      var offsetX = clientX - centerX;
      var offsetY = clientY - centerY;
      var next = Math.min(MAX_SCALE, Math.max(1, view.scale * factor));
      if (Math.abs(next - view.scale) < 0.001) return;
      var k = next / view.scale;
      view.tx = offsetX - (offsetX - view.tx) * k;
      view.ty = offsetY - (offsetY - view.ty) * k;
      view.scale = next;
      clampView();
      apply();
    }

    function preloadNeighbours() {
      [-1, 1].forEach(function (offset) {
        var neighbour = slides[(current + offset + slides.length) % slides.length];
        if (!neighbour || !neighbour.src) return;
        // 只保底预取中等档（通常已在页内缓存）。高清档按需加载：
        // 预取它会让每次滑动都悄悄多下 400KB，移动流量代价太大。
        var warm = new Image();
        warm.decoding = "async";
        warm.src = neighbour.src;
      });
    }

    // 先显示页内已缓存的中等尺寸（秒开），高清档解码完成后再顶上，
    // 这样既不用等大图，放大细看时又足够清晰。
    function upgradeToSharp(slide) {
      if (!slide.xl || slide.xl === slide.src) return;
      var token = (sharpToken += 1);
      var sharp = new Image();
      sharp.decoding = "async";
      sharp.onload = function () {
        if (token !== sharpToken) return;
        if (!lightbox.classList.contains("is-open")) return;
        image.src = slide.xl;
      };
      sharp.src = slide.xl;
    }

    function show(index) {
      if (!slides.length) return;
      current = ((index % slides.length) + slides.length) % slides.length;
      var slide = slides[current];
      image.src = slide.src;
      image.alt = slide.alt;
      counter.textContent = current + 1 + " / " + slides.length;
      resetView();
      upgradeToSharp(slide);
      preloadNeighbours();
    }

    function lockScroll() {
      if (locked) return;
      lockY = window.scrollY || window.pageYOffset || 0;
      document.body.style.top = -lockY + "px";
      document.body.classList.add("lightbox-locked");
      locked = true;
    }

    function unlockScroll() {
      if (!locked) return;
      locked = false;
      document.body.classList.remove("lightbox-locked");
      document.body.style.top = "";
      var root = document.documentElement;
      var behaviour = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, lockY);
      root.style.scrollBehavior = behaviour;
    }

    function open(index, trigger) {
      lastFocus = trigger || null;
      lockScroll();
      lightbox.classList.add("is-open");
      lightbox.classList.remove("is-interacted");
      show(index);
      try {
        closeButton.focus({ preventScroll: true });
      } catch (error) {
        closeButton.focus();
      }
    }

    function close() {
      lightbox.classList.remove("is-open", "is-interacted", "is-zoomed");
      image.style.transition = "";
      image.removeAttribute("src");
      image.style.transform = "";
      unlockScroll();
      pointers.clear();
      pinch = null;
      drag = null;
      if (lastFocus && lastFocus.focus) {
        try {
          lastFocus.focus({ preventScroll: true });
        } catch (error) {
          lastFocus.focus();
        }
      }
    }

    // 松手后的落位：翻页 / 关闭 / 回弹
    function settle(action) {
      if (action === "next" || action === "prev") {
        view.tx = (action === "next" ? -1 : 1) * stage.clientWidth * 0.85;
        image.style.opacity = "0";
        animate(200, apply);
        window.setTimeout(function () {
          image.style.opacity = "";
          show(current + (action === "next" ? 1 : -1));
        }, 180);
        return;
      }
      if (action === "close") {
        view.ty = stage.clientHeight * 0.6;
        image.style.opacity = "0";
        animate(190, apply);
        window.setTimeout(function () {
          image.style.opacity = "";
          close();
        }, 170);
        return;
      }
      animate(220, function () {
        view.tx = 0;
        view.ty = 0;
        view.scale = view.scale > 1 ? view.scale : 1;
        clampView();
        apply();
      });
    }

    function onPointerDown(event) {
      if (event.target.closest("button")) return;
      lightbox.classList.add("is-interacted");
      image.style.transition = "";
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size === 2) {
        var pair = Array.from(pointers.values());
        pinch = {
          distance: Math.max(1, Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)),
          midX: (pair[0].x + pair[1].x) / 2,
          midY: (pair[0].y + pair[1].y) / 2,
        };
        drag = null;
        return;
      }
      if (pointers.size === 1) {
        drag = {
          startX: event.clientX,
          startY: event.clientY,
          lastX: event.clientX,
          lastY: event.clientY,
          axis: null,
          moved: false,
        };
      }
    }

    function onPointerMove(event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pinch && pointers.size >= 2) {
        var pair = Array.from(pointers.values());
        var distance = Math.max(1, Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y));
        var midX = (pair[0].x + pair[1].x) / 2;
        var midY = (pair[0].y + pair[1].y) / 2;
        zoomAt(midX, midY, distance / pinch.distance);
        // 双指整体移动 = 平移
        view.tx += midX - pinch.midX;
        view.ty += midY - pinch.midY;
        clampView();
        apply();
        pinch.distance = distance;
        pinch.midX = midX;
        pinch.midY = midY;
        return;
      }

      if (!drag) return;
      var dx = event.clientX - drag.lastX;
      var dy = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) {
        drag.moved = true;
      }

      if (view.scale > 1) {
        view.tx += dx;
        view.ty += dy;
        clampView();
        apply();
        return;
      }

      // 未放大时：图片跟手移动，松手再决定翻页还是关闭
      if (!drag.axis) {
        if (Math.abs(event.clientX - drag.startX) > 8) drag.axis = "x";
        else if (Math.abs(event.clientY - drag.startY) > 8) drag.axis = "y";
      }
      if (drag.axis === "x") {
        var limit = stage.clientWidth * 0.55;
        view.tx = Math.max(-limit, Math.min(limit, event.clientX - drag.startX));
      } else if (drag.axis === "y") {
        view.ty = Math.max(0, event.clientY - drag.startY);
      }
      apply();
    }

    function onPointerUp(event) {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;

      if (pointers.size > 0 || !drag) {
        drag = null;
        return;
      }

      var finished = drag;
      drag = null;

      // 先判定「点按」：放大状态下也必须能双击还原，所以不能提前 return
      if (!finished.moved) {
        registerTap(event);
        if (view.scale > 1) {
          clampView();
          animate(200, apply);
        }
        return;
      }

      if (view.scale > 1) {
        clampView();
        animate(200, apply);
        return;
      }

      if (finished.axis === "x" && Math.abs(view.tx) > stage.clientWidth * 0.16) {
        settle(view.tx < 0 ? "next" : "prev");
        return;
      }
      if (finished.axis === "y" && view.ty > 110) {
        settle("close");
        return;
      }
      settle("reset");
    }

    // 双击放大 / 再双击还原（iOS 上 double click 不可靠，自己判定）
    function registerTap(event) {
      var now = Date.now();
      var isDouble =
        now - lastTap.time < DOUBLE_TAP_MS &&
        Math.abs(event.clientX - lastTap.x) < 44 &&
        Math.abs(event.clientY - lastTap.y) < 44;
      lastTap = { time: isDouble ? 0 : now, x: event.clientX, y: event.clientY };
      if (!isDouble) return;

      if (view.scale > 1) {
        animate(240, function () {
          view.scale = 1;
          view.tx = 0;
          view.ty = 0;
          apply();
        });
        return;
      }
      if (base.width <= 1) measure();
      animate(240, function () {
        zoomAt(event.clientX, event.clientY, 2.6);
      });
    }

    image.addEventListener("load", function () {
      measure();
      if (view.scale > 1) {
        clampView();
        apply();
      }
    });

    triggers.forEach(function (trigger, index) {
      trigger.addEventListener("click", function () {
        open(index, trigger);
      });
    });

    if (prevButton) {
      prevButton.addEventListener("click", function () {
        settle("prev");
      });
    }
    if (nextButton) {
      nextButton.addEventListener("click", function () {
        settle("next");
      });
    }
    closeButton.addEventListener("click", close);

    lightbox.addEventListener("pointerdown", onPointerDown, { capture: true });
    lightbox.addEventListener("pointermove", onPointerMove);
    lightbox.addEventListener("pointerup", onPointerUp);
    lightbox.addEventListener("pointercancel", onPointerUp);
    lightbox.addEventListener("dragstart", function (event) {
      event.preventDefault();
    });

    lightbox.addEventListener(
      "wheel",
      function (event) {
        if (!lightbox.classList.contains("is-open")) return;
        event.preventDefault();
        lightbox.classList.add("is-interacted");
        zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.16 : 1 / 1.16);
      },
      { passive: false }
    );

    // 鼠标点背景关闭；触摸端靠下滑关闭，避免和双击放大冲突
    lightbox.addEventListener("click", function (event) {
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      if (event.target === lightbox || event.target === stage) close();
    });

    document.addEventListener("keydown", function (event) {
      if (!lightbox.classList.contains("is-open")) return;
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") settle("next");
      else if (event.key === "ArrowLeft") settle("prev");
      else if (event.key === "0") {
        animate(240, function () {
          view.scale = 1;
          view.tx = 0;
          view.ty = 0;
          apply();
        });
      } else if (event.key === "+" || event.key === "=") {
        zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.3);
      } else if (event.key === "-") {
        zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.3);
      }
    });

    // 横竖屏切换后重新测量，缩放上限才不会算错
    window.addEventListener("resize", function () {
      if (!lightbox.classList.contains("is-open")) return;
      measure();
      clampView();
      apply();
    });
  }
})();
