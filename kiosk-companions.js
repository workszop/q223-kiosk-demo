/* KIOSK COMPANIONS - postaci na scenie (robot.js): robot (reżyser z robot.js), kot (trasa po górnych krawędziach kart albo za robotem)
   i bohaterowie (easter eggi: spider, iron, hulk). Włączane z ustawień, zapamiętane w localStorage, wszystkie na wspólnym tickerze kiosku.
   Płótna i dymki leżą w .k-frame, więc liczą w układzie kadru (0,0 = lewy górny róg kadru); K.frameOrigin() przelicza prostokąty kart z układu okna.
   K (z kiosk-core.js): st, refs (robotBtn, catBtn, heroBtn, view), px, scale, frameRect, frameOrigin, ticker, speed (funkcja: tempo).
   Zwraca: setRobot, setCat, setHero, heroTick (z play(): co drugi scenariusz planuje bohatera), robotOn/catOn/heroOn, hero(), cat(). */
window.KIOSK_COMPANIONS = function (K) {
  "use strict";
  const st = K.st, refs = K.refs, px = K.px, scale = K.scale, frameRect = K.frameRect, frameOrigin = K.frameOrigin, ticker = K.ticker, tempo = K.speed;

  // Dymek nad głową postaci (układ kadru): wyśrodkowany nad punktem head, cały w kadrze, nie wyżej niż px(40) od góry
  function placeBubble(bubble, head, dy) {
    let fr = frameRect(), half = bubble.offsetWidth / 2 + px(12);
    bubble.style.left = Math.min(Math.max(head[0], half), fr.width - half) + "px";
    bubble.style.top = Math.max(head[1] + dy, px(40)) + "px";
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
      let renderer = window.Robot.create({ canvas: canvas, smooth: true, unit: function () { return px(9); } });   // wersja wygładzona; rozmiar woksela skaluje się z kadrem
      robot = { renderer: renderer, director: window.Robot.kiosk({ renderer: renderer, stage: "#stage", view: "#kView", bubble: bubble, remarks: ROBOT_REMARKS, speed: tempo, walkSpeed: function () { return px(170); }, bounds: frameRect, origin: frameOrigin, scale: scale, ticker: ticker }) };
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
    let SPEED = 150, JUMP_SPEED = 260;   // prędkości w px/s przy skali 1
    const bounds = renderer.bounds;      // rozmiar kota w px, odświeżany przez renderer.resize(); bounds.w = szerokość
    function topRow() {   // górne krawędzie kart w układzie kadru; progi rozmiaru skalują się z kadrem jak same karty
      let view = document.getElementById("kView"), o = frameOrigin(), list = [], min = px(60);
      view.querySelectorAll(SEL).forEach(function (e) { let r = e.getBoundingClientRect(); if (r.width > min && r.height > min) { list.push({ left: r.left - o.left, right: r.right - o.left, top: r.top - o.top }); } });
      if (!list.length) { return []; }
      let minTop = Math.min.apply(null, list.map(function (r) { return r.top; })), rowGap = px(40), mergeGap = px(10);
      let row = list.filter(function (r) { return r.top < minTop + rowGap; }).sort(function (a, b) { return a.left - b.left; });
      let merged = [];
      row.forEach(function (r) { let last = merged[merged.length - 1]; if (last && r.left < last.right + mergeGap) { last.right = Math.max(last.right, r.right); } else { merged.push({ left: r.left, right: r.right, top: r.top }); } });
      return merged;
    }
    function plan() {
      let row = topRow(), fr = frameRect(), W = bounds.w;
      if (!row.length) { return false; }
      let dir = Math.random() < LEFTWARD_CHANCE ? -1 : 1, cards = dir > 0 ? row : row.slice().reverse();
      let y = row[0].top - 2, path = [];
      C.dir = dir;
      path.push({ x: dir > 0 ? fr.left - W : fr.right + W, y: y, walk: true, speed: SPEED });
      cards.forEach(function (c, k) {
        path.push({ x: dir > 0 ? c.right - W * 0.25 : c.left + W * 0.25, y: c.top - 2, walk: true, speed: SPEED });
        if (k < cards.length - 1) { let n = cards[k + 1]; path.push({ x: dir > 0 ? n.left + W * 0.25 : n.right - W * 0.25, y: n.top - 2, walk: false, speed: JUMP_SPEED, jump: true }); }
      });
      path.push({ x: dir > 0 ? fr.right + W : fr.left - W, y: y, walk: true, speed: SPEED });
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
        C.stopT += dt * tempo();
        stretching = !!sp.stretch;
        yaw = stretching ? (C.dir || 1) * renderer.WALK_YAW - renderer.CAM_YAW : 0;   // przeciąganie bokiem, miauczenie twarzą do widza
        if (sp.meow && !sp.said && C.stopT > 0.5) { sp.said = true; bubble.textContent = "Miau."; bubble.classList.add("on"); C.bubbleUntil = C.t + 1.6; }
        if (sp.stretch && !sp.said && C.stopT > 1.4) { sp.said = true; bubble.textContent = "Mrrr."; bubble.classList.add("on"); C.bubbleUntil = C.t + 1.4; }
        if (C.stopT >= sp.stop) { C.stopT = 0; C.seg += 1; if (C.seg >= C.path.length) { C.active = false; } }
      } else if (C.active) {
        let seg = C.path[C.seg];
        let dx = seg.x - pose.x, dy = seg.y - pose.y, d = Math.hypot(dx, dy), step = px(seg.speed) * dt * tempo();
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
      let rp = robot.renderer.pose, fr = frameRect(), W = bounds.w;
      return robot.director.state.layer === "front" && rp.x > fr.left + W && rp.x < fr.right - W;
    }
    function startFollow() {
      let rp = robot.renderer.pose, fr = frameRect(), W = bounds.w;
      C.mode = "follow"; C.active = true; C.leaving = false; C.idleT = 0; C.stretchUntil = 0;
      C.followUntil = C.t + 9 + Math.random() * 6; C.meowed = false; C.meowAt = C.t + 1.5;
      pose.x = rp.x > fr.left + fr.width / 2 ? fr.left - W : fr.right + W; pose.y = rp.y; pose.lift = 0;
    }
    function followStep(dt) {
      let rp = robot.renderer.pose, out = { walking: false, stretching: false, yaw: 0 }, fr = frameRect(), W = bounds.w;
      if (!C.leaving && (C.t > C.followUntil || !robotOn || robot.director.state.layer !== "front")) { C.leaving = true; C.exitX = pose.x < fr.left + fr.width / 2 ? fr.left - W : fr.right + W; C.stretchUntil = 0; }
      let gap = W * FOLLOW_GAP, tx = C.leaving ? C.exitX : rp.x + (pose.x < rp.x ? -gap : gap), ty = C.leaving ? pose.y : rp.y;
      let dx = tx - pose.x, dy = ty - pose.y, d = Math.hypot(dx, dy), step = px(SPEED) * dt * tempo();
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
        C.idleT += dt * tempo(); out.yaw = 0;   // czeka obok robota twarzą do widza
        if (C.idleT > 1.2 && Math.random() < dt * tempo() * 0.35) { C.stretchUntil = C.t + 2.4 + Math.random(); }
      }
      return out;
    }
    function render() {
      if (!C.active) { if (C.drawn) { renderer.clear(); C.drawn = false; } return; }   // bezczynny kot nie czyści płótna co klatkę
      renderer.clear(); renderer.draw(null); C.drawn = true;
      if (C.bubbleUntil) {
        let h = renderer.headTop(), fr = frameRect(), W = bounds.w;
        if (h[0] < fr.left + W * 0.5 || h[0] > fr.right - W * 0.5) { hideBubble(); }   // kot poza kadrem: dymek znika zamiast wisieć przy krawędzi
        else { placeBubble(bubble, h, 0); }
      }
    }
    function hideBubble() { bubble.classList.remove("on"); C.bubbleUntil = 0; }
    function again() { C.active = false; hideBubble(); C.startAt = C.t + 0.5; }
    addEventListener("resize", function () { renderer.resize(); again(); });   // po zmianie rozmiaru kot planuje trasę od nowa
    ticker.add(function (dt) { if (catOn) { update(dt); render(); } });
    return { state: C, again: again, renderer: renderer };
  }
  function setCat(on) {
    catOn = !!on;
    let canvas = document.getElementById("cat"), bubble = document.getElementById("catBubble");
    companionToggle("cat", refs.catBtn, canvas, bubble, catOn);
    if (catOn && !cat && window.Robot && canvas) {
      let renderer = window.Robot.create({ canvas: canvas, model: "cat", smooth: true, unit: function () { return px(9); } });
      cat = makeCat(renderer, canvas, bubble);
    }
    if (cat && catOn) { cat.renderer.resize(); cat.state.product = null; }   // płótno mogło zostać zmierzone jako 0×0, gdy było ukryte
    if (cat && !catOn) { cat.renderer.clear(); bubble.classList.remove("on"); cat.state.bubbleUntil = 0; }
  }

  // ─── Bohaterowie (easter eggi, robot.js modele spider/iron/hulk): co drugi scenariusz jeden z trzech przelatuje przez ekran ───
  //     spider: zjeżdża na nici z góry, huśta się po łuku przez ekran i odlatuje; iron: wzlatuje po skosie od dołu, twarzą do widza;
  //     hulk: spada z góry na dół sceny (wstrząs, kurz), ryczy z rękami w górze, wali pięścią w ziemię (drugi wstrząs, pęknięcia), wyskakuje w górę
  const HERO_KINDS = ["spider", "iron", "hulk"], HERO_EVERY = 2;
  let hero = null, heroOn = false, heroPlays = 0, heroIx = Math.floor(Math.random() * HERO_KINDS.length);
  function makeHero(canvas, bubble) {
    let R = {}, H = { active: false, kind: null, phase: "idle", t: 0, launchAt: 0, pending: null, dust: [], cracks: [], bubbleUntil: 0 };
    let ctx = null;
    function renderer(kind) {
      if (!R[kind]) { R[kind] = window.Robot.create({ canvas: canvas, model: kind, smooth: true, unit: kind === "hulk" ? function () { return px(12); } : function () { return px(9); } }); R[kind].pose.shadow = false; }
      ctx = R[kind].ctx;
      return R[kind];
    }
    let colors = {};
    function color(name) { let k = st.getAttribute("data-theme") + name; return colors[k] || (colors[k] = getComputedStyle(document.documentElement).getPropertyValue(name).trim()); }
    function launch(kind) {
      let r = renderer(kind), p = r.pose, fr = frameRect(), W = fr.width, Hh = fr.height, L = fr.left, T = fr.top, s = scale();
      r.resize();   // płótno mogło być ukryte (0×0) przy tworzeniu renderera lub zmianie rozmiaru
      H.kind = kind; H.active = true; H.t = 0; H.dust = []; H.cracks = []; H.phase = "in"; H.pose = p; hideBubble();
      p.lift = 0; p.pitch = 0; p.yaw = 0; p.poseA = 0; p.airborne = false; p.visible = true;
      if (kind === "spider") {
        H.dir = Math.random() < 0.5 ? 1 : -1;
        H.x0 = L + (H.dir > 0 ? W * 0.12 : W * 0.88); H.y0 = T + Hh * 0.42;
        H.anchor = [L + (H.dir > 0 ? W * 0.55 : W * 0.45), T - 12 * s];
        p.x = H.x0; p.y = T - r.height * r.unit - 20 * s;
      } else if (kind === "iron") {                                              // from a bottom corner up to the opposite top corner
        H.dir = Math.random() < 0.5 ? 1 : -1;
        p.x = L + (H.dir > 0 ? W * 0.12 : W * 0.88); p.y = T + Hh + 160 * s;
        H.vx = H.dir * (W * 0.7) / 2.4; H.vy = -(Hh + 420 * s) / 2.4;
      } else {
        p.x = L + W * (0.2 + Math.random() * 0.6); p.y = T - r.height * r.unit - 40 * s;
        H.vy = 0; H.ground = T + Hh - 18 * s;
      }
    }
    function update(dt) {
      if (!H.active) {
        if (H.launchAt && (H.t += dt) >= H.launchAt) { H.launchAt = 0; launch(H.pending); }
        return;
      }
      let r = R[H.kind], p = r.pose, fr = frameRect(), W = fr.width, Hh = fr.height, L = fr.left, T = fr.top, s = scale(), k = H.kind;
      H.t += dt * tempo(); let ds = dt * tempo();
      let input = { walking: false, waving: false, airborne: false, yawTarget: 0, pose: null };
      if (k === "spider") {
        let ax = H.anchor[0], ay = H.anchor[1], hx = r.headTop();
        input.pose = "hang";
        if (H.phase === "in") {                                                       // drop on the thread to mid height
          p.y = Math.min(H.y0, p.y + 520 * s * ds); input.yawTarget = 0;
          if (p.y >= H.y0) { H.phase = "dangle"; H.pt = 0; }
        } else if (H.phase === "dangle") {                                            // a moment facing the viewer
          H.pt += ds; input.yawTarget = 0; p.x = H.x0 + Math.sin(H.t * 3) * 6 * s;
          if (H.pt > 0.9) { H.phase = "swing"; H.pt = 0; H.L = Math.hypot(p.x - ax, p.y - ay); H.th0 = Math.atan2(p.x - ax, p.y - ay); }
        } else if (H.phase === "swing") {                                             // pendulum arc across the screen, then release
          H.pt += ds; let SWING = 1.7, th = H.th0 * Math.cos(Math.PI * Math.min(1, H.pt / SWING));   // SWING: czas huśtnięcia (s)
          p.x = ax + Math.sin(th) * H.L; p.y = ay + Math.cos(th) * H.L;
          input.yawTarget = H.dir * r.WALK_YAW - r.CAM_YAW; p.pitch = -th * 0.6 * H.dir;   // pochylony wzdłuż nici
          if (H.pt >= SWING) { H.phase = "out"; H.vx = H.dir * 900 * s; H.vy = -700 * s; }
        } else {                                                                      // ballistic exit
          input.pose = "fly"; H.vy += 1500 * s * ds; p.x += H.vx * ds; p.y += H.vy * ds;
          input.yawTarget = H.dir * r.WALK_YAW - r.CAM_YAW; p.pitch = 1.0;
          if (p.x < L - 200 * s || p.x > L + W + 200 * s || p.y > T + Hh + 200 * s) { H.active = false; }
        }
      } else if (k === "iron") {
        input.pose = "fly"; input.yawTarget = 0; p.pitch = -0.3;                 // facing the viewer, leaning back a little as he climbs
        p.x += H.vx * ds; p.y += H.vy * ds;
        if (p.y < T - r.height * r.unit - 80 * s) { H.active = false; }
      } else {                                                                        // hulk
        if (H.phase === "in") {
          input.airborne = true; H.vy += 2600 * s * ds; p.y += H.vy * ds; input.yawTarget = 0;
          if (p.y >= H.ground) {
            p.y = H.ground; H.phase = "land"; H.pt = 0; shake(0.55);
            for (let i = 0; i < 14; i++) { H.dust.push({ x: p.x + (Math.random() - 0.5) * 60 * s, y: p.y, vx: (Math.random() - 0.5) * 260 * s, vy: -Math.random() * 160 * s, r: (8 + Math.random() * 14) * s, a: 1 }); }
          }
        } else if (H.phase === "land") {                                          // crouched after the impact
          input.pose = "land"; input.yawTarget = 0; H.pt += ds; ease(p, 0, 0, ds);
          if (H.pt > 0.4) { H.phase = "roar"; H.pt = 0; say("RAAARGH!", 1.2); }
        } else if (H.phase === "roar") {                                          // arms up, leaning back
          input.pose = "roar"; input.yawTarget = 0; H.pt += ds; ease(p, -0.25, 0, ds);
          if (H.pt > 1.1) { H.phase = "punch"; H.pt = 0; H.hit = false; }
        } else if (H.phase === "punch") {                                         // drops into a crouch and slams the right fist into the ground
          input.pose = "punch"; input.yawTarget = 0; H.pt += ds; ease(p, 0.5, -5, ds);
          if (!H.hit && H.pt > 0.22) {
            H.hit = true; shake(0.45);
            let f = r.project(4, 6.7, 3.5);   // the right fist (arm swung forward-down) in screen px
            for (let i = 0; i < 12; i++) { H.dust.push({ x: f[0] + (Math.random() - 0.5) * 30 * s, y: f[1], vx: (Math.random() - 0.5) * 300 * s, vy: -Math.random() * 200 * s, r: (6 + Math.random() * 12) * s, a: 1 }); }
            for (let i = 0; i < 7; i++) {
              let ang = Math.PI * (0.05 + Math.random() * 0.9) * (Math.random() < 0.5 ? 1 : -1), len = (50 + Math.random() * 90) * s, pts = [[f[0], f[1]]], x = f[0], y = f[1];
              for (let j = 1; j <= 3; j++) { x += Math.cos(ang) * len / 3; y += Math.sin(ang) * len / 3 * 0.35; ang += (Math.random() - 0.5) * 0.9; pts.push([x, y]); }
              H.cracks.push({ pts: pts, a: 1 });
            }
          }
          if (H.pt > 0.9) { H.phase = "stand"; H.pt = 0; }
        } else if (H.phase === "stand") {                                         // back up, then leap out
          input.pose = "land"; input.yawTarget = 0; H.pt += ds; ease(p, 0, 0, ds);
          if (H.pt > 0.6) { H.phase = "out"; H.vy = -2600 * s; H.vx = (Math.random() - 0.5) * 300 * s; }
        } else {
          input.airborne = true; H.vy += 1400 * s * ds; p.y += H.vy * ds; p.x += H.vx * ds; input.yawTarget = 0; ease(p, 0, 0, ds);
          if (p.y < T - r.height * r.unit - 60 * s || p.y > T + Hh + 300 * s) { H.active = false; }
        }
        H.cracks.forEach(function (c) { c.a -= ds * 0.6; }); H.cracks = H.cracks.filter(function (c) { return c.a > 0; });
        H.dust.forEach(function (d) { d.x += d.vx * ds; d.y += d.vy * ds; d.vy += 120 * s * ds; d.r += 30 * s * ds; d.a -= ds * 1.3; });
        H.dust = H.dust.filter(function (d) { return d.a > 0; });
      }
      r.animate(dt, input);
      if (H.bubbleUntil && (H.t > H.bubbleUntil || !H.active)) { hideBubble(); }
      H.phase = H.active ? H.phase : "idle";
      st.setAttribute("data-hero", H.active ? k + ":" + H.phase + ":" + Math.round(p.x) + "," + Math.round(p.y) : "idle");
    }
    function ease(p, pitch, lift, ds) { let k = Math.min(1, 14 * ds); p.pitch += (pitch - p.pitch) * k; p.lift += (lift - p.lift) * k; }
    function say(text, sec) { bubble.textContent = text; bubble.classList.add("on"); H.bubbleUntil = H.t + sec; }
    function hideBubble() { bubble.classList.remove("on"); H.bubbleUntil = 0; }
    function shake(sec) {
      let t0 = performance.now(), amp = px(9);
      (function step(now) {
        let f = 1 - (now - t0) / (sec * 1000);
        if (f <= 0) { refs.view.style.transform = ""; return; }
        refs.view.style.transform = "translate(" + ((Math.random() - 0.5) * amp * f * 2).toFixed(1) + "px," + ((Math.random() - 0.5) * amp * f * 2).toFixed(1) + "px)";
        requestAnimationFrame(step);
      })(t0);
    }
    function render() {
      let r = R[H.kind];
      if (!H.active || !r) { if (H.drawn && r) { r.clear(); H.drawn = false; } return; }   // bezczynne płótno czyszczone raz, nie co klatkę
      r.clear(); H.drawn = true;
      let p = r.pose;
      if (H.kind === "spider" && H.phase !== "out") {                                 // the thread, from the anchor to the hands above the head
        let h = r.headTop();
        ctx.save(); ctx.strokeStyle = color("--hero-thread"); ctx.lineWidth = px(1.5); ctx.beginPath();
        ctx.moveTo(H.phase === "swing" ? H.anchor[0] : p.x, H.phase === "swing" ? H.anchor[1] : frameRect().top - 12); ctx.lineTo(h[0], h[1] - px(8)); ctx.stroke(); ctx.restore();
      }
      if (H.kind === "hulk" && H.cracks.length) {                                 // cracks radiating from the fist
        ctx.save(); ctx.strokeStyle = color("--hero-crack"); ctx.lineCap = "round";
        H.cracks.forEach(function (c) { ctx.globalAlpha = Math.max(0, c.a); ctx.lineWidth = px(2.5); ctx.beginPath(); c.pts.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); });
        ctx.restore();
      }
      if (H.kind === "hulk" && H.dust.length) {
        ctx.save(); ctx.fillStyle = color("--hero-dust");
        H.dust.forEach(function (d) { ctx.globalAlpha = Math.max(0, d.a) * 0.7; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); });
        ctx.restore();
      }
      r.draw(null);
      if (H.bubbleUntil) { placeBubble(bubble, r.headTop(), -px(10)); }
    }
    addEventListener("resize", function () { Object.keys(R).forEach(function (k) { R[k].resize(); }); H.active = false; hideBubble(); });   // przerwany przelot nie zostawia dymka
    ticker.add(function (dt) { if (heroOn) { update(dt); render(); } });
    return { state: H, launch: launch, schedule: function (kind, delay) { H.pending = kind; H.launchAt = delay; H.t = 0; } };
  }
  function setHero(on) {
    heroOn = !!on;
    let canvas = document.getElementById("hero"), bubble = document.getElementById("heroBubble");
    companionToggle("hero", refs.heroBtn, canvas, bubble, heroOn);
    if (heroOn && !hero && window.Robot && canvas) { hero = makeHero(canvas, bubble); }
    if (hero && !heroOn) { hero.state.active = false; hero.state.launchAt = 0; hero.state.bubbleUntil = 0; bubble.classList.remove("on"); refs.view.style.transform = ""; }
  }
  // wywoływane z play(): co drugi scenariusz planuje jednego bohatera (po kolei), kilka sekund po starcie
  function heroTick() {
    heroPlays += 1;
    if (!heroOn || !hero) { return; }
    hero.state.launchAt = 0;   // bohater w trakcie przelotu kończy go, tylko zaplanowany start przepada
    if (heroPlays % HERO_EVERY !== 0) { return; }
    let kind = HERO_KINDS[heroIx++ % HERO_KINDS.length];
    hero.schedule(kind, 3 + Math.random() * 6);
  }

  return { setRobot: setRobot, setCat: setCat, setHero: setHero, heroTick: heroTick, robotOn: function () { return robotOn; }, catOn: function () { return catOn; }, heroOn: function () { return heroOn; }, hero: function () { return hero; }, cat: function () { return cat; } };
};
