/* KIOSK VIEWS - widoki produktowe: każdy produkt ma własny kształt sceny (Zagłoba korzysta z domyślnego diagramu).
   Widok: viewFor(p) -> { reset(s), step(n, s) }; reset ustawia scenę pod scenariusz, step(n) odsłania krok n (0-6) w rytmie zegara z kiosk-core.js.
   K (z kiosk-core.js): refs (view, phase), el, esc, wait, at, icons, setIcon, addRows, setBadge. Ładowane przez index.html przed kiosk-core.js. */
window.KIOSK_VIEWS = function (K) {
  "use strict";
  const refs = K.refs, el = K.el, esc = K.esc, wait = K.wait, at = K.at, icons = K.icons, setIcon = K.setIcon, addRows = K.addRows, setBadge = K.setBadge;

  // ─── Render: widok domyślny (diagram pytanie → proces → wynik; Zagłoba) ───
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

  // ─── Widoki produktowe: każdy produkt ma własny kształt sceny ───
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
  return function (p) { return (VIEWS[p.id] || flowView)(p); };
};
