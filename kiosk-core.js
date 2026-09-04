/* KIOSK CORE - silnik pętli (zegar scenariusza, tryb auto/ręczny/pauza), chrome sceny, ustawienia, motyw, samotest, watchdog.
   Widoki produktowe: kiosk-views.js (KIOSK_VIEWS), postaci: kiosk-companions.js (KIOSK_COMPANIONS) - oba dostają z tego pliku obiekt K z pomocnikami.
   Cienka powłoka index.html ładuje kiosk-icons.js, kiosk-data.js, robot.js, kiosk-views.js, kiosk-companions.js i ten plik.
   Parametry URL: ?p=N produkt (0-6), ?s=N scenariusz (0-2), ?speed=0.5|0.75|1|1.5|2, ?robot=0|1, ?cat=0|1, ?hero=0|1, ?theme=dark|light (nadpisują localStorage). */
(function () {
  "use strict";
  // ─── Constants ───
  const PHASE_MS = 1500;
  const T = [0, 1.2, 2.2, 3.2, 4.2, 5.6, 7.0].map(function (x) { return Math.round(x * PHASE_MS); });
  const HOLD_MS = 6000;
  const IDLE_MS = 20000;
  const FRAME_REF_W = 1920;   // szerokość kadru, przy której postaci mają skalę 1
  const LOGO = { dark: "quantica-logo-white.png", light: "quantica-logo-color.png" };
  const PRODUCTS = window.KIOSK_PRODUCTS;
  const URLP = new URLSearchParams(location.search), TEST = URLP.get("test") === "1";   // ?test=1: samotest (patrz selfTest)
  const PERSIST = !TEST;   // samotest nie zapisuje niczego do localStorage
  const earlyErrors = [];   // błędy od załadowania skryptu (także w Init, zanim samotest zarejestruje własne nasłuchy)
  if (TEST) { addEventListener("error", function (e) { earlyErrors.push(String(e.message || e)); }); addEventListener("unhandledrejection", function (e) { earlyErrors.push(String(e.reason)); }); }
  const SVG = {
    prev: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m15 18-6-6 6-6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
    next: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m9 18 6-6-6-6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
    pause: "<svg class=\"ico-pause\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 5v14M15 5v14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
    play: "<svg class=\"ico-play\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5v14l11-7z\" fill=\"currentColor\"/></svg>",
    replay: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
    gear: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"3\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/></svg>",
    full: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"
  };

  // ─── State ───
  const SPEEDS = [0.5, 0.75, 1, 1.5, 2];
  let speed = 1;
  try { speed = parseFloat(localStorage.getItem("kiosk-speed")) || 1; } catch (e) {}
  let st, pi = 0, si = 0, pass = 0, manual = false, idleT = null, idleTick = null, idleLeft = 0, hiddenPaused = false, swapT = null;
  const total = T[6] + HOLD_MS;   // czas bazowy scenariusza; realny czas = total / speed
  let view = null;

  // ─── Zegar scenariusza: jedna kolejka dla silnika i widoków, czas bazowy (ms) skalowany tempem ───
  // Pauza zatrzymuje zegar, więc zatrzymuje też animacje widoków; zmiana tempa nie gubi kroków; spóźniony krok wykonuje się przy wznowieniu.
  // Jeden ticker rAF dla zegara scenariusza i wszystkich postaci (robot, kot, bohaterowie); dt w sekundach, ograniczone do 50 ms
  const ticker = (function () {
    let fns = [], last = performance.now();
    const raf = (TEST || URLP.get("tick") === "timer") ? function (fn) { setTimeout(function () { fn(performance.now()); }, TEST ? 50 : 16); } : requestAnimationFrame;   // headless/ukryta karta: rAF nie tyka, timer tak (test: 20 kl/s, mniej rysowania)
    // pętla uzbraja się przed wywołaniami, a każdy subskrybent ma własny try/catch: błąd jednej postaci nie zatrzymuje zegara ani pozostałych;
    // wyjątek trafia do window.onerror (watchdog / samotest) przez setTimeout
    function frame(t) {
      let dt = Math.min(0.05, (t - last) / 1000); last = t;
      raf(frame);
      for (let i = 0; i < fns.length; i += 1) { try { fns[i](dt); } catch (e) { setTimeout(function () { throw e; }, 0); } }
    }
    raf(frame);
    return { add: function (fn) { fns.push(fn); } };
  })();
  let queue = [], clock = 0, running = false, startAt = 0;
  function now() { return running ? clock + (Date.now() - startAt) * speed : clock; }
  function at(ms, fn) {   // kolejka trzymana posortowana przy wstawianiu (wpisów bywa kilkaset: pisanie znak po znaku)
    let t = now() + ms, i = queue.length;
    while (i > 0 && queue[i - 1].t > t) { i -= 1; }
    queue.splice(i, 0, { t: t, fn: fn });
  }
  function wait(fn, ms) { at(ms, fn); }
  function clear() { queue = []; }
  ticker.add(function () {
    if (!running) { return; }
    while (queue.length && queue[0].t <= now()) { queue.shift().fn(); }
  });
  function startClock() { startAt = Date.now(); running = true; }
  function stopClock() { clock = now(); running = false; }

  // ─── DOM refs (po renderze chrome) ───
  const refs = {};   // wypełniane w Init (Object.assign), ten sam obiekt trafia do widoków i postaci
  let viewFor = null, CO = null;   // fabryka widoków (kiosk-views.js) i postaci (kiosk-companions.js), tworzone w Init

  // ─── Helpers ───
  function el(id) { return document.getElementById(id); }
  // Płótna i dymki postaci leżą wewnątrz .k-frame, więc liczą w układzie kadru: (0,0) to jego lewy górny róg, overflow kadru przycina je sam.
  // Prostokąty kart z getBoundingClientRect() są w układzie okna - przelicza je frameOrigin(). Kadr mierzony raz na zmianę rozmiaru (syncFrame).
  let frameCache = null, origin = { left: 0, top: 0 };
  function measureFrame() {
    let r = refs.frame ? refs.frame.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    origin = { left: r.left, top: r.top };
    return { left: 0, top: 0, right: r.width, bottom: r.height, width: r.width, height: r.height };
  }
  function frameRect() { return frameCache || measureFrame(); }
  function frameOrigin() { return origin; }
  function scale() { return frameRect().width / FRAME_REF_W; }
  function px(v) { return v * scale(); }
  function syncFrame() { frameCache = measureFrame(); }
  function q(sel) { return st.querySelector(sel); }
  // Ikony z kiosk-icons.js (osadzone lokalnie): <i data-lucide="x" class="icon"> -> <svg class="icon">; tylko w podanym poddrzewie
  function icons(root) {
    Array.prototype.forEach.call((root || st).querySelectorAll("i[data-lucide]"), function (i) {
      let body = window.KIOSK_ICONS && window.KIOSK_ICONS[i.getAttribute("data-lucide")];
      if (!body) { return; }
      let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", i.className); svg.setAttribute("data-icon", i.getAttribute("data-lucide"));
      svg.innerHTML = body;
      i.parentNode.replaceChild(svg, i);
    });
  }
  function esc(t) { let d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
  function product() { return PRODUCTS[pi]; }
  function scenario() { return product().scenarios[si]; }
  function stepText(n, s) { return s.steps[n] || s.checks[n - 2]; }
  function setIcon(host, name) {
    let i = document.createElement("i"); i.setAttribute("data-lucide", name); i.className = "icon";
    host.replaceChild(i, host.firstChild); icons(host);
  }
  function addRows(box, rows, delayStep) {
    box.innerHTML = "";
    rows.forEach(function (c, k) {
      let d = document.createElement("div");
      d.className = "cite" + (c[2] ? " " + c[2] : "");
      d.innerHTML = "<i data-lucide=\"" + c[0] + "\" class=\"icon\"></i><span></span>";
      d.lastChild.textContent = c[1];
      box.appendChild(d);
      wait(function () { d.classList.add("show"); }, delayStep * (k + 1));
    });
    icons(box);
  }
  function setBadge(b, s, p) {
    b.lastChild.textContent = s.badge;
    b.className = "badge show" + (p.outputs[s.target].tone === "teal" ? " teal" : "");
  }

  // ─── Render: chrome ───
  function chrome() {
    return "<div class=\"k-frame\" id=\"kFrame\"><header class=\"k-head\"><img class=\"k-logo\" id=\"kLogo\" src=\"" + LOGO.dark + "\" alt=\"Quantica Lab\">" +
      "<nav class=\"k-rail\" id=\"kRail\" aria-label=\"Produkty\">" + PRODUCTS.map(function (p, k) { return "<button type=\"button\" data-p=\"" + k + "\" aria-pressed=\"false\">" + esc(p.name) + "</button>"; }).join("") + "</nav>" +
      "<button class=\"k-theme\" id=\"kTheme\" type=\"button\" aria-label=\"Przełącz schemat jasny/ciemny\"><i data-lucide=\"sun\" class=\"icon ico-sun\"></i><i data-lucide=\"moon\" class=\"icon ico-moon\"></i></button></header>" +
      "<div class=\"k-headline\"><div class=\"k-copy\" id=\"kCopy\"><h1 class=\"k-h1\" id=\"kName\"></h1><p class=\"k-tagline\" id=\"kTag\"></p></div>" +
      "<p class=\"k-phase\"><span class=\"k-phase-dot\" aria-hidden=\"true\"></span><span class=\"k-phase-text\" id=\"kPhase\" role=\"status\" aria-live=\"polite\"></span></p></div>" +
      "<div id=\"kView\"></div>" +
      "<footer class=\"k-bar\"><div class=\"k-area\"><div class=\"k-tabs\" id=\"kTabs\" role=\"group\" aria-label=\"Scenariusze\"></div>" +
      "<div class=\"k-prog-row\"><span class=\"k-mode\" id=\"kMode\">Tryb automatyczny</span><div class=\"k-prog\" id=\"kProgBar\" role=\"progressbar\" aria-label=\"Postęp scenariusza\" aria-valuemin=\"0\" aria-valuemax=\"100\" aria-valuenow=\"0\"><i id=\"kProg\"></i></div><span class=\"k-idle\">Powrót do pętli za <b id=\"kIdle\">20</b> s</span></div></div>" +
      "<div class=\"k-ctl\" aria-label=\"Sterowanie prezentacją\">" +
      "<button class=\"k-btn\" data-act=\"prev\" type=\"button\" aria-label=\"Poprzedni scenariusz\" title=\"Poprzedni scenariusz\">" + SVG.prev + "</button>" +
      "<button class=\"k-btn\" data-act=\"play\" type=\"button\" aria-label=\"Zatrzymaj / wznów\" title=\"Zatrzymaj / wznów\">" + SVG.pause + SVG.play + "</button>" +
      "<button class=\"k-btn\" data-act=\"settings\" type=\"button\" aria-label=\"Ustawienia\" title=\"Ustawienia\" aria-expanded=\"false\">" + SVG.gear + "</button>" +
      "<button class=\"k-btn\" data-act=\"next\" type=\"button\" aria-label=\"Następny scenariusz\" title=\"Następny scenariusz\">" + SVG.next + "</button>" +
      "<button class=\"k-btn\" data-act=\"full\" type=\"button\" aria-label=\"Pełny ekran\" title=\"Pełny ekran\">" + SVG.full + "</button>" +
      "</div></footer>" +
      "<div class=\"k-pop\" id=\"kPop\" hidden>" +
      "<div class=\"k-row\"><span class=\"k-pop-t\">Tempo</span><div class=\"k-speeds\" id=\"kSpeeds\">" +
      SPEEDS.map(function (v) { return "<button type=\"button\" data-speed=\"" + v + "\">" + v + "×</button>"; }).join("") + "</div></div>" +
      "<div class=\"k-row\"><span class=\"k-pop-t\">Robot</span><button class=\"k-toggle\" id=\"kRobot\" type=\"button\" aria-pressed=\"false\"><i></i><span>wyłączony</span></button></div>" +
      "<div class=\"k-row\"><span class=\"k-pop-t\">Kot</span><button class=\"k-toggle\" id=\"kCat\" type=\"button\" aria-pressed=\"false\"><i></i><span>wyłączony</span></button></div>" +
      "<div class=\"k-row\"><span class=\"k-pop-t\">Bohaterowie</span><button class=\"k-toggle\" id=\"kHero\" type=\"button\" aria-pressed=\"false\"><i></i><span>wyłączony</span></button></div>" +
      "<div class=\"k-row\"><span class=\"k-pop-t\">Scenariusz</span><button class=\"k-pop-replay\" type=\"button\" data-act=\"replay\">" + SVG.replay + "od nowa</button></div></div></div>";
  }
  function renderTabs(p) {
    refs.tabs.innerHTML = p.tabs.map(function (t, k) { return "<button class=\"k-tab\" type=\"button\" data-scn=\"" + k + "\"><span>" + (k + 1) + "</span><span>" + esc(t) + "</span></button>"; }).join("");
    Array.prototype.forEach.call(refs.tabs.children, function (t) { t.addEventListener("click", function () { select(parseInt(t.getAttribute("data-scn"), 10)); }); });
  }

  // ─── Silnik pętli: produkty × scenariusze, auto / ręczny / pauza ───
  function setState(state) {
    st.setAttribute("data-state", state);
    refs.mode.textContent = state === "paused" ? "Pauza" : (manual ? "Tryb ręczny" : "Tryb automatyczny");
  }
  function progress(fromMs) {
    refs.progBar.setAttribute("aria-valuenow", String(Math.round(fromMs / total * 100)));
    refs.prog.style.transition = "none"; refs.prog.style.transform = "scaleX(" + (fromMs / total) + ")";
    void refs.prog.offsetWidth;
    refs.prog.style.transition = "transform " + ((total - fromMs) / speed) + "ms linear"; refs.prog.style.transform = "scaleX(1)";
  }
  function freezeProgress() { let pct = Math.min(now(), total) / total * 100; refs.progBar.setAttribute("aria-valuenow", String(Math.round(pct))); refs.prog.style.transition = "none"; refs.prog.style.transform = "scaleX(" + (pct / 100) + ")"; }
  function schedule() {
    let s = scenario();
    T.forEach(function (t, n) {
      at(t, function () { view.step(n, s); refs.phase.textContent = stepText(n, s); st.setAttribute("data-phase", String(n + 1)); });
    });
    at(total, function () { setState("done"); if (!manual) { advanceAuto(); } });
    startClock();
    progress(0);
    setState("playing");
  }
  function mountProduct(k) {
    pi = k;
    let p = product();
    Array.prototype.forEach.call(refs.rail.children, function (b, j) { b.classList.toggle("on", j === k); b.setAttribute("aria-pressed", j === k ? "true" : "false"); });
    refs.copy.classList.add("swap");
    clearTimeout(swapT);   // szybka zmiana produktu: poprzednia nazwa nie mignie
    swapT = setTimeout(function () { refs.name.textContent = p.name; refs.tag.innerHTML = p.tagline; refs.copy.classList.remove("swap"); }, 300);
    renderTabs(p);
    view = viewFor(p);
    st.setAttribute("data-product", p.id);
  }
  function play(k, i) {
    clear(); running = false; clock = 0; hiddenPaused = false;
    if (k !== pi || !view) { mountProduct(k); }
    si = i;
    let s = scenario();
    Array.prototype.forEach.call(refs.tabs.children, function (t, j) { t.classList.toggle("on", j === i); t.setAttribute("aria-pressed", j === i ? "true" : "false"); });
    st.setAttribute("data-scn", String(i));
    refs.phase.textContent = "";
    view.reset(s); st.setAttribute("data-phase", "0"); icons(refs.view);
    schedule();
    CO.heroTick();
  }
  // Tryb automatyczny: jeden scenariusz z każdej symulacji, w kolejnym obiegu następny scenariusz
  function advanceAuto() {
    let k = (pi + 1) % PRODUCTS.length;
    if (k === 0) { pass += 1; }
    if (reloadDue) { reload({ p: k, s: pass % PRODUCTS[k].scenarios.length, pass: pass, crashes: 0 }); return; }   // okresowe przeładowanie: pętla idzie dalej od tego samego miejsca
    play(k, pass % PRODUCTS[k].scenarios.length);
  }
  function advance(dir) {
    let n = product().scenarios.length, j = si + dir, k = pi;
    if (j >= n) { j = 0; k = (pi + 1) % PRODUCTS.length; }
    if (j < 0) { k = (pi + PRODUCTS.length - 1) % PRODUCTS.length; j = PRODUCTS[k].scenarios.length - 1; }
    play(k, j);
  }
  function pause() { if (st.getAttribute("data-state") !== "playing") { return; } stopClock(); freezeProgress(); setState("paused"); }
  function resume() { if (st.getAttribute("data-state") !== "paused") { return; } startClock(); progress(now()); setState("playing"); }
  function stopIdle() { clearTimeout(idleT); clearInterval(idleTick); }
  function touch() {
    stopIdle();
    manual = true; st.setAttribute("data-mode", "manual"); idleLeft = IDLE_MS / 1000;
    refs.idle.textContent = idleLeft;
    setState(st.getAttribute("data-state") || "playing");
    idleTick = setInterval(function () { idleLeft -= 1; refs.idle.textContent = Math.max(0, idleLeft); }, 1000);
    idleT = setTimeout(function () {   // powrót do pętli: trwający scenariusz dogrywa się do końca (koniec sam przełącza dalej), pauza i "done" przełączają od razu
      stopIdle(); manual = false; st.setAttribute("data-mode", "loop");
      if (st.getAttribute("data-state") === "playing") { setState("playing"); } else { advanceAuto(); }
    }, IDLE_MS);
  }
  function select(i) { touch(); play(pi, i); }
  function selectProduct(k) { touch(); play(k, 0); }
  function act(name) {
    if (name === "settings") { togglePop(); return; }
    if (name === "full") {   // odmowa (iframe, polityka uprawnień, trwająca zmiana) to nie błąd: bez .catch watchdog przeładowałby kiosk
      let pr = document.fullscreenElement ? document.exitFullscreen() : (document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen() : null);
      if (pr && pr.catch) { pr.catch(function () {}); }
      return;
    }
    touch();
    if (name === "prev") { advance(-1); }
    else if (name === "next") { advance(1); }
    else if (name === "replay") { play(pi, si); }
    else if (name === "play") {
      let state = st.getAttribute("data-state");
      if (state === "playing") { pause(); } else if (state === "paused") { resume(); } else { play(pi, si); }
    }
  }

  // ─── Ustawienia: tempo (zapamiętane w localStorage) ───
  function setSpeed(v, persist) {   // persist === false: zastosuj bez zapisu (parametr URL, samotest)
    let prevSpeed = speed;
    speed = v;
    if (persist !== false && PERSIST) { try { localStorage.setItem("kiosk-speed", String(v)); } catch (e) {} }
    Array.prototype.forEach.call(refs.speeds.children, function (b) { b.classList.toggle("on", parseFloat(b.getAttribute("data-speed")) === v); });
    st.setAttribute("data-speed", String(v));
    if (running) { clock = clock + (Date.now() - startAt) * prevSpeed; startAt = Date.now(); progress(clock); }
  }
  function togglePop(force) {
    let open = typeof force === "boolean" ? force : refs.pop.hidden;
    refs.pop.hidden = !open;
    refs.setBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  // ─── Motyw (zapamiętany w localStorage) ───
  let theme = "dark";
  function applyTheme(t, persist) {   // persist === false: bez zapisu (parametr URL)
    theme = t;
    st.classList.toggle("t-dark", t === "dark"); st.classList.toggle("t-light", t === "light");
    refs.logo.src = LOGO[t]; st.setAttribute("data-theme", t);
    if (persist !== false && PERSIST) { try { localStorage.setItem("kiosk-theme", t); } catch (e) {} }
  }
  function initTheme() {
    try { theme = localStorage.getItem("kiosk-theme") === "light" ? "light" : "dark"; } catch (e) {}
    refs.theme.addEventListener("click", function () { applyTheme(theme === "dark" ? "light" : "dark"); });
    applyTheme(theme);
  }

  // ─── Listeners ───
  function listen() {
    Array.prototype.forEach.call(st.querySelectorAll(".k-btn, .k-pop-replay"), function (b) { b.addEventListener("click", function () { act(b.getAttribute("data-act")); }); });
    Array.prototype.forEach.call(refs.speeds.children, function (b) { b.addEventListener("click", function () { touch(); setSpeed(parseFloat(b.getAttribute("data-speed"))); }); });
    refs.robotBtn.addEventListener("click", function () { touch(); CO.setRobot(!CO.robotOn()); });
    refs.catBtn.addEventListener("click", function () { touch(); CO.setCat(!CO.catOn()); });
    refs.heroBtn.addEventListener("click", function () { touch(); CO.setHero(!CO.heroOn()); });
    st.addEventListener("pointerdown", function (e) { if (!refs.pop.hidden && !e.target.closest(".k-pop, [data-act=settings]")) { togglePop(false); } });
    Array.prototype.forEach.call(refs.rail.children, function (b) { b.addEventListener("click", function () { selectProduct(parseInt(b.getAttribute("data-p"), 10)); }); });
    st.addEventListener("pointerdown", function (e) { if (!e.target.closest(".k-tab, .k-btn, .k-theme, .k-rail, .k-pop")) { touch(); } });
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) { return; }
      if (/^[1-9]$/.test(e.key)) { let i = parseInt(e.key, 10) - 1; if (i < product().scenarios.length) { select(i); } }
      else if (e.key === " ") { e.preventDefault(); act("play"); }
      else if (e.key === "ArrowLeft") { act("prev"); }
      else if (e.key === "ArrowRight") { act("next"); }
      else if (e.key === "ArrowUp") { selectProduct((pi + PRODUCTS.length - 1) % PRODUCTS.length); }
      else if (e.key === "ArrowDown") { selectProduct((pi + 1) % PRODUCTS.length); }
      else if (e.key === "r" || e.key === "R") { act("replay"); }
      else if (e.key === "s" || e.key === "S") { act("settings"); }
      else if (e.key === "Escape") { togglePop(false); }
      else if (e.key === "f" || e.key === "F") { act("full"); }
    });
    // Blokada wygaszania ekranu: od startu (nie wymaga dotknięcia), ponawiana po zwolnieniu i po powrocie karty
    let lock = null;
    function wakeLock() {
      if (!navigator.wakeLock || document.hidden || lock) { return; }
      navigator.wakeLock.request("screen").then(function (l) { lock = l; l.addEventListener("release", function () { lock = null; setTimeout(wakeLock, 1000); }); }).catch(function () { setTimeout(wakeLock, 30000); });
    }
    document.addEventListener("visibilitychange", function () {
      if (TEST) { return; }
      if (document.hidden) { if (st.getAttribute("data-state") === "playing") { pause(); hiddenPaused = true; } return; }
      wakeLock();   // przeglądarka zwalnia blokadę przy ukryciu karty
      if (hiddenPaused) { hiddenPaused = false; resume(); }
    });
    wakeLock();
  }

  // ─── Samotest (?test=1): każdy scenariusz każdego produktu odtwarzany do końca przy tempie 4×; wynik w data-test na scenie i w konsoli.
  //     Uruchamiany bez sieci w headless Chrome przez scripts/smoke.sh; błąd skryptu lub scenariusz, który nie dochodzi do fazy 7, oznacza porażkę.
  //     ?tick=timer (bez testu): ticker na setTimeout zamiast rAF, do zrzutów ekranu w headless ───
  function selfTest() {
    let errors = earlyErrors, list = [], done = 0, failed = [];
    PRODUCTS.forEach(function (p, k) { p.scenarios.forEach(function (_, i) { list.push([k, i]); }); });
    setSpeed(4, false); CO.setRobot(true, false); CO.setCat(true, false); CO.setHero(true, false);   // 4×: ~4 s na scenariusz; nic nie trafia do localStorage
    st.setAttribute("data-test", "running:0/" + list.length);
    function next() {
      if (done >= list.length) {
        let ok = !errors.length && !failed.length;
        st.setAttribute("data-test", (ok ? "ok:" : "fail:") + (list.length - failed.length) + "/" + list.length + (failed.length ? " missed=" + failed.join(";") : "") + (errors.length ? " errors=" + errors.join(" | ") : ""));
        console.log("KIOSK TEST " + st.getAttribute("data-test"));
        return;
      }
      let k = list[done][0], i = list[done][1], deadline = Date.now() + total / speed + 4000;
      manual = true;   // koniec scenariusza nie przełącza sam dalej; test steruje ręcznie
      play(k, i);
      (function poll() {
        if (st.getAttribute("data-phase") === "7" && st.getAttribute("data-state") === "done") { done += 1; st.setAttribute("data-test", "running:" + done + "/" + list.length); next(); return; }
        if (Date.now() > deadline) { failed.push(PRODUCTS[k].id + "#" + i + "@" + st.getAttribute("data-phase")); done += 1; next(); return; }
        setTimeout(poll, 100);
      })();
    }
    next();
  }

  // ─── Watchdog: całodzienna praca stoiska. Błąd skryptu przeładowuje stronę; co kilka godzin przeładowanie na granicy scenariusza zwalnia pamięć ───
  //     Stan (produkt, scenariusz, obieg) przechodzi przez sessionStorage. Awarie liczone są jako kolejne, gdy błąd przyszedł w ciągu 30 s od startu:
  //     druga z rzędu wznawia od NASTĘPNEGO scenariusza (zepsuty scenariusz nie blokuje pozostałych), od trzeciej odstęp rośnie do minuty.
  const RELOAD_AFTER_ERROR_MS = 5000, RELOAD_BACKOFF_MS = 60000, CRASH_SKIP_AFTER = 2, CRASH_BACKOFF_AFTER = 3, CRASH_WINDOW_MS = 30000, RELOAD_EVERY_MS = 4 * 3600 * 1000;
  let reloadDue = false, resumed = null;   // resumed: stan z sessionStorage po przeładowaniu ({ p, s, pass, crashes }) albo null
  try { let r = sessionStorage.getItem("kiosk-resume"); if (r) { sessionStorage.removeItem("kiosk-resume"); resumed = JSON.parse(r); } } catch (e) {}
  function reload(state) { try { sessionStorage.setItem("kiosk-resume", JSON.stringify(state)); } catch (e) {} location.reload(); }
  function watchdog() {
    let crashes = (resumed && resumed.crashes) || 0, bootAt = Date.now(), errT = null;
    function onError() {
      if (errT || TEST) { return; }
      let n = Date.now() - bootAt < CRASH_WINDOW_MS ? crashes + 1 : 1;   // liczone w chwili błędu, nie w chwili przeładowania
      errT = setTimeout(function () { reload({ p: pi, s: si, pass: pass, crashes: n }); }, n > CRASH_BACKOFF_AFTER ? RELOAD_BACKOFF_MS : RELOAD_AFTER_ERROR_MS);
    }
    addEventListener("error", onError);
    addEventListener("unhandledrejection", onError);
    setTimeout(function () { reloadDue = true; }, RELOAD_EVERY_MS);
  }

  // ─── Init ───
  try {
    st = document.getElementById("stage");
    st.className = "stage t-dark";
    st.innerHTML = chrome();
    icons(st);
    Object.assign(refs, { frame: el("kFrame"), logo: el("kLogo"), rail: el("kRail"), theme: el("kTheme"), pop: el("kPop"), speeds: el("kSpeeds"), robotBtn: el("kRobot"), catBtn: el("kCat"), heroBtn: el("kHero"), setBtn: st.querySelector("[data-act=settings]"), copy: el("kCopy"), name: el("kName"), tag: el("kTag"), phase: el("kPhase"), view: el("kView"), tabs: el("kTabs"), mode: el("kMode"), prog: el("kProg"), progBar: el("kProgBar"), idle: el("kIdle") });
    Array.prototype.forEach.call(document.querySelectorAll("#robot, #cat, #hero, .robot-wrap"), function (n) { refs.frame.appendChild(n); });   // warstwy postaci wewnątrz kadru: wspólny kontekst z-index z nagłówkiem, stopką i popoverem; overflow kadru je przycina
    syncFrame(); addEventListener("resize", syncFrame);
    viewFor = window.KIOSK_VIEWS({ refs: refs, el: el, esc: esc, wait: wait, at: at, icons: icons, setIcon: setIcon, addRows: addRows, setBadge: setBadge });
    CO = window.KIOSK_COMPANIONS({ st: st, refs: refs, px: px, scale: scale, frameRect: frameRect, frameOrigin: frameOrigin, ticker: ticker, speed: function () { return speed; }, persist: PERSIST });
    initTheme();
    listen();
    setSpeed(SPEEDS.indexOf(speed) >= 0 ? speed : 1);
    // Parametry URL nadpisują localStorage bez zapisu (profil przeglądarki kiosku bywa czyszczony; skrypt startowy może ustawić wszystko w adresie)
    function pref(key, fallback) { let v = URLP.get(key); if (v !== null) { return v; } try { return localStorage.getItem("kiosk-" + key) || fallback; } catch (e) { return fallback; } }
    if (SPEEDS.indexOf(parseFloat(URLP.get("speed"))) >= 0) { setSpeed(parseFloat(URLP.get("speed")), false); }
    if (URLP.get("theme") === "light" || URLP.get("theme") === "dark") { applyTheme(URLP.get("theme"), false); }
    CO.setRobot(pref("robot", "1") === "1", URLP.get("robot") === null);   // wartość z adresu nie zapisuje się do localStorage
    CO.setCat(pref("cat", "1") === "1", URLP.get("cat") === null);
    CO.setHero(pref("hero", "1") === "1", URLP.get("hero") === null);
    st.setAttribute("data-mode", "loop");
    watchdog();
    let startP = parseInt(URLP.get("p") || "0", 10), startS = parseInt(URLP.get("s") || "0", 10) || 0;
    if (resumed) {   // po przeładowaniu (błąd albo okresowe): to samo miejsce w pętli; po dwóch awariach z rzędu - następny scenariusz
      startP = parseInt(resumed.p, 10) || 0; startS = parseInt(resumed.s, 10) || 0; pass = parseInt(resumed.pass, 10) || 0;
      if ((resumed.crashes || 0) >= CRASH_SKIP_AFTER) { startS += 1; if (startS >= (PRODUCTS[startP] || PRODUCTS[0]).scenarios.length) { startS = 0; startP = (startP + 1) % PRODUCTS.length; } }
    }
    startP = isNaN(startP) ? 0 : Math.max(0, Math.min(PRODUCTS.length - 1, startP));
    startS = Math.max(0, Math.min(PRODUCTS[startP].scenarios.length - 1, startS));
    if (TEST) { selfTest(); } else { play(startP, startS); }   // samotest sam wybiera scenariusze; nasłuchy błędów działają od załadowania skryptu
    window.KIOSK = { play: play, select: select, selectProduct: selectProduct, act: act, setRobot: CO.setRobot, setCat: CO.setCat, setHero: CO.setHero, heroNow: function (kind) { if (CO.hero()) { CO.hero().launch(kind); } }, heroState: function () { return CO.hero() ? CO.hero().state : null; }, catAgain: function () { if (CO.cat()) { CO.cat().again(); } }, catState: function () { return CO.cat() ? CO.cat().state : null; }, setSpeed: setSpeed, products: PRODUCTS };
  } catch (e) {   // błąd w Init: samotest dostaje komunikat zamiast "page did not initialise"; poza testem błąd idzie dalej do watchdoga
    if (TEST) { document.getElementById("stage").setAttribute("data-test", "fail:init " + (e && e.message || e)); }
    throw e;
  }
})();
