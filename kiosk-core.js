/* KIOSK CORE - silnik pętli, chrome sceny, widoki produktowe (projekt 01: diagram), motyw.
   Cienka powłoka kiosk-flow.html ładuje kiosk-data.js, robot.js i ten plik. */
(function () {
  "use strict";
  // ─── Constants ───
  const PHASE_MS = 1500;
  const T = [0, 1.2, 2.2, 3.2, 4.2, 5.6, 7.0].map(function (x) { return Math.round(x * PHASE_MS); });
  const HOLD_MS = 6000;
  const IDLE_MS = 20000;
  const LOGO = { dark: "quantica-logo-white.png", light: "quantica-logo-color.png" };
  const PRODUCTS = window.KIOSK_PRODUCTS;
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
  let st, pi = 0, si = 0, pass = 0, manual = false, idleT = null, idleTick = null, idleLeft = 0, hiddenPaused = false;
  const total = T[6] + HOLD_MS;   // czas bazowy scenariusza; realny czas = total / speed
  let view = null;

  // ─── Zegar scenariusza: jedna kolejka dla silnika i widoków, czas bazowy (ms) skalowany tempem ───
  // Pauza zatrzymuje zegar, więc zatrzymuje też animacje widoków; zmiana tempa nie gubi kroków; spóźniony krok wykonuje się przy wznowieniu.
  let queue = [], clock = 0, running = false, startAt = 0, rafId = 0;
  function now() { return running ? clock + (Date.now() - startAt) * speed : clock; }
  function at(ms, fn) { queue.push({ t: now() + ms, fn: fn }); }
  function wait(fn, ms) { at(ms, fn); }
  function clear() { queue = []; }
  function tick() {
    rafId = 0;
    if (!running) { return; }
    for (;;) {
      queue.sort(function (a, b) { return a.t - b.t; });
      if (!queue.length || queue[0].t > now()) { break; }
      queue.shift().fn();
    }
    if (running) { rafId = requestAnimationFrame(tick); }
  }
  function startClock() { startAt = Date.now(); running = true; if (!rafId) { rafId = requestAnimationFrame(tick); } }
  function stopClock() { clock = now(); running = false; }

  // ─── DOM refs (po renderze chrome) ───
  let refs = {};

  // ─── Helpers ───
  function el(id) { return document.getElementById(id); }
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
    return "<header class=\"k-head\"><img class=\"k-logo\" id=\"kLogo\" src=\"" + LOGO.dark + "\" alt=\"Quantica Lab\">" +
      "<nav class=\"k-rail\" id=\"kRail\" aria-label=\"Produkty\">" + PRODUCTS.map(function (p, k) { return "<button type=\"button\" data-p=\"" + k + "\" aria-pressed=\"false\">" + esc(p.name) + "</button>"; }).join("") + "</nav>" +
      "<button class=\"k-theme\" id=\"kTheme\" type=\"button\" aria-label=\"Przełącz schemat jasny/ciemny\"><i data-lucide=\"sun\" class=\"icon ico-sun\"></i><i data-lucide=\"moon\" class=\"icon ico-moon\"></i></button></header>" +
      "<div class=\"k-headline\"><div class=\"k-copy\" id=\"kCopy\"><h1 class=\"k-h1\" id=\"kName\"></h1><p class=\"k-tagline\" id=\"kTag\"></p></div>" +
      "<p class=\"k-phase\"><span class=\"k-phase-dot\" aria-hidden=\"true\"></span><span class=\"k-phase-text\" id=\"kPhase\"></span></p></div>" +
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
      "<div class=\"k-row\"><span class=\"k-pop-t\">Scenariusz</span><button class=\"k-pop-replay\" type=\"button\" data-act=\"replay\">" + SVG.replay + "od nowa</button></div></div>";
  }
  function renderTabs(p) {
    refs.tabs.innerHTML = p.tabs.map(function (t, k) { return "<button class=\"k-tab\" type=\"button\" data-scn=\"" + k + "\"><span>" + (k + 1) + "</span><span>" + esc(t) + "</span></button>"; }).join("");
    Array.prototype.forEach.call(refs.tabs.children, function (t) { t.addEventListener("click", function () { select(parseInt(t.getAttribute("data-scn"), 10)); }); });
  }

  // ─── Render: projekt 01 (diagram) ───
  function flowView(p) {
    refs.view.innerHTML = "<div class=\"fl-wrap\"><div class=\"fl\">" +
      "<div class=\"fl-node\" id=\"fQ\"><span class=\"fl-no\">01</span><h3><i data-lucide=\"" + p.nodes.input.icon + "\" class=\"icon\"></i>" + esc(p.nodes.input.title) + "</h3><p class=\"fl-q\" id=\"fQT\"></p></div>" +
      "<div class=\"fl-link\" id=\"fL1\"><i></i></div>" +
      "<div class=\"fl-node\" id=\"fS\"><span class=\"fl-no\">02</span><h3><i data-lucide=\"" + p.nodes.process.icon + "\" class=\"icon\"></i>" + esc(p.nodes.process.title) + "</h3><ul class=\"fl-checks\">" +
      p.nodes.process.icons.map(function (ic, k) { return "<li id=\"fC" + k + "\"><i data-lucide=\"" + ic + "\" class=\"icon\"></i><span></span></li>"; }).join("") + "</ul></div>" +
      "<div class=\"fl-link\" id=\"fL2\"><i></i></div>" +
      "<div class=\"fl-node\" id=\"fR\"><span class=\"fl-no\">03</span><h3><i data-lucide=\"file-check\" class=\"icon\"></i><span id=\"fRT\"></span></h3>" +
      "<p class=\"fl-prev\" id=\"fRP\"></p><div class=\"fl-cites\" id=\"fRC\"></div><div class=\"badge\" id=\"fRB\"><i data-lucide=\"quote\" class=\"icon\"></i><span></span></div></div>" +
      "</div></div>";
    let r = { q: el("fQ"), qt: el("fQT"), l1: el("fL1"), s: el("fS"), c: [el("fC0"), el("fC1"), el("fC2")], l2: el("fL2"), n: el("fR"), rt: el("fRT"), rp: el("fRP"), rc: el("fRC"), rb: el("fRB") };
    return {
      reset: function (s) {
        let out = p.outputs[s.target];
        [r.q, r.s, r.n].forEach(function (x) { x.className = "fl-node"; });
        [r.l1, r.l2].forEach(function (x) { x.className = "fl-link"; });
        r.c.forEach(function (x, k) { x.classList.remove("on"); x.lastChild.textContent = s.checks[k]; });
        r.qt.textContent = s.input;
        r.n.setAttribute("data-target", out.tone === "teal" ? "nodata" : s.target);
        r.rt.textContent = out.title; setIcon(r.n.querySelector("h3"), out.icon);
        r.rp.className = "fl-prev"; r.rp.innerHTML = ""; r.rc.innerHTML = ""; r.rb.className = "badge";
      },
      step: function (n, s) {
        if (n === 0) { r.q.classList.add("on"); }
        if (n === 1) { r.q.className = "fl-node done"; r.l1.classList.add("on"); r.s.classList.add("on"); }
        if (n >= 2 && n <= 4) { r.c[n - 2].classList.add("on"); }
        if (n === 5) { r.s.className = "fl-node done"; r.l1.className = "fl-link done"; r.l2.classList.add("on"); r.n.classList.add("on"); r.rp.innerHTML = s.preview; r.rp.classList.add("show"); }
        if (n === 6) { addRows(r.rc, s.rows, 250); setBadge(r.rb, s, p); }
      }
    };
  }

  // ─── Widoki produktowe (projekt 01): każdy produkt ma własny kształt sceny ───
  function card(cls, id, icon, title, sub, extra) {
    return "<div class=\"card " + cls + "\" id=\"" + id + "\"><h3><i data-lucide=\"" + icon + "\" class=\"icon\"></i><span>" + esc(title) + "</span></h3>" + (sub ? "<div class=\"sub\">" + esc(sub) + "</div>" : "") + (extra || "") + "</div>";
  }
  function checksList(prefix, icns) {
    return "<ul class=\"fl-checks\">" + icns.map(function (ic, k) { return "<li id=\"" + prefix + k + "\"><i data-lucide=\"" + ic + "\" class=\"icon\"></i><span></span></li>"; }).join("") + "</ul>";
  }

  // Klara: zapytanie -> router z pokrętłem -> trzy trasy
  function klaraView(p) {
    let outs = p.viz.outcomes;
    refs.view.innerHTML = "<div class=\"kv kv-klara\">" +
      card("", "kQ", p.nodes.input.icon, p.nodes.input.title, "", "<p class=\"fl-q\" id=\"kQT\"></p>") +
      "<div class=\"fl-link\" id=\"kL1\"><i></i></div>" +
      card("kr-router", "kR", "route", "Router", "gdzie trafi zadanie", checksList("kC", p.nodes.process.icons)) +
      "<div class=\"kr-gap\"></div>" +
      "<div class=\"kr-outs\">" + outs.map(function (o, k) { return card("kr-out", "kO" + k, o.icon, o.title, o.sub, "<div class=\"kr-tag\" id=\"kT" + k + "\"></div><p class=\"prev\" id=\"kP" + k + "\"></p><div class=\"rows\" id=\"kRw" + k + "\"></div><div class=\"badge\" id=\"kB" + k + "\"><i data-lucide=\"quote\" class=\"icon\"></i><span></span></div>"); }).join("") + "</div>" +
      "</div>";
    let r = { q: el("kQ"), qt: el("kQT"), l1: el("kL1"), router: el("kR"), c: [el("kC0"), el("kC1"), el("kC2")] };
    let cards = outs.map(function (_, k) { return el("kO" + k); });
    function chosen(s) { return outs.map(function (o) { return o.key; }).indexOf(Object.keys(s.route).filter(function (k) { return s.route[k] === "on"; })[0]); }
    return {
      reset: function (s) {
        r.q.className = "card"; r.qt.textContent = s.input; r.l1.className = "fl-link"; r.router.className = "card kr-router";
        r.c.forEach(function (x, k) { x.classList.remove("on"); x.removeAttribute("data-route"); x.lastChild.textContent = s.checks[k]; });
        outs.forEach(function (o, k) { cards[k].className = "card kr-out"; el("kT" + k).textContent = ""; el("kP" + k).className = "prev"; el("kP" + k).innerHTML = ""; el("kRw" + k).innerHTML = ""; el("kB" + k).className = "badge"; setIcon(cards[k].querySelector("h3"), o.icon); });
      },
      step: function (n, s) {
        if (n === 0) { r.q.classList.add("on"); }
        if (n === 1) { r.q.className = "card done"; r.l1.classList.add("on"); r.router.classList.add("on"); }
        if (n >= 2 && n <= 4) { r.c[n - 2].classList.add("on"); r.c[n - 2].setAttribute("data-route", s.checkRoutes[n - 2]); }
        if (n === 5) {
          let ch = chosen(s);
          outs.forEach(function (o, k) {
            let state = s.route[o.key];
            cards[k].className = "card kr-out " + state; cards[k].setAttribute("data-route", o.key === "local" ? "local" : "external");
            el("kT" + k).textContent = state === "on" ? "wybrana trasa" : state === "alt" ? "alternatywa" : state === "locked" ? "zablokowany · dane poufne" : "";
            if (state === "locked") { setIcon(cards[k].querySelector("h3"), "lock"); }
          });
          el("kP" + ch).innerHTML = s.preview; el("kP" + ch).classList.add("show");
        }
        if (n === 6) { let c = chosen(s); addRows(el("kRw" + c), s.rows, 250); setBadge(el("kB" + c), s, p); }
      }
    };
  }

  // Kmicic: wiadomość e-mail -> analiza w centrum -> trzy tory obsługi (jeden rośnie)
  function kmicicView(p) {
    let lanes = p.viz.lanes;
    refs.view.innerHTML = "<div class=\"kv kv-kmicic\">" +
      "<div class=\"km-col\"><small class=\"kv-k\">skrzynka odbiorcza</small><div class=\"card km-mail\" id=\"mM\">" +
      "<div class=\"km-hdr\"><div class=\"km-h\"><b>Od</b><span id=\"mFrom\"></span></div><div class=\"km-h\"><b>Do</b><span>kancelaria organizacji</span></div><div class=\"km-h\"><b>Temat</b><span id=\"mSubj\"></span></div></div>" +
      "<div class=\"km-body\" id=\"mS\"></div><div class=\"km-sign\" id=\"mSign\"></div><div class=\"km-att\" id=\"mAtt\"><i data-lucide=\"paperclip\" class=\"icon\"></i><span></span></div></div></div>" +
      "<div class=\"km-col km-center\"><small class=\"kv-k\">analiza wiadomości</small><div class=\"card km-analysis\" id=\"mAn\"><h3><i data-lucide=\"scan-search\" class=\"icon\"></i><span>Klasyfikacja</span></h3><div class=\"km-strip\" id=\"mStrip\"></div></div></div>" +
      "<div class=\"km-col\"><small class=\"kv-k\">tor obsługi</small><div class=\"km-lanes\">" + lanes.map(function (l, k) { return "<div class=\"card km-lane\" id=\"mL" + k + "\"><div class=\"km-lane-h\"><i data-lucide=\"" + l.icon + "\" class=\"icon\"></i>" + esc(l.title) + "</div><div class=\"sub\">" + esc(l.sub) + "</div><p class=\"prev\" id=\"mP" + k + "\"></p><div class=\"rows\" id=\"mR" + k + "\"></div><div class=\"km-stamp\" id=\"mSt" + k + "\"><i data-lucide=\"stamp\" class=\"icon\"></i><span></span></div></div>"; }).join("") + "</div></div>" +
      "</div>";
    let mail = el("mM"), from = el("mFrom"), subj = el("mSubj"), body = el("mS"), sign = el("mSign"), att = el("mAtt"), strip = el("mStrip"), an = el("mAn");
    function laneIx(s) { return lanes.map(function (l) { return l.key; }).indexOf(s.target); }
    return {
      reset: function (s) {
        mail.className = "card km-mail"; from.textContent = s.sender; subj.textContent = s.subject;
        body.innerHTML = (s.mailBody || [s.input]).map(function (para) { return "<p>" + esc(para) + "</p>"; }).join("");
        sign.innerHTML = (s.sign || []).map(function (line, k) { return "<span" + (k === 1 ? " class=\"km-name\"" : "") + ">" + esc(line) + "</span>"; }).join("");
        att.lastChild.textContent = s.attach; att.className = "km-att" + (s.attach ? "" : " hide");
        an.className = "card km-analysis";
        strip.innerHTML = s.chips.map(function (c) { return "<div class=\"km-chip\"><b>" + esc(c[0]) + "</b><span>" + esc(c[1]) + "</span></div>"; }).join("");
        lanes.forEach(function (_, k) { el("mL" + k).className = "card km-lane"; el("mP" + k).className = "prev"; el("mP" + k).innerHTML = ""; el("mR" + k).innerHTML = ""; el("mSt" + k).className = "km-stamp"; });
      },
      step: function (n, s) {
        let chips = strip.children;
        if (n === 0) { mail.classList.add("on"); }
        if (n === 1) { an.classList.add("on"); }
        if (n === 2) { chips[0].classList.add("show"); chips[1].classList.add("show"); }
        if (n === 3) { chips[2].classList.add("show"); chips[1].classList.add("hot"); }
        if (n === 4) { chips[3].classList.add("show"); chips[3].classList.add("hot"); }
        if (n === 5) {
          let t = laneIx(s);
          mail.className = "card km-mail done"; an.className = "card km-analysis done";
          lanes.forEach(function (_, k) { el("mL" + k).className = "card km-lane " + (k === t ? "on" : "off"); });
          el("mP" + t).innerHTML = s.preview; el("mP" + t).classList.add("show");
        }
        if (n === 6) {
          let t2 = laneIx(s), st2 = el("mSt" + t2);
          addRows(el("mR" + t2), s.rows, 250);
          st2.lastChild.textContent = s.badge; st2.className = "km-stamp show";
          if (s.approved) { at(3000, function () { st2.lastChild.textContent = s.approved; st2.className = "km-stamp show ok"; refs.phase.textContent = "pracownik zatwierdził odpowiedź po drobnej korekcie - wiadomość wysłana"; }); }
        }
      }
    };
  }

  // Dyndalski: formularz -> szyna kontroli -> arkusz dokumentu
  function dyndalskiView(p) {
    refs.view.innerHTML = "<div class=\"kv kv-dyndalski\">" +
      "<div><small class=\"kv-k\">formularz</small><div class=\"card dy-form\" id=\"yF\"><div id=\"yFields\"></div><div class=\"dy-suggest\" id=\"ySug\"></div></div></div>" +
      "<ul class=\"dy-rail\">" + p.nodes.process.icons.map(function (ic, k) { return "<li id=\"yR" + k + "\"><i data-lucide=\"" + ic + "\" class=\"icon\"></i></li>"; }).join("") + "</ul>" +
      "<div><small class=\"kv-k\">dokument</small><div class=\"dy-page\" id=\"yP\"><span class=\"dy-genre\" id=\"yG\"></span><div id=\"ySecs\"></div><div class=\"rows\" id=\"yRows\"></div><div class=\"badge\" id=\"yB\"><i data-lucide=\"quote\" class=\"icon\"></i><span></span></div></div></div>" +
      "</div>";
    let form = el("yF"), fields = el("yFields"), sug = el("ySug"), rail = [el("yR0"), el("yR1"), el("yR2")], page = el("yP"), genre = el("yG"), secs = el("ySecs"), rows = el("yRows"), badge = el("yB");
    function showAll(box, from, to, gap) { Array.prototype.forEach.call(box.children, function (c, k) { if (k >= from && k < to) { wait(function () { c.classList.add("show"); }, (k - from) * gap); } }); }
    // Wypełnianie formularza: pola pokazują się po kolei, wartości są "wpisywane" znak po znaku
    function typeFields(list) {
      let t = 0, CH = 22, GAP = 260;
      list.forEach(function (f, k) {
        let field = fields.children[k], val = field.lastChild, text = f[1];
        (wait(function () { field.classList.add("show", "typing"); }, t));
        t += 180;
        if (f[2] === "missing") { (wait(function () { field.classList.remove("typing"); }, t + 500)); t += 700; return; }
        for (let i = 1; i <= text.length; i += 1) {
          (function (i) { (wait(function () { val.textContent = text.slice(0, i); }, t + i * CH)); }(i));
        }
        t += text.length * CH + 120;
        (wait(function () { field.classList.remove("typing"); }, t));
        t += GAP;
      });
    }
    return {
      reset: function (s) {
        form.className = "card dy-form"; page.className = "dy-page"; genre.textContent = "wzorzec: " + s.fields[0][1];
        fields.innerHTML = s.fields.map(function (f, k) { return "<div class=\"dy-field" + (k === 0 ? " select" : "") + (f[2] ? " " + f[2] : "") + "\"><b>" + esc(f[0]) + "</b><span></span></div>"; }).join("");
        sug.className = "dy-suggest"; sug.textContent = s.suggest || "";
        rail.forEach(function (x) { x.classList.remove("on"); });
        secs.innerHTML = s.sections.map(function (sec) { return "<div class=\"dy-sec\"><b>" + esc(sec[0]) + "</b><span>" + sec[1] + "</span></div>"; }).join("");
        rows.innerHTML = ""; badge.className = "badge";
      },
      step: function (n, s) {
        let N = s.sections.length;
        if (n === 0) { form.classList.add("on"); typeFields(s.fields); }
        if (n === 1) { form.className = "card dy-form done"; page.classList.add("show"); showAll(secs, 0, 1, 0); }
        if (n === 2) {
          rail[0].classList.add("on");
          if (s.fill) { sug.classList.add("show"); let f = fields.children[s.fill[0]]; wait(function () { f.className = "dy-field show filled"; f.lastChild.textContent = s.fill[1]; }, 900); }
        }
        if (n === 3) { rail[1].classList.add("on"); showAll(secs, 1, N - 1, 350); if (s.fill) { secs.children[2].classList.add("hot"); } }
        if (n === 4) { rail[2].classList.add("on"); showAll(secs, N - 1, N, 0); }
        if (n === 5) { page.classList.add("on"); Array.prototype.forEach.call(secs.children, function (c) { c.classList.remove("hot"); }); }
        if (n === 6) { addRows(rows, s.rows, 250); setBadge(badge, s, p); }
      }
    };
  }

  // Papkin: ścieżka dźwięku -> transkrypcja z mówcami -> dokumenty
  function papkinView(p) {
    let BARS = 72;
    refs.view.innerHTML = "<div class=\"kv kv-papkin\">" +
      "<div class=\"pa-wave\"><small class=\"kv-k\" id=\"wK\"></small><div class=\"pa-bars\" id=\"wBars\"></div><div class=\"pa-legend\" id=\"wLeg\"></div></div>" +
      "<div class=\"pa-body\"><div class=\"pa-script\"><small class=\"kv-k\">transkrypcja</small><div id=\"wLines\"></div><div class=\"pa-task\" id=\"wTask\"></div></div>" +
      "<div class=\"pa-docs\"><small class=\"kv-k\">dokumentacja spotkania</small><div id=\"wDocs\"></div><div class=\"badge\" id=\"wB\"><i data-lucide=\"send\" class=\"icon\"></i><span></span></div></div></div>" +
      "</div>";
    let bars = el("wBars"), leg = el("wLeg"), lines = el("wLines"), task = el("wTask"), docs = el("wDocs"), badge = el("wB"), kick = el("wK");
    // Napisy na żywo: słowa pojawiają się kolejno, tłumaczenie wchodzi po skończonym zdaniu
    function captions(list) {
      let t = 0, WORD = 170, GAP = 380;
      list.forEach(function (l, k) {
        let line = lines.children[k], txt = line.querySelector(".pa-txt"), tr = line.querySelector(".tr"), words = l[1].split(" ");
        (wait(function () { line.classList.add("show", "typing"); }, t));
        words.forEach(function (_, i) {
          (wait(function () { txt.textContent = words.slice(0, i + 1).join(" "); }, t + (i + 1) * WORD));
        });
        t += words.length * WORD + 200;
        (wait(function () { line.classList.remove("typing"); if (tr) { tr.classList.add("show"); } }, t));
        t += GAP;
      });
    }
    let seed = 7; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    bars.innerHTML = Array.apply(null, Array(BARS)).map(function () { return "<i style=\"height:" + Math.round(18 + rnd() * 78) + "%\"></i>"; }).join("");
    function segOf(s, k) { let acc = 0, pct = k / BARS * 100; for (let j = 0; j < s.segments.length; j += 1) { acc += s.segments[j][1]; if (pct < acc) { return j; } } return s.segments.length - 1; }
    return {
      reset: function (s) {
        kick.textContent = s.live ? "dźwięk ze spotkania · na żywo" : "nagranie audio";
        bars.className = "pa-bars" + (s.live ? " live" : ""); Array.prototype.forEach.call(bars.children, function (b) { b.className = ""; });
        leg.innerHTML = s.segments.map(function (sg, k) { return "<span class=\"pa-spk s" + k + "\"><i></i>" + esc(sg[0]) + "</span>"; }).join("");
        lines.innerHTML = s.lines.map(function (l) { let k = s.segments.map(function (sg) { return sg[0]; }).indexOf(l[0]); return "<div class=\"pa-line s" + k + "\"><b>" + esc(l[0]) + "</b><span><span class=\"pa-txt\"></span>" + (l[2] ? "<span class=\"tr\">" + esc(l[2]) + "</span>" : "") + "</span></div>"; }).join("");
        task.className = "pa-task"; task.innerHTML = s.task;
        docs.innerHTML = s.rows.map(function (r) { return "<div class=\"pa-doc\"><i data-lucide=\"" + r[0] + "\" class=\"icon\"></i>" + esc(r[1]) + "</div>"; }).join("");
        badge.className = "badge";
      },
      step: function (n, s) {
        if (n === 0) { bars.classList.add("show"); }
        if (n === 1) { bars.classList.add("scan"); }
        if (n === 2) { bars.classList.remove("scan", "live"); Array.prototype.forEach.call(bars.children, function (b, k) { b.className = "s" + segOf(s, k); }); Array.prototype.forEach.call(leg.children, function (c, k) { wait(function () { c.classList.add("show"); }, k * 250); }); }
        if (n === 3) { captions(s.lines); }
        if (n === 4) { task.classList.add("show"); }
        if (n === 5) { Array.prototype.forEach.call(docs.children, function (c, k) { wait(function () { c.classList.add("show"); }, k * 300); }); }
        if (n === 6) { setBadge(badge, s, p); }
      }
    };
  }

  // Gerwazy: lista kontrolna budzi się wiersz po wierszu; dopasowanie pokazuje kolor obrysu (biały+róż podczas szukania, zielony/czerwony po ocenie)
  function gerwazyView(p) {
    refs.view.innerHTML = "<div class=\"kv kv-gerwazy\">" +
      "<div class=\"gw-col\"><small class=\"kv-k\" id=\"gReqK\">lista kontrolna</small><div class=\"gw-list\" id=\"gReqs\"></div></div>" +
      "<div class=\"gw-col\"><small class=\"kv-k\" id=\"gDocK\">dokumentacja organizacji</small><div class=\"gw-list gw-frags\" id=\"gDocs\"></div></div>" +
      "<div class=\"gw-side\"><small class=\"kv-k\">raport zgodności</small><div class=\"card gw-sum\" id=\"gSum\"><h3><i data-lucide=\"file-check\" class=\"icon\"></i><span>Ocena zgodności</span></h3>" +
      "<div class=\"gw-meter\" id=\"gMeter\"></div><div class=\"gw-met\" id=\"gMet\"></div><div class=\"gw-agents\" id=\"gAg\">" + p.nodes.process.icons.map(function (ic) { return "<span><i data-lucide=\"" + ic + "\" class=\"icon\"></i></span>"; }).join("") + "</div>" +
      "<div class=\"badge\" id=\"gB\"><i data-lucide=\"quote\" class=\"icon\"></i><span></span></div></div></div>" +
      "</div>";
    let reqs = el("gReqs"), docs = el("gDocs"), reqK = el("gReqK"), docK = el("gDocK"), sum = el("gSum"), meter = el("gMeter"), met = el("gMet"), ag = el("gAg"), badge = el("gB");
    return {
      reset: function (s) {
        reqK.textContent = s.req; docK.textContent = s.doc;
        reqs.innerHTML = s.pairs.map(function (pr) { return "<div class=\"card gw-item\"><b>" + esc(pr.req) + "</b><em>" + esc(pr.ref) + "</em><span class=\"gw-verdict\"></span></div>"; }).join("");
        docs.innerHTML = s.frags.map(function (f) { return "<div class=\"card gw-item gw-doc\"><q>" + esc(f[0]) + "</q><em>" + esc(f[1]) + "</em><span class=\"gw-ctx\">" + esc(f[2]) + "</span></div>"; }).join("");
        reqs.style.gridTemplateRows = "repeat(" + s.pairs.length + ", minmax(0, 1fr))";
        docs.style.gridTemplateRows = "repeat(" + s.frags.length + ", minmax(0, 1fr))";
        sum.className = "card gw-sum"; meter.innerHTML = s.pairs.map(function () { return "<i></i>"; }).join(""); met.textContent = "";
        Array.prototype.forEach.call(ag.children, function (a) { a.classList.remove("on"); });
        badge.className = "badge";
      },
      step: function (n, s) {
        let STEP = 700;   // 6 par × 700 + 720 ms mieści się przed krokiem 5 (5100 ms)
        if (n === 0) { Array.prototype.forEach.call(docs.children, function (d, k) { at(k * 120, function () { d.classList.add("show"); }); }); }
        if (n === 1) { Array.prototype.forEach.call(reqs.children, function (r, k) { at(k * 90, function () { r.classList.add("show"); }); }); }
        if (n === 2) {
          ag.children[0].classList.add("on");
          s.pairs.forEach(function (pr, k) {
            let row = reqs.children[k], v = row.querySelector(".gw-verdict"), doc = pr.frag >= 0 ? docs.children[pr.frag] : null;
            at(k * STEP, function () {
              row.classList.add("live");
              Array.prototype.forEach.call(docs.children, function (d) { if (!d.classList.contains("ok") && !d.classList.contains("gap")) { d.classList.add("scan"); } });
              if (k === 2) { ag.children[1].classList.add("on"); }
              if (k === 4) { ag.children[2].classList.add("on"); }
            });
            at(k * STEP + 300, function () { Array.prototype.forEach.call(docs.children, function (d) { d.classList.remove("scan"); }); if (doc) { doc.classList.add("live"); } });
            at(k * STEP + 720, function () {
              row.classList.remove("live"); row.classList.add(pr.state);
              if (doc) { doc.classList.remove("live"); doc.classList.add(pr.state); }
              v.textContent = pr.verdict; v.className = "gw-verdict show " + pr.state;
              meter.children[k].className = pr.state;
            });
          });
        }
        if (n === 5) { sum.classList.add("on"); met.textContent = s.met + " z " + s.total + " wymagań spełnionych"; }
        if (n === 6) { setBadge(badge, s, p); }
      }
    };
  }

  // Ocena modeli: tabela wyników, która przestawia się na żywo po każdym kryterium
  function ocenaView(p) {
    let M = p.viz.models, C = p.viz.criteria, ROW = 100 / M.length;
    refs.view.innerHTML = "<div class=\"kv kv-ocena\">" +
      "<div class=\"card oc-task\" id=\"oT\"><i data-lucide=\"" + p.nodes.input.icon + "\" class=\"icon\"></i><small>" + esc(p.nodes.input.title) + "</small><p class=\"oc-q\" id=\"oTT\"></p></div>" +
      "<div class=\"oc-samples\" id=\"oSam\"><small class=\"kv-k\" id=\"oSamK\"></small><div id=\"oSamL\"></div></div>" +
      "<div class=\"oc-board\"><div class=\"oc-head\"><small class=\"kv-k\">wyniki wg jednolitych kryteriów</small><div class=\"oc-crit\" id=\"oCrit\">" + C.map(function (c, k) { return "<div class=\"oc-c c" + k + "\"><i data-lucide=\"" + p.nodes.process.icons[k] + "\" class=\"icon\"></i><span>" + esc(c) + "</span></div>"; }).join("") + "</div></div><div class=\"oc-rows\" id=\"oRows\">" +
      M.map(function (m, k) { return "<div class=\"oc-row\" id=\"oR" + m[0] + "\" style=\"top:" + (k * ROW) + "%\"><span class=\"oc-rank\"></span><div class=\"oc-name\"><b>" + esc(m[1]) + "</b><em>" + esc(m[2]) + "</em></div><div class=\"oc-track\"><i class=\"c0\"></i><i class=\"c1\"></i><i class=\"c2\"></i></div><span class=\"oc-total\"></span></div>"; }).join("") +
      "</div><div class=\"badge\" id=\"oB\"><i data-lucide=\"award\" class=\"icon\"></i><span></span></div></div>" +
      "</div>";
    let task = el("oT"), tt = el("oTT"), crit = el("oCrit"), sam = el("oSam"), samK = el("oSamK"), samL = el("oSamL"), rows = M.map(function (m) { return el("oR" + m[0]); }), badge = el("oB"), rowsBox = el("oRows");
    function sums(s, upto) { return M.map(function (m) { return s.scores[m[0]].slice(0, upto).reduce(function (a, b) { return a + b; }, 0); }); }
    function reorder(s, upto) {
      let tot = sums(s, upto), order = M.map(function (_, k) { return k; }).sort(function (a, b) { return tot[b] - tot[a]; });
      order.forEach(function (mi, rank) { rows[mi].style.top = (rank * ROW) + "%"; rows[mi].querySelector(".oc-rank").textContent = "#" + (rank + 1); });
    }
    return {
      reset: function (s) {
        task.className = "card oc-task"; tt.textContent = s.input;
        sam.className = "oc-samples"; samK.textContent = s.samplesLabel;
        samL.innerHTML = s.samples.map(function (x, k) { return "<div class=\"card oc-s\"><b>test " + (k + 1) + "</b><span>" + esc(x[0]) + "</span><em>" + esc(x[1]) + "</em></div>"; }).join("");
        Array.prototype.forEach.call(crit.children, function (c) { c.classList.remove("on"); });
        rows.forEach(function (r, k) { r.className = "oc-row"; r.style.top = (k * ROW) + "%"; r.querySelector(".oc-rank").textContent = ""; r.querySelector(".oc-total").textContent = ""; Array.prototype.forEach.call(r.querySelectorAll(".oc-track i"), function (i) { i.style.width = "0"; }); });
        rowsBox.className = "oc-rows"; badge.className = "badge";
      },
      step: function (n, s) {
        if (n === 0) { task.classList.add("on"); }
        if (n === 1) { task.className = "card oc-task done"; rowsBox.classList.add("show"); sam.classList.add("show"); Array.prototype.forEach.call(samL.children, function (c, k) { wait(function () { c.classList.add("show"); }, k * 250); }); }
        if (n >= 2 && n <= 4) {
          let k = n - 2; crit.children[k].classList.add("on");
          M.forEach(function (m) { rows[M.indexOf(m)].querySelector(".oc-track .c" + k).style.width = (s.scores[m[0]][k] / 3) + "%"; });
          at(700, function () { reorder(s, k + 1); });
        }
        if (n === 5) {
          M.forEach(function (m, i) { let sc = s.scores[m[0]]; rows[i].querySelector(".oc-total").textContent = Math.round(sc.reduce(function (a, b) { return a + b; }, 0) / 3) + "/100"; });
          rows[M.map(function (m) { return m[0]; }).indexOf(s.best)].classList.add("best");
        }
        if (n === 6) { setBadge(badge, s, p); }
      }
    };
  }
  const VIEWS = { klara: klaraView, kmicic: kmicicView, dyndalski: dyndalskiView, papkin: papkinView, gerwazy: gerwazyView, ocena: ocenaView };

  // ─── Silnik pętli: produkty × scenariusze, auto / ręczny / pauza ───
  function setState(state) {
    st.setAttribute("data-state", state);
    refs.mode.textContent = state === "paused" ? "Pauza" : (manual ? "Tryb ręczny" : "Tryb automatyczny");
  }
  function progress(fromMs) {
    refs.progBar.setAttribute("aria-valuenow", String(Math.round(fromMs / total * 100)));
    refs.prog.style.transition = "none"; refs.prog.style.width = (fromMs / total * 100) + "%";
    void refs.prog.offsetWidth;
    refs.prog.style.transition = "width " + ((total - fromMs) / speed) + "ms linear"; refs.prog.style.width = "100%";
  }
  function freezeProgress() { let pct = Math.min(now(), total) / total * 100; refs.progBar.setAttribute("aria-valuenow", String(Math.round(pct))); refs.prog.style.transition = "none"; refs.prog.style.width = pct + "%"; }
  function schedule() {
    let s = scenario();
    T.forEach(function (t, n) {
      at(t, function () { view.step(n, s); refs.phase.textContent = stepText(n, s); st.setAttribute("data-phase", String(n + 1)); icons(refs.view); });
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
    setTimeout(function () { refs.name.textContent = p.name; refs.tag.innerHTML = p.tagline; refs.copy.classList.remove("swap"); }, 300);
    renderTabs(p);
    view = (VIEWS[p.id] || flowView)(p);
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
  }
  // Tryb automatyczny: jeden scenariusz z każdej symulacji, w kolejnym obiegu następny scenariusz
  function advanceAuto() {
    let k = (pi + 1) % PRODUCTS.length;
    if (k === 0) { pass += 1; }
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
    idleT = setTimeout(function () { stopIdle(); manual = false; st.setAttribute("data-mode", "loop"); advanceAuto(); }, IDLE_MS);
  }
  function select(i) { touch(); play(pi, i); }
  function selectProduct(k) { touch(); play(k, 0); }
  function act(name) {
    if (name === "settings") { togglePop(); return; }
    if (name === "full") { if (document.fullscreenElement) { document.exitFullscreen(); } else if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen(); } return; }
    touch();
    if (name === "prev") { advance(-1); }
    else if (name === "next") { advance(1); }
    else if (name === "replay") { play(pi, si); }
    else if (name === "play") {
      let state = st.getAttribute("data-state");
      if (state === "playing") { pause(); } else if (state === "paused") { resume(); } else { play(pi, si); }
    }
  }

  // ─── Robot (robot.js): włączany z ustawień, zapamiętany w localStorage ───
  const ROBOT_REMARKS = {
    zagloba:   ["Zagłoba zawsze pokazuje, skąd wziął odpowiedź.", "Pytanie, szukanie, odpowiedź ze źródłem. Trzy kroki."],
    dyndalski: ["Formularz wchodzi, dokument wychodzi. Bez kopiuj-wklej.", "Brakuje danych? Dyndalski dopyta, zanim napisze."],
    gerwazy:   ["Gerwazy sprawdza wymaganie po wymaganiu.", "Czerwone pole to luka w dokumentacji, nie w Gerwazym."],
    klara:     ["Klara wie, które dane nie mogą wyjść z firmy.", "Lokalnie, APIQ albo frontier. Router decyduje."],
    kmicic:    ["Kmicic proponuje, człowiek zatwierdza.", "Skrzynka pełna? Kmicic ją posortuje."],
    ocena:     ["Ten sam test dla każdego modelu. Fair play.", "Wynik to trzy kryteria, nie wrażenie."],
    papkin:    ["Papkin słucha, zapisuje, rozdziela zadania.", "Kto co obiecał na spotkaniu? Papkin pamięta."],
    default:   ["Cześć! Podejdź, pokażę ci demo."]
  };
  // Zaczepki do publiczności (czwarta ściana), wplecione między uwagi o produkcie
  const ROBOT_ASIDES = ["Hej, obejrzyj demo!", "Niezła konfa?", "Gdzie idziesz? Zostań chwilę.", "Śmiało, dotknij ekranu.", "Kawa była? To teraz demo.", "Widzę cię. Podejdź bliżej.", "Ja tu tylko pilnuję kart.", "Trzy scenariusze, wybierz jeden."];
  Object.keys(ROBOT_REMARKS).forEach(function (k, i) {
    if (k === "default") { return; }
    let own = ROBOT_REMARKS[k], mixed = [];
    own.forEach(function (line, j) { mixed.push(line); mixed.push(ROBOT_ASIDES[(i * 2 + j) % ROBOT_ASIDES.length]); });
    ROBOT_REMARKS[k] = mixed;
  });
  // Wspólna obsługa przełącznika postaci: localStorage, atrybut sceny, przycisk, płótno (pokazane przed pomiarem), dymek
  function companionToggle(key, btn, canvas, bubble, on) {
    try { localStorage.setItem("kiosk-" + key, on ? "1" : "0"); } catch (e) {}
    st.setAttribute("data-" + key + "-enabled", on ? "1" : "0");
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.lastChild.textContent = on ? "włączony" : "wyłączony";
    if (canvas) { canvas.hidden = !on; }
    if (bubble) { bubble.classList.toggle("off", !on); }
  }
  let robot = null, robotOn = false;
  function setRobot(on) {
    robotOn = !!on;
    let canvas = document.getElementById("robot"), bubble = document.getElementById("robotBubble");
    companionToggle("robot", refs.robotBtn, canvas, bubble, robotOn);
    if (robotOn && !robot && window.Robot && canvas) {
      let renderer = window.Robot.create({ canvas: canvas, smooth: true, unit: 9 });   // wersja wygładzona (pełna rozdzielczość, antyaliasing)
      robot = { renderer: renderer, director: window.Robot.kiosk({ renderer: renderer, stage: "#stage", view: "#kView", bubble: bubble, remarks: ROBOT_REMARKS, speed: function () { return speed; } }) };
    }
    if (robot) { robot.renderer.pose.visible = robotOn; if (robotOn) { robot.renderer.resize(); robot.director.restart(); } }
  }

  // ─── Kot (robot.js, model "cat"): raz na symulację przechodzi po górnych krawędziach kart (skacze nad przerwami, miauczy, czasem się przeciąga);
  //     rzadko, gdy robot stoi z przodu sceny, zamiast tego wchodzi na scenę i przez chwilę chodzi za robotem ───
  let cat = null, catOn = false;
  function makeCat(renderer, canvas, bubble) {
    let pose = renderer.pose, C = { active: false, mode: null, product: null, t: 0, path: [], seg: 0, meowAt: 0, meowed: false, startAt: 0, bubbleUntil: 0, followUntil: 0, leaving: false, idleT: 0, stretchUntil: 0, lastYaw: 0 };
    const FOLLOW_CHANCE = 0.22, FOLLOW_GAP = 1.3;   // szansa na tryb "za robotem" i odstęp od robota (w szerokościach kota)
    const LEFTWARD_CHANCE = 0.25;                     // szansa, że trasa po górze idzie z prawej do lewej
    let SEL = ".fl-node, .card, .dy-page, .pa-wave, .pa-script, .pa-docs, .km-mail, .km-analysis, .km-lane, .gw-item, .oc-row, .kr-out";
    let SPEED = 150, JUMP_SPEED = 260, W = renderer.bounds.w;
    function topRow() {
      let view = document.getElementById("kView"), list = [];
      view.querySelectorAll(SEL).forEach(function (e) { let r = e.getBoundingClientRect(); if (r.width > 60 && r.height > 60) { list.push(r); } });
      if (!list.length) { return []; }
      let minTop = Math.min.apply(null, list.map(function (r) { return r.top; }));
      let row = list.filter(function (r) { return r.top < minTop + 40; }).sort(function (a, b) { return a.left - b.left; });
      let merged = [];
      row.forEach(function (r) { let last = merged[merged.length - 1]; if (last && r.left < last.right + 10) { last.right = Math.max(last.right, r.right); } else { merged.push({ left: r.left, right: r.right, top: r.top }); } });
      return merged;
    }
    function plan() {
      let row = topRow();
      if (!row.length) { return false; }
      let dir = Math.random() < LEFTWARD_CHANCE ? -1 : 1, cards = dir > 0 ? row : row.slice().reverse();
      let y = row[0].top - 2, path = [];
      C.dir = dir;
      path.push({ x: dir > 0 ? -W : innerWidth + W, y: y, walk: true, speed: SPEED });
      cards.forEach(function (c, k) {
        path.push({ x: dir > 0 ? c.right - W * 0.25 : c.left + W * 0.25, y: c.top - 2, walk: true, speed: SPEED });
        if (k < cards.length - 1) { let n = cards[k + 1]; path.push({ x: dir > 0 ? n.left + W * 0.25 : n.right - W * 0.25, y: n.top - 2, walk: false, speed: JUMP_SPEED, jump: true }); }
      });
      path.push({ x: dir > 0 ? innerWidth + W : -W, y: y, walk: true, speed: SPEED });
      // czasem zatrzymuje się na jednej z kart: odwraca się do widza i miauczy albo przeciąga się (bokiem) i mruczy
      if (Math.random() < 0.7) {
        let c = row[Math.floor(Math.random() * row.length)];
        let px = c.left + (c.right - c.left) * (0.3 + Math.random() * 0.4);
        let ix = path.findIndex(function (pt) { return !pt.jump && (dir > 0 ? pt.x >= px : pt.x <= px); });
        let stretch = Math.random() < 0.45;
        if (ix > 0) { path.splice(ix, 0, { x: px, y: c.top - 2, walk: true, speed: SPEED }, { x: px, y: c.top - 2, stop: stretch ? 3 + Math.random() * 1.2 : 1.6 + Math.random() * 1.2, meow: !stretch, stretch: stretch }); }
      }
      C.path = path; C.seg = 0; C.stopT = 0;
      pose.x = path[0].x; pose.y = path[0].y; pose.lift = 0;
      C.meowAt = 0.25 + Math.random() * 0.5; C.meowed = path.some(function (pt) { return pt.meow; });   // miau w trakcie marszu tylko, gdy nie ma postoju
      return true;
    }
    function update(dt) {
      C.t += dt;
      let product = st.getAttribute("data-product");
      if (product !== C.product) { C.product = product; C.active = false; C.startAt = C.t + 2 + Math.random() * 5; }
      if (!C.active && C.startAt && C.t >= C.startAt) {
        C.startAt = 0;
        if (robotInFront() && Math.random() < FOLLOW_CHANCE) { startFollow(); }
        else if (plan()) { C.active = true; C.mode = "top"; }
      }
      let walking = false, stretching = false, yaw = 0;
      if (C.active && C.mode === "follow") {
        let r = followStep(dt); walking = r.walking; stretching = r.stretching; yaw = r.yaw;
      } else if (C.active && C.path[C.seg].stop) {
        let sp = C.path[C.seg];
        C.stopT += dt * speed;
        stretching = !!sp.stretch;
        yaw = stretching ? (C.dir || 1) * renderer.WALK_YAW - renderer.CAM_YAW : 0;   // przeciąganie bokiem, miauczenie twarzą do widza
        if (sp.meow && !sp.said && C.stopT > 0.5) { sp.said = true; bubble.textContent = "Miau."; bubble.classList.add("on"); C.bubbleUntil = C.t + 1.6; }
        if (sp.stretch && !sp.said && C.stopT > 1.4) { sp.said = true; bubble.textContent = "Mrrr."; bubble.classList.add("on"); C.bubbleUntil = C.t + 1.4; }
        if (C.stopT >= sp.stop) { C.stopT = 0; C.seg += 1; if (C.seg >= C.path.length) { C.active = false; } }
      } else if (C.active) {
        let seg = C.path[C.seg];
        let dx = seg.x - pose.x, dy = seg.y - pose.y, d = Math.hypot(dx, dy), step = seg.speed * dt * speed;
        if (seg.jump) {
          let prev = C.path[C.seg - 1], span = Math.hypot(seg.x - prev.x, seg.y - prev.y) || 1, done = 1 - d / span;
          pose.lift = Math.max(0, Math.sin(done * Math.PI) * 7);
        } else { pose.lift = 0; }
        if (d <= step) { pose.x = seg.x; pose.y = seg.y; C.seg += 1; if (C.seg >= C.path.length) { C.active = false; pose.lift = 0; } }
        else { pose.x += dx / d * step; pose.y += dy / d * step; }
        walking = !!seg.walk; yaw = (C.dir || 1) * renderer.WALK_YAW - renderer.CAM_YAW;
        let progress = C.seg / C.path.length;
        if (!C.meowed && progress >= C.meowAt) { C.meowed = true; bubble.textContent = Math.random() < 0.7 ? "Miau." : "Mrrr."; bubble.classList.add("on"); C.bubbleUntil = C.t + 1.6; }
      }
      renderer.animate(dt, { walking: walking, waving: false, stretching: stretching, airborne: pose.lift > 0, yawTarget: yaw });
      if (C.bubbleUntil && (C.t > C.bubbleUntil || !C.active)) { hideBubble(); }   // dymek nie przeżywa kota (zmiana sceny, resize, koniec trasy)
      let phase = !C.active ? "idle" : stretching ? "stretch" : C.mode === "follow" ? (walking ? "follow" : "wait") : (C.path[C.seg] && C.path[C.seg].stop ? "stop" : "walk");
      st.setAttribute("data-cat", phase + (C.active ? ":" + Math.round(pose.x) + "," + Math.round(pose.y) : ""));
    }
    // ── tryb "za robotem": kot wchodzi z brzegu na poziom robota, trzyma się o krok za nim, w przerwach czasem się przeciąga, po chwili schodzi ze sceny
    function robotInFront() {
      if (!robotOn || !robot) { return false; }
      let rp = robot.renderer.pose;
      return robot.director.state.layer === "front" && rp.x > W && rp.x < innerWidth - W;
    }
    function startFollow() {
      let rp = robot.renderer.pose;
      C.mode = "follow"; C.active = true; C.leaving = false; C.idleT = 0; C.stretchUntil = 0;
      C.followUntil = C.t + 9 + Math.random() * 6; C.meowed = false; C.meowAt = C.t + 1.5;
      pose.x = rp.x > innerWidth / 2 ? -W : innerWidth + W; pose.y = rp.y; pose.lift = 0;
    }
    function followStep(dt) {
      let rp = robot.renderer.pose, out = { walking: false, stretching: false, yaw: 0 };
      if (!C.leaving && (C.t > C.followUntil || !robotOn || robot.director.state.layer !== "front")) { C.leaving = true; C.exitX = pose.x < innerWidth / 2 ? -W : innerWidth + W; C.stretchUntil = 0; }
      let gap = W * FOLLOW_GAP, tx = C.leaving ? C.exitX : rp.x + (pose.x < rp.x ? -gap : gap), ty = C.leaving ? pose.y : rp.y;
      let dx = tx - pose.x, dy = ty - pose.y, d = Math.hypot(dx, dy), step = SPEED * dt * speed;
      if (C.stretchUntil) {
        out.stretching = C.t < C.stretchUntil; out.yaw = C.lastYaw;
        if (!out.stretching) { C.stretchUntil = 0; }
        return out;
      }
      if (d > 6) {
        pose.x += dx / d * Math.min(step, d); pose.y += dy / d * Math.min(step, d);
        out.walking = true; out.yaw = C.lastYaw = Math.sign(dx) * renderer.WALK_YAW - renderer.CAM_YAW; C.idleT = 0;
        if (!C.meowed && C.t > C.meowAt) { C.meowed = true; bubble.textContent = "Miau."; bubble.classList.add("on"); C.bubbleUntil = C.t + 1.6; }
      } else if (C.leaving) {
        C.active = false; C.mode = null;
      } else {
        C.idleT += dt * speed; out.yaw = 0;   // czeka obok robota twarzą do widza
        if (C.idleT > 1.2 && Math.random() < dt * speed * 0.35) { C.stretchUntil = C.t + 2.4 + Math.random(); }
      }
      return out;
    }
    function render() {
      renderer.clear();
      if (C.active) {
        renderer.draw(null);
        if (C.bubbleUntil) {
          let h = renderer.headTop();
          if (h[0] < W * 0.5 || h[0] > innerWidth - W * 0.5) { hideBubble(); }   // kot poza ekranem: dymek znika zamiast wisieć przy krawędzi
          else { bubble.style.left = Math.min(Math.max(h[0], 80), innerWidth - 80) + "px"; bubble.style.top = Math.max(h[1], 40) + "px"; }
        }
      }
    }
    function hideBubble() { bubble.classList.remove("on"); C.bubbleUntil = 0; }
    let last = performance.now();
    function frame(now) { let dt = Math.min(0.05, (now - last) / 1000); last = now; if (catOn) { update(dt); render(); } requestAnimationFrame(frame); }
    function again() { C.active = false; hideBubble(); C.startAt = C.t + 0.5; }
    addEventListener("resize", function () { renderer.resize(); again(); });   // po zmianie rozmiaru kot planuje trasę od nowa
    requestAnimationFrame(frame);
    return { state: C, again: again, renderer: renderer };
  }
  function setCat(on) {
    catOn = !!on;
    let canvas = document.getElementById("cat"), bubble = document.getElementById("catBubble");
    companionToggle("cat", refs.catBtn, canvas, bubble, catOn);
    if (catOn && !cat && window.Robot && canvas) {
      let renderer = window.Robot.create({ canvas: canvas, model: "cat", smooth: true, unit: 9 });
      cat = makeCat(renderer, canvas, bubble);
    }
    if (cat && catOn) { cat.renderer.resize(); cat.state.product = null; }   // płótno mogło zostać zmierzone jako 0×0, gdy było ukryte
    if (cat && !catOn) { cat.renderer.clear(); bubble.classList.remove("on"); cat.state.bubbleUntil = 0; }
  }

  // ─── Ustawienia: tempo (zapamiętane w localStorage) ───
  function setSpeed(v) {
    let prevSpeed = speed;
    speed = v;
    try { localStorage.setItem("kiosk-speed", String(v)); } catch (e) {}
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
  function initTheme() {
    let key = "kiosk-theme", theme = "dark";
    try { theme = localStorage.getItem(key) === "light" ? "light" : "dark"; } catch (e) {}
    function apply(t) {
      theme = t;
      st.classList.toggle("t-dark", t === "dark"); st.classList.toggle("t-light", t === "light");
      refs.logo.src = LOGO[t]; st.setAttribute("data-theme", t);
      try { localStorage.setItem(key, t); } catch (e) {}
    }
    refs.theme.addEventListener("click", function () { apply(theme === "dark" ? "light" : "dark"); });
    apply(theme);
  }

  // ─── Listeners ───
  function listen() {
    Array.prototype.forEach.call(st.querySelectorAll(".k-btn, .k-pop-replay"), function (b) { b.addEventListener("click", function () { act(b.getAttribute("data-act")); }); });
    Array.prototype.forEach.call(refs.speeds.children, function (b) { b.addEventListener("click", function () { touch(); setSpeed(parseFloat(b.getAttribute("data-speed"))); }); });
    refs.robotBtn.addEventListener("click", function () { touch(); setRobot(!robotOn); });
    refs.catBtn.addEventListener("click", function () { touch(); setCat(!catOn); });
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
    let wakeLock = (navigator.wakeLock && navigator.wakeLock.request) ? function () { navigator.wakeLock.request("screen").catch(function () {}); } : function () {};
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { if (st.getAttribute("data-state") === "playing") { pause(); hiddenPaused = true; } return; }
      wakeLock();   // przeglądarka zwalnia blokadę przy ukryciu karty
      if (hiddenPaused) { hiddenPaused = false; resume(); }
    });
    document.addEventListener("pointerdown", wakeLock, { once: true });
  }

  // ─── Init ───
  st = document.getElementById("stage");
  st.className = "stage t-dark";
  st.innerHTML = chrome();
  Array.prototype.forEach.call(document.querySelectorAll("#robot, #cat, .robot-wrap"), function (n) { st.appendChild(n); });   // warstwy postaci wewnątrz sceny: nagłówek, stopka i popover nad nimi
  icons(st);
  refs = { logo: el("kLogo"), rail: el("kRail"), theme: el("kTheme"), pop: el("kPop"), speeds: el("kSpeeds"), robotBtn: el("kRobot"), catBtn: el("kCat"), setBtn: st.querySelector("[data-act=settings]"), copy: el("kCopy"), name: el("kName"), tag: el("kTag"), phase: el("kPhase"), view: el("kView"), tabs: el("kTabs"), mode: el("kMode"), prog: el("kProg"), progBar: el("kProgBar"), idle: el("kIdle") };
  initTheme();
  listen();
  setSpeed(SPEEDS.indexOf(speed) >= 0 ? speed : 1);
  let robotPref = "0";
  try { robotPref = localStorage.getItem("kiosk-robot") || "0"; } catch (e) {}
  setRobot(robotPref === "1");
  let catPref = "0";
  try { catPref = localStorage.getItem("kiosk-cat") || "0"; } catch (e) {}
  setCat(catPref === "1");
  st.setAttribute("data-mode", "loop");
  let startP = parseInt(new URLSearchParams(location.search).get("p") || "0", 10);
  play(isNaN(startP) ? 0 : Math.max(0, Math.min(PRODUCTS.length - 1, startP)), 0);
  window.KIOSK = { play: play, select: select, selectProduct: selectProduct, act: act, setRobot: setRobot, setCat: setCat, catAgain: function () { if (cat) { cat.again(); } }, catState: function () { return cat ? cat.state : null; }, setSpeed: setSpeed, products: PRODUCTS };
})();
