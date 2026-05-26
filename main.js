/* ====================================================================
   [JB] Security — main.js
   3D background, tilt cards, glitch text, i18n, form
   ==================================================================== */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     1. THREE.JS BACKGROUND — Neural network reveal + signal pulses
     ------------------------------------------------------------------ */
  function initBackground() {
    if (prefersReducedMotion || !window.THREE) return;
    const canvas = document.getElementById('bgfx');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050507, 0.05);

    const camera = new THREE.PerspectiveCamera(
      52, window.innerWidth / window.innerHeight, 0.1, 100
    );
    camera.position.set(0, 0, 14);

    const net = new THREE.Group();
    scene.add(net);

    /* ---- Generate nodes on a Fibonacci sphere (even distribution) ---- */
    const NODE_COUNT = 120;
    const RADIUS = 5.2;
    const nodes = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2;
      const ringR = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      const r = RADIUS * (0.88 + Math.random() * 0.24);
      const target = new THREE.Vector3(
        r * ringR * Math.cos(theta),
        r * y,
        r * ringR * Math.sin(theta)
      );
      // Origin: tight scatter near the center, so reveal feels like an outward burst
      const origin = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      );
      // Per-node arrival delay for an organic, staggered burst
      const delay = Math.random() * 0.35;
      nodes.push({ target, origin, pos: origin.clone(), delay });
    }

    /* ---- Node points ---- */
    const nodePos = new Float32Array(NODE_COUNT * 3);
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
    const nodeMat = new THREE.PointsMaterial({
      color: 0x00ff9d, size: 0.12, transparent: true, opacity: 0,
      sizeAttenuation: true,
    });
    const nodePoints = new THREE.Points(nodeGeo, nodeMat);
    net.add(nodePoints);

    /* ---- Precompute edges between nearby nodes (final positions) ---- */
    const EDGE_DIST = RADIUS * 0.55;
    let edges = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const d = nodes[i].target.distanceTo(nodes[j].target);
        if (d < EDGE_DIST) edges.push({ a: i, b: j, dist: d });
      }
    }
    // Cap to keep render budget tight — keep the shortest edges (the meshy ones)
    edges.sort((x, y) => x.dist - y.dist);
    edges = edges.slice(0, 280);

    const edgePos = new Float32Array(edges.length * 6);
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x00ff9d, transparent: true, opacity: 0,
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    net.add(edgeLines);

    /* ---- Signal pulses — particles traveling along random edges ---- */
    const MAX_PULSES = 9;
    const pulses = [];
    const pulseContainer = new THREE.Group();
    net.add(pulseContainer);

    function spawnPulse() {
      if (pulses.length >= MAX_PULSES || edges.length === 0) return;
      const e = edges[Math.floor(Math.random() * edges.length)];
      const critical = Math.random() < 0.12; // rare red alert
      const color = critical ? 0xff3b6b : 0x00d4ff;
      const pgeo = new THREE.BufferGeometry();
      pgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
      const pmat = new THREE.PointsMaterial({
        color, size: critical ? 0.22 : 0.16,
        transparent: true, opacity: 0, sizeAttenuation: true,
      });
      const pts = new THREE.Points(pgeo, pmat);
      pulseContainer.add(pts);
      pulses.push({
        edge: e, geom: pgeo, mat: pmat, points: pts,
        t: 0, life: 1.1 + Math.random() * 0.9, critical,
      });
    }

    function updatePulses(dt) {
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += dt;
        const k = p.t / p.life; // 0..1
        const a = nodes[p.edge.a].pos;
        const b = nodes[p.edge.b].pos;
        const arr = p.geom.attributes.position.array;
        arr[0] = a.x + (b.x - a.x) * k;
        arr[1] = a.y + (b.y - a.y) * k;
        arr[2] = a.z + (b.z - a.z) * k;
        p.geom.attributes.position.needsUpdate = true;
        // Smooth fade in/out
        let alpha;
        if (k < 0.18) alpha = k / 0.18;
        else if (k < 0.8) alpha = 1;
        else if (k < 1) alpha = (1 - k) / 0.2;
        else alpha = 0;
        p.mat.opacity = alpha * (p.critical ? 0.95 : 0.85);
        if (k >= 1) {
          pulseContainer.remove(p.points);
          p.geom.dispose(); p.mat.dispose();
          pulses.splice(i, 1);
        }
      }
    }

    /* ---- Mouse parallax ---- */
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('mousemove', (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 0.55;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 0.55;
    }, { passive: true });

    /* ---- Resize ---- */
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
    window.addEventListener('resize', onResize, { passive: true });

    /* ---- Intro reveal parameters ---- */
    const INTRO_DURATION = 1.8; // seconds for full burst
    const EDGE_FADE_START = 0.45; // intro progress at which edges begin appearing

    /* ---- Animate ---- */
    let last = performance.now();
    let elapsed = 0;
    let spawnTimer = 0;
    let running = true;
    document.addEventListener('visibilitychange', () => {
      running = document.visibilityState === 'visible';
      if (running) { last = performance.now(); requestAnimationFrame(loop); }
    });

    function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
    function easeOutBack(t) {
      // gentle overshoot on the burst
      const c = 1.4;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    }

    function loop(now) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      const introT = Math.min(elapsed / INTRO_DURATION, 1);
      const introDone = introT >= 1;

      // Update each node position with its own delayed eased ramp
      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodes[i];
        const localT = Math.max(0, Math.min(
          (elapsed - n.delay) / (INTRO_DURATION - 0.35), 1
        ));
        const eased = easeOutBack(localT);
        n.pos.x = n.origin.x + (n.target.x - n.origin.x) * eased;
        n.pos.y = n.origin.y + (n.target.y - n.origin.y) * eased;
        n.pos.z = n.origin.z + (n.target.z - n.origin.z) * eased;
        nodePos[i * 3] = n.pos.x;
        nodePos[i * 3 + 1] = n.pos.y;
        nodePos[i * 3 + 2] = n.pos.z;
      }
      nodeGeo.attributes.position.needsUpdate = true;

      // Node opacity ramps with intro
      nodeMat.opacity = Math.min(easeOutQuart(introT) * 0.95, 0.92);

      // Edge fade-in after EDGE_FADE_START
      const eT = Math.max(0, (introT - EDGE_FADE_START) / (1 - EDGE_FADE_START));
      edgeMat.opacity = easeOutQuart(eT) * 0.28;

      // Update edge positions every frame (cheap enough for 280 edges)
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const a = nodes[e.a].pos;
        const b = nodes[e.b].pos;
        const off = i * 6;
        edgePos[off]     = a.x;
        edgePos[off + 1] = a.y;
        edgePos[off + 2] = a.z;
        edgePos[off + 3] = b.x;
        edgePos[off + 4] = b.y;
        edgePos[off + 5] = b.z;
      }
      edgeGeo.attributes.position.needsUpdate = true;

      // Slow drift once the network has formed
      if (introDone) {
        net.rotation.y += dt * 0.06;
        net.rotation.x += dt * 0.012;
        // Signal pulses
        spawnTimer += dt;
        const interval = 0.35;
        while (spawnTimer >= interval) {
          spawnTimer -= interval;
          spawnPulse();
        }
      }
      updatePulses(dt);

      camera.position.x += (mouse.x * 3 - camera.position.x) * 0.05;
      camera.position.y += (-mouse.y * 3 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------
     2. TILT cards (3D hover)
     ------------------------------------------------------------------ */
  function initTilt() {
    if (prefersReducedMotion) return;
    const cards = document.querySelectorAll('[data-tilt]');
    cards.forEach((card) => {
      const max = 8; // degrees
      let raf = 0;
      function onMove(e) {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const rx = (0.5 - y) * max;
        const ry = (x - 0.5) * max;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
          card.style.setProperty('--mx', (x * 100) + '%');
          card.style.setProperty('--my', (y * 100) + '%');
        });
      }
      function onLeave() {
        cancelAnimationFrame(raf);
        card.style.transform = '';
      }
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
    });
  }

  /* ------------------------------------------------------------------
     3. Glitch text — trigger on enter viewport + on interval
     ------------------------------------------------------------------ */
  function initGlitch() {
    if (prefersReducedMotion) return;
    const targets = document.querySelectorAll('[data-glitch]');
    targets.forEach((el) => {
      el.setAttribute('data-glitch-text', el.textContent);
    });

    function fire(el) {
      el.classList.remove('glitch-active');
      void el.offsetWidth; // restart animation
      el.classList.add('glitch-active');
      setTimeout(() => el.classList.remove('glitch-active'), 450);
    }

    targets.forEach((el, i) => {
      setTimeout(() => fire(el), 200 + i * 300);
    });

    setInterval(() => {
      const pick = targets[Math.floor(Math.random() * targets.length)];
      if (pick) fire(pick);
    }, 4500);
  }

  /* ------------------------------------------------------------------
     4. i18n — DE / EN toggle
     ------------------------------------------------------------------ */
  const I18N = {
    de: {
      'nav.services': 'Leistungen',
      'nav.methodik': 'Methodik',
      'nav.sample': 'Sample Report',
      'nav.process': 'Prozess',
      'nav.contact': 'Kontakt',

      'hero.status': 'Verfügbar ab Juli 2026 · Q3-Slots offen',
      'hero.title1': 'Offensive Security.',
      'hero.title2': 'Ich finde, was Scanner übersehen.',
      'hero.sub': '20+ verifizierte Findings über HackerOne & Bugcrowd · Bug Bounty seit 2020. Manuelle Pentests für Web, Active Directory und OT/ICS — mit Reports, die der Vorstand versteht und das Engineering umsetzen kann.',
      'hero.cta1': 'Pentest anfragen',
      'hero.cta2': 'Sample-Report ansehen',

      'services.kicker': '// LEISTUNGEN',
      'services.title': 'Was [JB] Security macht.',
      'services.lede': 'Drei Kernbereiche — manuell, methodisch, mit reproduzierbaren Befunden. Kein Vulnerability-Scan im Hochglanz-PDF.',
      'services.s1.tag': 'WEB',
      'services.s1.title': 'Web Application Pentest',
      'services.s1.body': 'Manuelle Tiefenprüfung gegen OWASP Top 10 und WSTG v4.2. Auth-Logik, Business-Logic-Flaws, SSRF, IDOR, Injection-Chains — nicht das, was der Scanner schon kennt.',
      'services.s1.l1': 'Black-, Grey- und White-Box',
      'services.s1.l2': 'API-Tests (REST, GraphQL)',
      'services.s1.l3': 'Chained Exploits & Proof-of-Concept',
      'services.s2.tag': 'NETWORK',
      'services.s2.title': 'Netzwerk & Active Directory',
      'services.s2.body': 'Externe und interne Netzwerk-Pentests inkl. AD-Angriffspfade. Kerberoasting, ACL-Missbrauch, Lateral Movement — bis zur Domain Dominance, dokumentiert nach MITRE ATT&CK.',
      'services.s2.l1': 'External / Internal / Assumed Breach',
      'services.s2.l2': 'AD-Härtung & Tier-Modell-Audit',
      'services.s2.l3': 'Phishing-Simulationen (auf Wunsch)',
      'services.s3.tag': 'OT / ICS',
      'services.s3.title': 'OT / ICS & SCADA Security',
      'services.s3.body': 'Sicherheit für industrielle Steuerungssysteme — Modbus, OPC UA, S7, Profinet. Purdue-Modell-Konformität, Segmentierungs-Audits und nicht-invasive Tests an Live-Anlagen.',
      'services.s3.l1': 'IEC 62443 / NIST SP 800-82 Alignment',
      'services.s3.l2': 'Passive Netzwerk-Analyse & Asset Discovery',
      'services.s3.l3': 'Risiko-Bewertung vor Maintenance-Windows',

      'methodik.kicker': '// METHODIK',
      'methodik.title': 'Anerkannte Standards. Keine Black Box.',
      'methodik.lede': 'Jeder Pentest ist nachvollziehbar dokumentiert — gleiche Methodik, gleiche Reproduzierbarkeit, gleiche Berichtsstruktur. Vom ersten Recon bis zum Retest.',
      'methodik.m1.title': 'OWASP',
      'methodik.m1.body': 'Top 10 (2021), ASVS, WSTG v4.2 — Tests sind 1:1 referenzierbar.',
      'methodik.m2.title': 'PTES',
      'methodik.m2.body': 'Sieben Phasen vom Pre-Engagement bis zum Reporting — nichts wird ausgelassen.',
      'methodik.m3.title': 'NIST SP 800-115',
      'methodik.m3.body': 'Technical Guide to Information Security Testing — Audit-fest.',
      'methodik.m4.title': 'MITRE ATT&CK',
      'methodik.m4.body': 'Jeder Befund wird auf TTPs gemappt — Detection-Teams können direkt Signaturen bauen.',
      'methodik.m5.title': 'CVSS v3.1 + v4.0',
      'methodik.m5.body': 'Parallele Scores — kompatibel mit PCI DSS 4.0.1 und gängigen GRC-Tools.',
      'methodik.m6.title': 'OSSTMM',
      'methodik.m6.body': 'Open Source Security Testing Methodology — für ganzheitliche Audits.',

      'sample.kicker': '// ARBEITSPROBE',
      'sample.title': 'So sieht ein Report aus.',
      'sample.lede': 'Anonymisierter Auszug aus einem realen Bug-Bounty-Report (HackerOne, disclosed & patched). Kein Hochglanz-Marketing-PDF.',
      'sample.sev': 'SEVERITY',
      'sample.status': 'STATUS',
      'sample.h1': 'Chained Exploit Chain',
      'sample.p1': 'Public form · unauth',
      'sample.p2': 'Admin dashboard · session hijack',
      'sample.p3': 'Report generator · Jinja2 escape',
      'sample.p4': 'uid=0(root) · <60s end-to-end',
      'sample.meta.id': 'Report-ID',
      'sample.meta.cwe': 'CWE',
      'sample.meta.attack': 'MITRE ATT&CK',
      'sample.cta': 'Vollständigen Report öffnen (PDF)',

      'process.kicker': '// PROZESS',
      'process.title': 'Vom Erstgespräch zum <i class="serif">Retest</i>.',
      'process.lede': 'Sauber definierter Ablauf, vertraglich geregelt — mit NDA, AVV, TOM und Authorization Letter. Auf Wunsch komplette Vertragsunterlagen vorab.',
      'process.s1.title': 'Erstgespräch & Scoping',
      'process.s1.body': 'Kostenfrei. Wir klären Scope, Test-Modus, Timing und Rules of Engagement.',
      'process.s2.title': 'Vertragspaket',
      'process.s2.body': 'Pentest-Dienstleistungsvertrag mit SoW, NDA, AVV (Art. 28 DSGVO), TOM und Authorization Letter.',
      'process.s3.title': 'Testdurchführung',
      'process.s3.body': 'Werktägliche Status-Updates, sofortige Eskalation bei Critical Findings (CVSS ≥ 9.0).',
      'process.s4.title': 'Report & Debriefing',
      'process.s4.body': 'Verschlüsselte Übergabe via PGP/S-MIME. Bis zu 2h Workshop kostenfrei inklusive.',
      'process.s5.title': 'Retest',
      'process.s5.body': 'Verifikation behobener Schwachstellen — empfohlen 6 bis 8 Wochen nach Berichtsabgabe.',

      'about.kicker': '// ÜBER',
      'about.title': 'Josef <i class="serif">Roland</i> Basner',
      'about.p1': 'Penetration Tester und Security Researcher mit Schwerpunkt auf Web-Application-Security, Active Directory und OT/ICS. Seit 2020 als Bug-Bounty-Hunter auf HackerOne und Bugcrowd aktiv — 20+ verifizierte Findings auf öffentlichen Programmen, Schwerpunkt Business-Logic-Flaws und Exploit-Chains.',
      'about.p2': 'Hintergrund aus dem industriellen Umfeld — ich verstehe, dass eine SPS-Steuerung nicht für "schnell mal Patch einspielen" gebaut wurde.',
      'about.stat1': 'IT-Berufshaftpflicht inkl. Hacker-Klausel',
      'about.stat2': 'Verifizierte Findings auf H1 & Bugcrowd',
      'about.stat3': 'Pentester · OT/ICS · Anklam & remote',

      'contact.kicker': '// KONTAKT',
      'contact.title': 'Engagement anfragen.',
      'contact.lede': 'Beschreib kurz, was du testen lassen willst. Antwort innerhalb von 48 Stunden — bei akuten Vorfällen schneller.',
      'contact.loc': 'Dr.-Külz-Straße 8a · 17389 Anklam · DE',
      'contact.note': 'Für sensible Anfragen: PGP-Schlüssel auf Anfrage. Akuter Vorfall? Direkt anrufen.',
      'mail.tag': '// DIREKTE ANFRAGE PER E-MAIL',
      'mail.title': 'Wähle deinen Anfrage-Typ.',
      'mail.body': 'Ein Klick — dein Mail-Client öffnet sich mit passendem Betreff und einer Vorlage, die ich für die Auftragsklärung brauche. Keine Drittanbieter, kein Tracking, kein Cookie-Banner.',
      'mail.o1': 'Web Application Pentest',
      'mail.o2': 'Netzwerk- / AD-Pentest',
      'mail.o3': 'OT / ICS Security Assessment',
      'mail.o4': 'Beratung / Sonstiges',
      'mail.foot': 'Mail-Client nicht eingerichtet? Schreib direkt an <a href="mailto:josefbasner@proton.me"><strong>josefbasner@proton.me</strong></a>.',

      'footer.kleinunt': 'Kleinunternehmer § 19 UStG',
      'footer.impressum': 'Impressum',
      'footer.datenschutz': 'Datenschutz',
      'footer.year': '© 2026',
    },
    en: {
      'nav.services': 'Services',
      'nav.methodik': 'Methodology',
      'nav.sample': 'Sample Report',
      'nav.process': 'Process',
      'nav.contact': 'Contact',

      'hero.status': 'Available from July 2026 · Q3 slots open',
      'hero.title1': 'Offensive Security.',
      'hero.title2': 'I find what scanners miss.',
      'hero.sub': '20+ verified findings on HackerOne & Bugcrowd · bug bounty hunter since 2020. Manual penetration testing for web, Active Directory, and OT/ICS — with reports the board understands and engineering can act on.',
      'hero.cta1': 'Request a pentest',
      'hero.cta2': 'View sample report',

      'services.kicker': '// SERVICES',
      'services.title': 'What [JB] Security does.',
      'services.lede': 'Three core areas — manual, methodical, with reproducible findings. Not a vulnerability scan in a glossy PDF.',
      'services.s1.tag': 'WEB',
      'services.s1.title': 'Web Application Pentest',
      'services.s1.body': 'Hands-on deep dive against OWASP Top 10 and WSTG v4.2. Auth logic, business-logic flaws, SSRF, IDOR, injection chains — not what your scanner already knows.',
      'services.s1.l1': 'Black-, Grey-, and White-Box',
      'services.s1.l2': 'API testing (REST, GraphQL)',
      'services.s1.l3': 'Chained exploits & Proof-of-Concept',
      'services.s2.tag': 'NETWORK',
      'services.s2.title': 'Network & Active Directory',
      'services.s2.body': 'External and internal network pentests including AD attack paths. Kerberoasting, ACL abuse, lateral movement — all the way to domain dominance, mapped to MITRE ATT&CK.',
      'services.s2.l1': 'External / Internal / Assumed Breach',
      'services.s2.l2': 'AD hardening & tier-model audit',
      'services.s2.l3': 'Phishing simulations (on request)',
      'services.s3.tag': 'OT / ICS',
      'services.s3.title': 'OT / ICS & SCADA Security',
      'services.s3.body': 'Security for industrial control systems — Modbus, OPC UA, S7, Profinet. Purdue-model compliance, segmentation audits and non-invasive testing on live plants.',
      'services.s3.l1': 'IEC 62443 / NIST SP 800-82 alignment',
      'services.s3.l2': 'Passive network analysis & asset discovery',
      'services.s3.l3': 'Risk assessment before maintenance windows',

      'methodik.kicker': '// METHODOLOGY',
      'methodik.title': 'Recognized standards. No black box.',
      'methodik.lede': 'Every pentest is traceable — same methodology, same reproducibility, same report structure. From recon to retest.',
      'methodik.m1.title': 'OWASP',
      'methodik.m1.body': 'Top 10 (2021), ASVS, WSTG v4.2 — tests are 1:1 referenceable.',
      'methodik.m2.title': 'PTES',
      'methodik.m2.body': 'Seven phases from pre-engagement to reporting — nothing skipped.',
      'methodik.m3.title': 'NIST SP 800-115',
      'methodik.m3.body': 'Technical Guide to Information Security Testing — audit-ready.',
      'methodik.m4.title': 'MITRE ATT&CK',
      'methodik.m4.body': 'Every finding mapped to TTPs — detection teams can build signatures directly.',
      'methodik.m5.title': 'CVSS v3.1 + v4.0',
      'methodik.m5.body': 'Parallel scores — compatible with PCI DSS 4.0.1 and common GRC tools.',
      'methodik.m6.title': 'OSSTMM',
      'methodik.m6.body': 'Open Source Security Testing Methodology — for holistic audits.',

      'sample.kicker': '// WORK SAMPLE',
      'sample.title': 'This is what a report looks like.',
      'sample.lede': 'Anonymized excerpt from a real bug bounty report (HackerOne, disclosed & patched). No glossy marketing PDF.',
      'sample.sev': 'SEVERITY',
      'sample.status': 'STATUS',
      'sample.h1': 'Chained Exploit Chain',
      'sample.p1': 'Public form · unauth',
      'sample.p2': 'Admin dashboard · session hijack',
      'sample.p3': 'Report generator · Jinja2 escape',
      'sample.p4': 'uid=0(root) · <60s end-to-end',
      'sample.meta.id': 'Report ID',
      'sample.meta.cwe': 'CWE',
      'sample.meta.attack': 'MITRE ATT&CK',
      'sample.cta': 'Open full report (PDF)',

      'process.kicker': '// PROCESS',
      'process.title': 'From kickoff to <i class="serif">retest</i>.',
      'process.lede': 'Clean, contractually governed workflow — with NDA, DPA, TOM and authorization letter. Full contract package up front on request.',
      'process.s1.title': 'Kickoff & scoping',
      'process.s1.body': 'Free of charge. We define scope, test mode, timing and rules of engagement.',
      'process.s2.title': 'Contract package',
      'process.s2.body': 'Pentest service agreement with SoW, NDA, DPA (Art. 28 GDPR), TOM and authorization letter.',
      'process.s3.title': 'Testing',
      'process.s3.body': 'Daily status updates, immediate escalation on critical findings (CVSS ≥ 9.0).',
      'process.s4.title': 'Report & debrief',
      'process.s4.body': 'Encrypted delivery via PGP/S-MIME. Up to 2h workshop included free.',
      'process.s5.title': 'Retest',
      'process.s5.body': 'Verification of fixes — recommended 6 to 8 weeks after report delivery.',

      'about.kicker': '// ABOUT',
      'about.title': 'Josef <i class="serif">Roland</i> Basner',
      'about.p1': 'Penetration tester and security researcher focused on web application security, Active Directory, and OT/ICS. Active bug bounty hunter on HackerOne and Bugcrowd since 2020 — 20+ verified findings on public programs, with a focus on business-logic flaws and chained exploits.',
      'about.p2': 'Background in industrial environments — I understand that a PLC controller wasn\'t built for "let\'s just patch it real quick".',
      'about.stat1': 'IT professional liability incl. hacker clause',
      'about.stat2': 'Verified findings on H1 & Bugcrowd',
      'about.stat3': 'Pentester · OT/ICS · Anklam & remote',

      'contact.kicker': '// CONTACT',
      'contact.title': 'Request an engagement.',
      'contact.lede': 'Briefly describe what you want tested. Reply within 48 hours — faster for active incidents.',
      'contact.loc': 'Dr.-Külz-Straße 8a · 17389 Anklam · Germany',
      'contact.note': 'For sensitive inquiries: PGP key on request. Active incident? Call directly.',
      'mail.tag': '// DIRECT EMAIL INQUIRY',
      'mail.title': 'Pick your inquiry type.',
      'mail.body': 'One click — your mail client opens with the right subject and a template I need for scoping. No third party, no tracking, no cookie banner.',
      'mail.o1': 'Web Application Pentest',
      'mail.o2': 'Network / AD Pentest',
      'mail.o3': 'OT / ICS Security Assessment',
      'mail.o4': 'Consulting / Other',
      'mail.foot': 'No mail client configured? Write directly to <a href="mailto:josefbasner@proton.me"><strong>josefbasner@proton.me</strong></a>.',

      'footer.kleinunt': 'Small business · § 19 UStG (DE)',
      'footer.impressum': 'Legal notice',
      'footer.datenschutz': 'Privacy',
      'footer.year': '© 2026',
    },
  };

  function applyLang(lang) {
    const dict = I18N[lang] || I18N.de;
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] != null) {
        el.innerHTML = dict[key];
        if (el.hasAttribute('data-glitch')) {
          el.setAttribute('data-glitch-text', el.textContent);
        }
      }
    });
    document.querySelectorAll('[data-i18n-attr-de]').forEach((el) => {
      const val = el.getAttribute('data-i18n-attr-' + lang);
      if (val == null) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = val;
      } else if (el.tagName === 'META') {
        el.content = val;
      } else {
        el.textContent = val;
      }
    });

    document.querySelectorAll('.lang-toggle [data-lang]').forEach((s) => {
      s.classList.toggle('active', s.getAttribute('data-lang') === lang);
    });

    try { localStorage.setItem('jbs-lang', lang); } catch (_) { /* ignore */ }
  }

  function initLang() {
    const toggle = document.getElementById('langToggle');
    if (!toggle) return;
    let saved = null;
    try { saved = localStorage.getItem('jbs-lang'); } catch (_) { /* ignore */ }
    const start = saved || (navigator.language && navigator.language.startsWith('en') ? 'en' : 'de');
    applyLang(start);

    toggle.addEventListener('click', () => {
      const cur = document.documentElement.lang === 'en' ? 'en' : 'de';
      applyLang(cur === 'de' ? 'en' : 'de');
    });
  }

  /* ------------------------------------------------------------------
     5a. Terminal — typewriter on viewport enter
     ------------------------------------------------------------------ */
  const TERM_LINES = [
    { cmd: 'whoami', out: 'josef_basner' },
    { cmd: 'id', out: 'uid=1337(pentester) groups=ot_ics,web_app,network,bugbounty' },
    { cmd: 'cat /etc/standards', out: 'OWASP · PTES · NIST SP 800-115 · MITRE ATT&CK · IEC 62443' },
    { cmd: 'ls -la /skills/', out: [
        'drwxr-xr-x  josef  ot-ics/        modbus, opc-ua, s7, profinet',
        'drwxr-xr-x  josef  web-app/       owasp top 10, wstg v4.2, business-logic',
        'drwxr-xr-x  josef  active-dir/    kerberoasting, acl-abuse, lateral',
        'drwxr-xr-x  josef  bug-bounty/    20+ verified · h1, bugcrowd',
      ] },
  ];

  function initTerminal() {
    const body = document.querySelector('.term-body');
    if (!body) return;
    if (prefersReducedMotion) return; // leave static fallback
    body.innerHTML = '';

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => { if (e.isIntersecting) { obs.disconnect(); run(); } });
    }, { threshold: 0.4 });
    io.observe(body);

    function lineHTML(cmd) {
      return `<p><span class="prompt">jb@security</span><span class="path">~</span>$ <span class="cmd"></span><span class="cursor">_</span></p>`;
    }
    function outHTML(text) {
      return `<p class="out">${text}</p>`;
    }
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    async function typeInto(span, text, perChar = 28) {
      for (let i = 0; i < text.length; i++) {
        span.textContent += text[i];
        await sleep(perChar + Math.random() * 24);
      }
    }

    async function run() {
      for (let i = 0; i < TERM_LINES.length; i++) {
        const ln = TERM_LINES[i];
        body.insertAdjacentHTML('beforeend', lineHTML());
        const lastP = body.lastElementChild;
        const cmdSpan = lastP.querySelector('.cmd');
        const cursor = lastP.querySelector('.cursor');
        await typeInto(cmdSpan, ln.cmd);
        cursor.remove();
        await sleep(220);
        const outs = Array.isArray(ln.out) ? ln.out : [ln.out];
        for (const o of outs) {
          body.insertAdjacentHTML('beforeend', outHTML(o));
          await sleep(70);
        }
        await sleep(380);
      }
      // Final prompt with blinker
      body.insertAdjacentHTML('beforeend',
        `<p><span class="prompt">jb@security</span><span class="path">~</span>$ <span class="cursor">_</span></p>`);
    }
  }

  /* ------------------------------------------------------------------
     5b. Counters — count up on viewport enter
     ------------------------------------------------------------------ */
  function initCounters() {
    if (!('IntersectionObserver' in window)) return;
    const els = document.querySelectorAll('[data-count]');
    if (!els.length) return;

    function formatNumber(n, decimals, locale, raw) {
      if (raw) {
        return n.toFixed(decimals);
      }
      return new Intl.NumberFormat(locale || 'de-DE', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      }).format(n);
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        obs.unobserve(el);
        const target = parseFloat(el.getAttribute('data-count'));
        const dur = parseFloat(el.getAttribute('data-duration') || '1400');
        const suffix = el.getAttribute('data-suffix') || '';
        const prefix = el.getAttribute('data-prefix') || '';
        const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
        const raw = el.hasAttribute('data-raw');
        const start = performance.now();
        function step(now) {
          const t = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          const val = target * eased;
          el.textContent = prefix + formatNumber(val, decimals, null, raw) + suffix;
          if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------
     5c. Magnetic buttons
     ------------------------------------------------------------------ */
  function initMagnetic() {
    if (prefersReducedMotion) return;
    const targets = document.querySelectorAll('.btn, .mail-option');
    targets.forEach((el) => {
      const strength = el.classList.contains('mail-option') ? 6 : 10;
      let raf = 0;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
        });
      });
      el.addEventListener('mouseleave', () => {
        cancelAnimationFrame(raf);
        el.style.transform = '';
      });
    });
  }

  /* ------------------------------------------------------------------
     5d. Cursor glow — soft blob that follows the pointer
     ------------------------------------------------------------------ */
  function initCursorGlow() {
    if (prefersReducedMotion) return;
    if (window.matchMedia('(hover: none)').matches) return; // touch
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let tx = x, ty = y;
    window.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      glow.style.transform = `translate3d(${x - 200}px, ${y - 200}px, 0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ------------------------------------------------------------------
     5e. Sample report — chain glow on viewport enter
     ------------------------------------------------------------------ */
  function initChain() {
    if (!('IntersectionObserver' in window)) return;
    const chain = document.querySelector('.finding-chain');
    if (!chain) return;
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        const phases = chain.querySelectorAll('.phase');
        phases.forEach((p, i) => {
          setTimeout(() => p.classList.add('phase-lit'), 200 + i * 320);
        });
      });
    }, { threshold: 0.3 });
    io.observe(chain);
  }

  /* ------------------------------------------------------------------
     6. Reveal on scroll
     ------------------------------------------------------------------ */
  function initReveal() {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) return;
    const els = document.querySelectorAll('.section, .card, .m-card, .phase, .process-steps li');
    els.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1)';
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', () => {
    initLang();
    initBackground();
    initCursorGlow();
    initTilt();
    initMagnetic();
    initGlitch();
    initTerminal();
    initCounters();
    initChain();
    initReveal();
  });
})();
