(function () {
  var btn = document.querySelector('.menu');
  var nav = document.getElementById('spnav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      btn.setAttribute('aria-label', open ? 'メニューを開く' : 'メニューを閉じる');
      nav.hidden = open;
    });
  }

  // 事業・サービス：スクロールで円が回り、真ん中に来た事業の写真と説明に切り替わる（Telescope型）
  var wheel = document.querySelector('[data-wheel]');
  if (wheel) {
    document.documentElement.classList.add('js-wheel');
    var stage = wheel.querySelector('.wheel__sticky');
    var items = wheel.querySelectorAll('.wheel__item');
    var panels = wheel.querySelectorAll('.svp');
    var bgs = wheel.querySelectorAll('.wheel__bg');
    var disc = wheel.querySelector('.wheel__disc');
    var mark = wheel.querySelector('.wheel__mark');
    var count = wheel.querySelector('.wheel__count b');
    var bar = wheel.querySelector('.wheel__bar i');
    var n = items.length, cur = -1, geo = {};
    var measure = function () {
      var W = stage.clientWidth, H = stage.clientHeight, sp = W < 820;
      var R = sp ? H * 0.3 : H * 0.62;
      geo = { sp: sp, R: R, cx: sp ? -R + 12 : -R * 0.4, cy: sp ? H * 0.32 : H * 0.52, step: sp ? 46 : 21 };
      disc.style.cssText = 'width:' + 2 * R + 'px;height:' + 2 * R + 'px;left:' + (geo.cx - R) + 'px;top:' + (geo.cy - R) + 'px';
      mark.style.cssText = 'left:' + (geo.cx + R) + 'px;top:' + geo.cy + 'px';
    };
    var span = function () { return wheel.offsetHeight - stage.offsetHeight; };
    var progress = function () {
      var t = -wheel.getBoundingClientRect().top / span();
      return Math.max(0, Math.min(1, t)) * (n - 1);
    };
    var setActive = function (k) {
      if (k === cur) return;
      cur = k;
      items.forEach(function (b, i) { b.classList.toggle('is-active', i === k); b.setAttribute('aria-current', i === k ? 'true' : 'false'); });
      panels.forEach(function (p, i) { p.classList.toggle('is-active', i === k); });
      bgs.forEach(function (g, i) { g.classList.toggle('is-active', i === k); });
      count.textContent = ('0' + (k + 1)).slice(-2);
    };
    var render = function () {
      var p = progress();
      items.forEach(function (b, i) {
        var a = (i - p) * geo.step * Math.PI / 180;
        var x = geo.cx + geo.R * Math.cos(a) + 28, y = geo.cy + geo.R * Math.sin(a);
        b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translateY(-50%)';
        b.style.opacity = Math.max(geo.sp ? 0 : 0.18, 1 - Math.abs(i - p) * (geo.sp ? 1.15 : 0.55)).toFixed(2);
      });
      disc.style.transform = 'rotate(' + (-p * geo.step).toFixed(2) + 'deg)';
      bar.style.transform = 'scaleX(' + (p / (n - 1)).toFixed(3) + ')';
      setActive(Math.round(p));
    };
    var ticking = false;
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; render(); }); } };
    var goTo = function (i, smooth) {
      var top = wheel.getBoundingClientRect().top + window.scrollY + span() * i / (n - 1) + 2;
      var y0 = window.scrollY;
      window.scrollTo({ top: top, behavior: smooth ? 'smooth' : 'instant' });
      if (smooth) setTimeout(function () { if (window.scrollY === y0) window.scrollTo({ top: top, behavior: 'instant' }); }, 400);
    };
    items.forEach(function (b, i) {
      b.addEventListener('click', function () {
        goTo(i, true);
        if (history.replaceState) history.replaceState(null, '', '#' + b.dataset.target);
      });
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { measure(); render(); });
    measure(); render();
    var start = -1;
    items.forEach(function (b, i) { if ('#' + b.dataset.target === location.hash) start = i; });
    if (start >= 0) {
      // ブラウザ自身のリンク先への移動が終わってから、その事業の位置に合わせ直す
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      var jump = function () { goTo(start, false); render(); };
      jump();
      if (document.readyState === 'complete') setTimeout(jump, 60);
      else window.addEventListener('load', function () { setTimeout(jump, 60); });
    }
  }

  // トップの事業欄：見えたら4枚が集まって回り始める／「詳しく見る」で弾けてから詳細へ
  var cyl = document.querySelector('.cyl');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (cyl && !still) {
    document.documentElement.classList.add('js-cyl');
    var gather = function () {
      cyl.classList.add('is-in');
      window.removeEventListener('scroll', check);
    };
    // 画面に入ったら集める。見張りが反応しない環境のために、スクロール時の位置確認と6秒後の保険も置く
    var check = function () {
      var r = cyl.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.8 && r.bottom > 0) gather();
    };
    if ('IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { gather(); cio.disconnect(); } }, { threshold: .25 });
      cio.observe(cyl);
    }
    window.addEventListener('scroll', check, { passive: true });
    check();
    setTimeout(gather, 6000);

    // 回転はJSで動かす：ふだんは自動で回り、つかんで左右に引くと回せる（離すと勢いで回ってから、ふだんの速さに戻る）
    var ring = cyl.querySelector('.cyl__ring');
    var auto = -360 / 32, angle = 0, vel = auto, prev = performance.now();
    var dragging = false, moved = false, hover = false, startX = 0, lastX = 0, lastT = 0;
    var tick = function (now) {
      var dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (cyl.classList.contains('is-in') && !cyl.classList.contains('is-burst') && !dragging) {
        vel += (auto * (hover ? 0.3 : 1) - vel) * Math.min(1, dt * 2);
        angle += vel * dt;
      }
      ring.style.transform = 'rotateY(' + angle.toFixed(2) + 'deg)';
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    cyl.querySelectorAll('a').forEach(function (a) { a.draggable = false; });
    cyl.addEventListener('mouseenter', function () { hover = true; });
    cyl.addEventListener('mouseleave', function () { hover = false; });
    cyl.addEventListener('pointerdown', function (ev) {
      if (ev.button || cyl.classList.contains('is-burst')) return;
      dragging = true; moved = false;
      startX = lastX = ev.clientX; lastT = performance.now(); vel = 0;
    });
    window.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var now = performance.now(), dx = ev.clientX - lastX, dt = Math.max(0.008, (now - lastT) / 1000);
      if (Math.abs(ev.clientX - startX) > 6) { moved = true; cyl.classList.add('is-dragging'); }
      angle += dx * 0.35;
      vel = Math.max(-480, Math.min(480, dx * 0.35 / dt));
      lastX = ev.clientX; lastT = now;
    });
    var release = function () {
      if (!dragging) return;
      dragging = false;
      if (performance.now() - lastT > 120) vel = 0;
      cyl.classList.remove('is-dragging');
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    // 引いて回した直後のクリックは、カードを押したことにしない
    cyl.addEventListener('click', function (ev) {
      if (moved) { ev.preventDefault(); ev.stopPropagation(); moved = false; }
    }, true);

    cyl.querySelectorAll('.svc').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || cyl.classList.contains('is-burst')) return;
        ev.preventDefault();
        a.parentNode.classList.add('is-picked');
        cyl.classList.add('is-burst');
        var colors = ['#0e2a4d', '#1f62b8', '#e2a43a', '#a9c6ee'];
        for (var i = 0; i < 28; i++) {
          var d = document.createElement('span');
          d.className = 'burst-dot';
          d.style.background = colors[i % colors.length];
          document.body.appendChild(d);
          var ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 260;
          d.animate([
            { transform: 'translate(' + ev.clientX + 'px,' + ev.clientY + 'px) scale(1) rotate(0deg)', opacity: 1 },
            { transform: 'translate(' + (ev.clientX + Math.cos(ang) * dist) + 'px,' + (ev.clientY + Math.sin(ang) * dist) + 'px) scale(.2) rotate(' + (Math.random() * 540) + 'deg)', opacity: 0 }
          ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
        }
        setTimeout(function () { location.href = a.href; }, 720);
      });
    });
    // 戻るボタンで戻ってきた時に、弾けたままにしない
    window.addEventListener('pageshow', function () {
      cyl.classList.remove('is-burst');
      cyl.querySelectorAll('.is-picked').forEach(function (el) { el.classList.remove('is-picked'); });
      document.querySelectorAll('.burst-dot').forEach(function (el) { el.remove(); });
    });
  }

  // ふわっと出す演出。IntersectionObserver が無い環境では何もしない（＝最初から表示）
  if (!('IntersectionObserver' in window)) return;
  var targets = document.querySelectorAll('.sec__head, .svcs .svc, .str, .lcard, .gcard, .lg, .flow, .sv, .step, .intro__in, .msg, .phil, .tbl');
  document.documentElement.classList.add('js');
  targets.forEach(function (el) { el.classList.add('rv'); });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach(function (el) { io.observe(el); });
  // 万一 observer が発火しなくても 2.5 秒後には全部出す
  setTimeout(function () { targets.forEach(function (el) { el.classList.add('is-in'); }); }, 2500);
})();
