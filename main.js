/* ====================================================================
   [JB] Security — main.js
   3D background, tilt cards, glitch text, i18n, form
   ==================================================================== */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     1. THREE.JS BACKGROUND — Wireframe network + drifting particles
     ------------------------------------------------------------------ */
  function initBackground() {
    if (prefersReducedMotion || !window.THREE) return;
    const canvas = document.getElementById('bgfx');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050507, 0.06);

    const camera = new THREE.PerspectiveCamera(
      55, window.innerWidth / window.innerHeight, 0.1, 100
    );
    camera.position.set(0, 0, 14);

    /* ---- Wireframe icosahedron (the "core") ---- */
    const coreGeo = new THREE.IcosahedronGeometry(3.4, 1);
    const coreEdges = new THREE.EdgesGeometry(coreGeo);
    const coreMat = new THREE.LineBasicMaterial({
      color: 0x00ff9d,
      transparent: true,
      opacity: 0.35,
    });
    const core = new THREE.LineSegments(coreEdges, coreMat);
    scene.add(core);

    /* ---- Inner glow sphere ---- */
    const glowGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x003322,
      transparent: true,
      opacity: 0.12,
      wireframe: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

    /* ---- Outer rotating ring (torus) ---- */
    const ringGeo = new THREE.TorusGeometry(6.5, 0.04, 8, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.25,
    });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2.6;
    scene.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo.clone(), ringMat.clone());
    ring2.rotation.x = -Math.PI / 3.2;
    ring2.rotation.y = Math.PI / 4;
    ring2.scale.setScalar(1.2);
    scene.add(ring2);

    /* ---- Particle field ---- */
    const pCount = 900;
    const positions = new Float32Array(pCount * 3);
    const speeds = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
      const r = 8 + Math.random() * 22;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      speeds[i] = 0.2 + Math.random() * 0.6;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x00ff9d,
      size: 0.04,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    /* ---- Mouse parallax ---- */
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('mousemove', (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 0.5;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 0.5;
    }, { passive: true });

    /* ---- Resize ---- */
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
    window.addEventListener('resize', onResize, { passive: true });

    /* ---- Animate ---- */
    let last = performance.now();
    let running = true;
    document.addEventListener('visibilitychange', () => {
      running = document.visibilityState === 'visible';
      if (running) { last = performance.now(); requestAnimationFrame(loop); }
    });

    function loop(now) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;

      core.rotation.x += dt * 0.15;
      core.rotation.y += dt * 0.22;
      glow.rotation.y -= dt * 0.1;
      ring1.rotation.z += dt * 0.18;
      ring2.rotation.z -= dt * 0.12;
      particles.rotation.y += dt * 0.04;

      camera.position.x += (mouse.x * 4 - camera.position.x) * 0.05;
      camera.position.y += (-mouse.y * 4 - camera.position.y) * 0.05;
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
      'hero.cta1': 'Engagement anfragen',
      'hero.cta2': 'Echten Fund ansehen',

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
      'process.title': 'Vom Erstgespräch zum Retest.',
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
      'about.title': 'Josef Roland Basner',
      'about.p1': 'Penetration Tester und Security Researcher mit Schwerpunkt auf Web-Application-Security, Active Directory und OT/ICS. Seit 2020 als Bug-Bounty-Hunter auf HackerOne und Bugcrowd aktiv — 20+ verifizierte Findings auf öffentlichen Programmen, Schwerpunkt Business-Logic-Flaws und Exploit-Chains.',
      'about.p2': 'Hintergrund aus dem industriellen Umfeld — ich verstehe, dass eine SPS-Steuerung nicht für "schnell mal Patch einspielen" gebaut wurde.',
      'about.stat1': 'IT-Berufshaftpflicht inkl. Hacker-Klausel',
      'about.stat2': 'Verifizierte Findings auf H1 & Bugcrowd',
      'about.stat3': 'Standort Anklam · vor Ort & remote',

      'contact.kicker': '// KONTAKT',
      'contact.title': 'Engagement anfragen.',
      'contact.lede': 'Beschreib kurz, was du testen lassen willst. Antwort innerhalb von 48 Stunden — bei akuten Vorfällen schneller.',
      'contact.loc': 'Dr.-Külz-Straße 8a · 17389 Anklam · DE',
      'contact.note': 'Für sensible Anfragen: PGP-Schlüssel auf Anfrage. Akuter Vorfall? Direkt anrufen.',
      'form.name': 'Name / Firma',
      'form.email': 'E-Mail',
      'form.type': 'Art des Engagements',
      'form.t1': 'Web Application Pentest',
      'form.t2': 'Netzwerk- / AD-Pentest',
      'form.t3': 'OT / ICS Security Assessment',
      'form.t4': 'Sonstiges / Beratung',
      'form.msg': 'Kurzbeschreibung',
      'form.consent': 'Ich bin damit einverstanden, dass meine Angaben zur Beantwortung verarbeitet werden.',
      'form.submit': 'Anfrage senden →',

      'footer.kleinunt': 'Einzelunternehmer · Kleinunternehmer gemäß § 19 UStG',
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
      'hero.cta1': 'Request engagement',
      'hero.cta2': 'See a real finding',

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
      'process.title': 'From kickoff to retest.',
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
      'about.title': 'Josef Roland Basner',
      'about.p1': 'Penetration tester and security researcher focused on web application security, Active Directory, and OT/ICS. Active bug bounty hunter on HackerOne and Bugcrowd since 2020 — 20+ verified findings on public programs, with a focus on business-logic flaws and chained exploits.',
      'about.p2': 'Background in industrial environments — I understand that a PLC controller wasn\'t built for "let\'s just patch it real quick".',
      'about.stat1': 'IT professional liability incl. hacker clause',
      'about.stat2': 'Verified findings on H1 & Bugcrowd',
      'about.stat3': 'Based in Anklam · on-site & remote',

      'contact.kicker': '// CONTACT',
      'contact.title': 'Request an engagement.',
      'contact.lede': 'Briefly describe what you want tested. Reply within 48 hours — faster for active incidents.',
      'contact.loc': 'Dr.-Külz-Straße 8a · 17389 Anklam · Germany',
      'contact.note': 'For sensitive inquiries: PGP key on request. Active incident? Call directly.',
      'form.name': 'Name / Company',
      'form.email': 'Email',
      'form.type': 'Type of engagement',
      'form.t1': 'Web Application Pentest',
      'form.t2': 'Network / AD Pentest',
      'form.t3': 'OT / ICS Security Assessment',
      'form.t4': 'Other / Consulting',
      'form.msg': 'Brief description',
      'form.consent': 'I consent to my data being processed for the purpose of replying to this inquiry.',
      'form.submit': 'Send inquiry →',

      'footer.kleinunt': 'Sole proprietor · Small business per § 19 UStG (Germany)',
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
     5. Form — success toast on ?sent=1 redirect
     ------------------------------------------------------------------ */
  function initForm() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sent') === '1') {
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        padding: 16px 24px; background: #00ff9d; color: #000;
        font-family: var(--mono); font-size: 13px; font-weight: 600;
        border-radius: 6px; box-shadow: 0 12px 40px rgba(0, 255, 157, 0.4);
        z-index: 100; letter-spacing: 0.05em; text-transform: uppercase;
      `;
      const lang = document.documentElement.lang;
      toast.textContent = lang === 'en'
        ? '✓ Inquiry sent — reply within 48h.'
        : '✓ Anfrage gesendet — Antwort binnen 48h.';
      document.body.appendChild(toast);
      setTimeout(() => toast.style.opacity = '0', 4500);
      setTimeout(() => toast.remove(), 5500);
      history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
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
    initTilt();
    initGlitch();
    initForm();
    initReveal();
  });
})();
