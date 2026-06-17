/* ============================================================
   Michel Adamek — Portfolio
   ============================================================ */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const hasLibs =
  typeof window.gsap !== "undefined" &&
  typeof window.ScrollTrigger !== "undefined" &&
  typeof window.Lenis !== "undefined";

if (!hasLibs) {
  // CDN failed — drop the .js gate so all content is visible unanimated.
  document.documentElement.classList.remove("js");
} else {
  main();
}

function main() {
  gsap.registerPlugin(ScrollTrigger);

  // Always start at the top so the preloader/intro choreography owns the first paint.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  /* ---------- Theme toggle (dark default, persisted) ---------- */

  const themeBtn = document.querySelector(".nav__theme");
  function setTheme(light) {
    document.documentElement.classList.toggle("light", light);
    if (themeBtn) themeBtn.setAttribute("aria-pressed", String(light));
    try {
      localStorage.setItem("theme", light ? "light" : "dark");
    } catch (e) {}
  }
  if (themeBtn) {
    themeBtn.setAttribute("aria-pressed", String(document.documentElement.classList.contains("light")));
    themeBtn.addEventListener("click", () => {
      setTheme(!document.documentElement.classList.contains("light"));
    });
  }

  /* ---------- Smooth scroll (Lenis) ---------- */

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  /* ---------- Three.js hero background ---------- */

  (async function initWebGL() {
    const canvas = document.getElementById("webgl");
    if (!canvas) return;

    let THREE;
    try {
      THREE = await import("https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js");
    } catch (e) {
      canvas.style.display = "none";
      return;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    } catch (e) {
      canvas.style.display = "none";
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, isFinePointer ? 2 : 1.5);
    renderer.setPixelRatio(dpr);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.4) },
      uLight: { value: document.documentElement.classList.contains("light") ? 1 : 0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        void main() { gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform vec2 uRes;
        uniform vec2 uMouse;

        vec2 hash(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
            mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
            u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.05;
            a *= 0.5;
          }
          return v;
        }

        uniform float uLight;

        void main() {
          vec2 uv = gl_FragCoord.xy / uRes.xy;
          vec2 p = uv * vec2(uRes.x / uRes.y, 1.0);
          float t = uTime * 0.07;

          float n = fbm(p * 1.4 + vec2(t, -t * 0.6));
          float n2 = fbm(p * 2.8 - vec2(t * 0.7, t * 0.4) + n);

          vec2 m = uMouse * vec2(uRes.x / uRes.y, 1.0);
          float d = distance(p, m);
          float glow = exp(-d * 3.2);

          // Accent palette (site brand hues)
          vec3 lime   = vec3(0.851, 1.0, 0.247);
          vec3 teal   = vec3(0.373, 0.851, 0.831);
          vec3 violet = vec3(0.702, 0.616, 0.980);
          vec3 orange = vec3(1.0, 0.675, 0.341);
          vec3 pink   = vec3(1.0, 0.541, 0.761);

          // A flowing field that drifts the palette across the screen.
          // Noise-warped coordinate -> position along the ribbon sweep.
          float flow = n2 + 0.5 + 0.35 * sin(uv.x * 2.2 + uv.y * 1.3 + t * 2.0 + n * 3.0);
          flow = clamp(flow, 0.0, 1.0) * 4.0; // 0..4 across the 5 stops

          vec3 aurora =
              mix(lime,   teal,   smoothstep(0.0, 1.0, flow)) ;
          aurora = mix(aurora, violet, smoothstep(1.0, 2.0, flow));
          aurora = mix(aurora, orange, smoothstep(2.0, 3.0, flow));
          aurora = mix(aurora, pink,   smoothstep(3.0, 4.0, flow));

          // Soft band intensity from the second noise field (the "ribbons")
          float bands = smoothstep(0.25, 1.0, n2 + 0.5);

          // Darkening biased toward the lower-left, where the hero text sits.
          float textShade = 1.0 - 0.5 * smoothstep(0.9, 0.0, uv.x) * smoothstep(0.55, 0.0, uv.y);

          // Dark: deep base + colorful aurora ribbons
          vec3 colD = vec3(0.045, 0.046, 0.055);
          colD += aurora * (0.30 * bands + 0.10);
          colD += aurora * 0.16 * glow;
          colD *= textShade;
          colD *= 1.0 - 0.35 * pow(length(uv - 0.5), 1.7);

          // Light: paper base + pale pastel aurora (kept faint for text contrast)
          vec3 colL = vec3(0.949, 0.945, 0.926);
          colL = mix(colL, aurora, (0.16 * bands + 0.05));
          colL += aurora * 0.05 * glow;
          colL *= 1.0 - 0.06 * pow(length(uv - 0.5), 1.6);

          vec3 col = mix(colD, colL, uLight);

          // subtle grain
          col += (fract(sin(dot(uv * uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.025;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    const hero = document.querySelector(".hero");
    function resize() {
      const w = hero.clientWidth;
      const h = hero.clientHeight;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w * dpr, h * dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    // Mouse target with easing; gentle autonomous drift on touch
    const mouseTarget = new THREE.Vector2(0.5, 0.4);
    if (isFinePointer) {
      window.addEventListener("mousemove", (e) => {
        mouseTarget.set(e.clientX / window.innerWidth, 1.0 - e.clientY / window.innerHeight);
      });
    }

    let heroVisible = true;
    ScrollTrigger.create({
      trigger: hero,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => (heroVisible = self.isActive),
    });

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      if (!heroVisible) return;
      // Reduced motion: render a single static aurora frame, no time progression.
      const t = prefersReducedMotion ? 12.0 : clock.getElapsedTime();
      uniforms.uTime.value = t;
      if (prefersReducedMotion) {
        uniforms.uMouse.value.set(0.5, 0.45);
        renderer.render(scene, camera);
        renderer.setAnimationLoop(null);
        return;
      }
      if (!isFinePointer) {
        mouseTarget.set(0.5 + Math.sin(t * 0.3) * 0.2, 0.45 + Math.cos(t * 0.22) * 0.15);
      }
      uniforms.uMouse.value.lerp(mouseTarget, 0.05);
      // Ease the shader between themes when the toggle flips
      const lightTarget = document.documentElement.classList.contains("light") ? 1 : 0;
      uniforms.uLight.value += (lightTarget - uniforms.uLight.value) * 0.08;
      renderer.render(scene, camera);
    });
  })();

  /* ---------- Preloader ---------- */

  (function initLoader() {
    const loader = document.querySelector(".loader");
    const count = document.querySelector(".loader__count");
    const progress = { value: 0 };

    const intro = gsap.timeline({ paused: true });
    intro
      .to(".loader__content", { opacity: 0, y: -20, duration: 0.5, ease: "power2.in" })
      .to(".loader__panel", { yPercent: -100, duration: 0.9, ease: "power4.inOut" }, "-=0.1")
      .set(loader, { display: "none" })
      .addLabel("reveal", "-=0.55")
      .to(".hero .line", {
        y: 0,
        duration: 1.1,
        ease: "power4.out",
        stagger: 0.07,
      }, "reveal");

    if (prefersReducedMotion) {
      loader.style.display = "none";
      gsap.set(".line", { y: 0 });
      return;
    }

    // Airport-board count-up (e.g. 00 → 16), ticking as the hero settles.
    const counterEl = document.querySelector("[data-count-to]");
    if (counterEl) {
      const target = parseInt(counterEl.dataset.countTo, 10);
      const pad = counterEl.textContent.trim().length || 2;
      counterEl.textContent = "".padStart(pad, "0");
      const cObj = { v: 0 };
      intro.to(cObj, {
        v: target,
        duration: 1.1,
        ease: "power2.out",
        snap: { v: 1 },
        onUpdate: () => {
          counterEl.textContent = String(Math.round(cObj.v)).padStart(pad, "0");
        },
      }, "reveal");
    }

    gsap.to(progress, {
      value: 100,
      duration: 1.4,
      ease: "power2.inOut",
      onUpdate: () => (count.textContent = String(Math.round(progress.value)).padStart(2, "0")),
      onComplete: () => intro.play(),
    });
  })();

  /* ---------- Custom cursor ---------- */

  (function initCursor() {
    if (!isFinePointer) return;

    const dot = document.querySelector(".cursor");
    const ring = document.querySelector(".cursor-ring");
    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    const ringPos = { x: pos.x, y: pos.y };

    window.addEventListener("mousemove", (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
    });

    gsap.ticker.add(() => {
      ringPos.x += (pos.x - ringPos.x) * 0.16;
      ringPos.y += (pos.y - ringPos.y) * 0.16;
      dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%)`;
    });

    document.querySelectorAll("[data-cursor], a, button").forEach((el) => {
      el.addEventListener("mouseenter", () => ring.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => ring.classList.remove("is-hover"));
    });
    document.querySelectorAll("[data-cursor-label]").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        ring.classList.add("is-label");
        ring.textContent = el.dataset.cursorLabel;
      });
      el.addEventListener("mouseleave", () => {
        ring.classList.remove("is-label");
        ring.textContent = "";
      });
    });
  })();

  /* ---------- Menu overlay ---------- */

  (function initMenu() {
    const burger = document.querySelector(".nav__burger");
    const menu = document.querySelector(".menu");
    const links = menu.querySelectorAll(".menu__links a");
    let open = false;

    const tl = gsap.timeline({ paused: true });
    tl.set(menu, { visibility: "visible" })
      .to(menu, { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: "power4.inOut" })
      .to(links, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", stagger: 0.06 }, "-=0.25");

    function toggle(force) {
      open = typeof force === "boolean" ? force : !open;
      document.body.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-hidden", String(!open));
      if (open) {
        lenis.stop();
        tl.timeScale(1).play();
      } else {
        lenis.start();
        tl.timeScale(1.6).reverse();
      }
    }

    burger.addEventListener("click", () => toggle());
    links.forEach((a) => a.addEventListener("click", () => toggle(false)));
  })();

  /* ---------- Anchor links via Lenis ---------- */

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (href === "#") {
        e.preventDefault();
        return;
      }
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    });
  });

  /* ---------- Scroll reveals ---------- */

  if (!prefersReducedMotion) {
    // Generic reveals
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%" },
      });
    });

    // Work cards
    document.querySelectorAll(".card").forEach((card) => {
      gsap.from(card, {
        opacity: 0,
        y: 80,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: { trigger: card, start: "top 85%" },
      });
      // No image parallax: the thumbnails carry award badges near the edges,
      // so the full frame must stay visible (cropping only on hover zoom).
    });

    // Statement paragraphs — word-by-word scrub
    document.querySelectorAll("[data-split]").forEach((statement) => {
      const words = statement.textContent.trim().split(/\s+/);
      statement.innerHTML = words.map((w) => `<span class="word">${w}</span>`).join(" ");
      gsap.to(statement.querySelectorAll(".word"), {
        opacity: 1,
        stagger: 0.06,
        ease: "none",
        scrollTrigger: {
          trigger: statement,
          start: "top 78%",
          end: "bottom 45%",
          scrub: true,
        },
      });
    });

    // Services rows
    gsap.from(".service", {
      opacity: 0,
      y: 50,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.1,
      scrollTrigger: { trigger: ".services__list", start: "top 85%" },
    });

    // Footer CTA
    gsap.to(".footer__cta .line", {
      y: 0,
      duration: 1.1,
      ease: "power4.out",
      stagger: 0.1,
      scrollTrigger: { trigger: ".footer", start: "top 75%" },
    });
  }

  /* ---------- Stockholm clock ---------- */

  (function initClock() {
    const el = document.getElementById("clock");
    if (!el) return;
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Stockholm",
      timeZoneName: "short",
    });
    const tick = () => (el.textContent = fmt.format(new Date()));
    tick();
    setInterval(tick, 30000);
  })();

  /* ---------- Fit hero title to viewport width ---------- */

  function fitHeroTitle() {
    const title = document.querySelector(".hero__title");
    if (!title) return;
    title.style.fontSize = "";
    const fs = parseFloat(getComputedStyle(title).fontSize);
    let scale = 1;
    title.querySelectorAll(".line").forEach((line) => {
      if (line.scrollWidth > line.clientWidth) {
        scale = Math.min(scale, line.clientWidth / line.scrollWidth);
      }
    });
    if (scale < 1) title.style.fontSize = `${Math.floor(fs * scale * 0.99)}px`;
  }
  function fitFooterCtas() {
    document.querySelectorAll(".footer__cta").forEach((cta) => {
      const footer = cta.closest(".footer");
      if (!footer) return;
      const lines = cta.querySelectorAll(".line");
      if (!lines.length) return;
      lines.forEach((l) => (l.style.fontSize = ""));
      const cs = getComputedStyle(footer);
      const avail = footer.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      let maxW = 0;
      lines.forEach((l) => (maxW = Math.max(maxW, l.scrollWidth)));
      if (avail > 0 && maxW > avail) {
        const fs = parseFloat(getComputedStyle(lines[0]).fontSize);
        const newFs = Math.floor(fs * (avail / maxW) * 0.99);
        lines.forEach((l) => (l.style.fontSize = `${newFs}px`));
      }
    });
  }

  function fitType() {
    fitHeroTitle();
    fitFooterCtas();
  }
  window.addEventListener("resize", fitType);

  /* ---------- Refresh triggers once fonts settle ---------- */

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      fitType();
      ScrollTrigger.refresh();
    });
  } else {
    fitType();
  }
}
