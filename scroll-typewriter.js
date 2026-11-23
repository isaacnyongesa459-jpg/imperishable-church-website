(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;

  const excluded = "form, aside, .contact-booking-section, .booking-details, .map-box, .contact-weather-widget, .site-footer, .announcement, .main-nav, [aria-live]";
  const targets = new Set();
  const normalized = (value) => value.replace(/\s+/g, " ").trim();

  document.querySelectorAll("main h1, main h2").forEach((element) => {
    const text = normalized(element.textContent || "");
    if (!text || element.closest(excluded)) return;
    if (element.matches("h1") || text.length >= 26) targets.add(element);
  });

  document.querySelectorAll("main > section").forEach((section) => {
    const paragraph = [...section.querySelectorAll("p")].find((element) => {
      const text = normalized(element.textContent || "");
      return text.length >= 95 && element.children.length === 0 && !element.closest(excluded);
    });
    if (paragraph) targets.add(paragraph);
  });

  const splash = document.querySelector("main.splash");
  if (splash) {
    const heading = splash.querySelector("h1");
    const paragraph = [...splash.querySelectorAll("p")].find((element) =>
      normalized(element.textContent || "").length >= 95 && element.children.length === 0
    );
    if (heading) targets.add(heading);
    if (paragraph) targets.add(paragraph);
  }

  const segmentText = (text) => {
    if (typeof Intl.Segmenter === "function") {
      return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment);
    }
    return Array.from(text);
  };

  const prepare = (element) => {
    const originalText = element.textContent || "";
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const characters = [];

    textNodes.forEach((node) => {
      const parent = node.parentNode;
      if (!parent || !node.nodeValue) return;
      const fragment = document.createDocumentFragment();
      segmentText(node.nodeValue).forEach((character) => {
        const span = document.createElement("span");
        span.className = "typewriter-char";
        span.setAttribute("aria-hidden", "true");
        span.textContent = character;
        characters.push(span);
        fragment.appendChild(span);
      });
      parent.replaceChild(fragment, node);
    });

    if (!characters.length) return null;
    const accessibleCopy = document.createElement("span");
    accessibleCopy.className = "typewriter-sr-only";
    accessibleCopy.textContent = originalText;
    element.insertBefore(accessibleCopy, element.firstChild);
    element.classList.add("typewriter-target");
    return characters;
  };

  const prepared = [];
  targets.forEach((element) => {
    const characters = prepare(element);
    if (characters) prepared.push({ element, characters });
  });

  const finish = ({ element, characters }) => {
    characters.forEach((character) => character.classList.add("is-visible"));
    element.classList.remove("is-typing");
    element.classList.add("is-typewritten");
  };

  const type = (item) => {
    const { element, characters } = item;
    if (reducedMotion.matches) {
      finish(item);
      return;
    }

    element.classList.add("is-typing");
    const interval = Math.min(20, Math.max(12, 3200 / characters.length));
    let index = 0;
    const revealNext = () => {
      if (reducedMotion.matches) {
        finish(item);
        return;
      }
      characters[index]?.classList.add("is-visible");
      index += 1;
      if (index < characters.length) window.setTimeout(revealNext, interval);
      else {
        element.classList.remove("is-typing");
        element.classList.add("is-typewritten");
      }
    };
    revealNext();
  };

  if (!prepared.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const item = prepared.find((candidate) => candidate.element === entry.target);
      if (item) type(item);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -5% 0px" });

  prepared.forEach(({ element }) => observer.observe(element));
  const onMotionChange = (event) => {
    if (event.matches) prepared.forEach((item) => finish(item));
  };
  if (typeof reducedMotion.addEventListener === "function") reducedMotion.addEventListener("change", onMotionChange);
  else if (typeof reducedMotion.addListener === "function") reducedMotion.addListener(onMotionChange);
})();
