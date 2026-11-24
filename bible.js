(() => {
  "use strict";
  const API =
    "https://imperishable-church-mpesa-backend-fa2a.onrender.com/api/bible";
  const PUBLIC_KJV = "fallback-kjv";
  const DB_NAME = "imperishable-bible-local";
  const DB_VERSION = 1;
  const STORE = "saved-chapters";
  const LS_KEY = "imperishable-bible-study-v1";
  const $ = (selector) => document.querySelector(selector);
  const state = {
    translation: PUBLIC_KJV,
    translationName: "King James Version (KJV)",
    audioAvailable: false,
    books: [],
    chapters: [],
    book: null,
    chapter: 1,
    current: null,
    currentText: "",
    selectedVerse: null,
    saved: loadStudy(),
    db: null,
  };
  const els = {
    translation: $("#translationSelect"),
    book: $("#bookSelect"),
    chapter: $("#chapterSelect"),
    nav: $("#bibleNavigation"),
    search: $("#bibleSearch"),
    query: $("#searchQuery"),
    status: $("#bibleStatus"),
    reader: $("#bibleReader"),
    title: $("#chapterTitle"),
    label: $("#translationLabel"),
    text: $("#scriptureContent"),
    copyright: $("#scriptureCopyright"),
    previous: $("#previousChapter"),
    next: $("#nextChapter"),
    results: $("#searchResults"),
    resultList: $("#searchResultList"),
    tools: $("#verseTools"),
    savedList: $("#savedVerseList"),
    font: $("#fontSize"),
    fontValue: $("#fontSizeValue"),
    readingMode: $("#readingMode"),
    saveOffline: $("#saveOffline"),
    clearOffline: $("#clearOffline"),
    loadAudio: $("#loadAudio"),
    audio: $("#bibleAudio"),
    offlineMessage: $("#offlineMessage"),
  };

  function loadStudy() {
    try {
      return (
        JSON.parse(localStorage.getItem(LS_KEY)) || {
          bookmarks: {},
          notes: {},
          highlights: {},
          preferences: {},
        }
      );
    } catch {
      return { bookmarks: {}, notes: {}, highlights: {}, preferences: {} };
    }
  }
  function persistStudy() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state.saved));
    } catch {
      setStatus(
        "Your browser could not save study notes. Check available storage.",
        "error",
      );
    }
  }
  function setStatus(message, kind = "") {
    els.status.textContent = message;
    els.status.dataset.state = kind;
  }
  function jsonRequest(path, timeout = 11000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    return fetch(`${API}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(data.error || `Request failed (${response.status})`);
        return data;
      })
      .finally(() => clearTimeout(timer));
  }
  function openDb() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE))
          db.createObjectStore(STORE, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }
  function chapterKey(translation, book, chapter) {
    return `${translation}|${book}|${chapter}`;
  }
  function dbGet(key) {
    if (!state.db) return Promise.resolve(null);
    return new Promise((resolve) => {
      const tx = state.db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const value = req.result;
        if (value && Date.now() - value.savedAt <= 30 * 86400000)
          resolve(value);
        else {
          if (value) dbDelete(key);
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }
  function dbPut(record) {
    if (!state.db) return Promise.resolve(false);
    return new Promise((resolve) => {
      const tx = state.db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }
  function dbDelete(key) {
    if (!state.db) return;
    try {
      state.db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
    } catch {}
  }
  async function cachedApi(path, key) {
    try {
      const data = await jsonRequest(path);
      await dbPut({ key: `meta:${key}`, savedAt: Date.now(), data });
      return data;
    } catch (error) {
      const local = await dbGet(`meta:${key}`);
      if (local?.data) return local.data;
      throw error;
    }
  }
  function makeOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  function reportFums(token) {
    if (token && typeof window.fums === "function") {
      try {
        window.fums("trackView", token);
      } catch (error) {
        console.warn("Scripture view tracking was unavailable:", error);
      }
    }
  }
  function safeInlineMarkup(html, book, chapter) {
    const parsed = new DOMParser().parseFromString(
      `<section>${html || ""}</section>`,
      "text/html",
    );
    const root = parsed.body.firstElementChild;
    let activeVerse = "";
    let autoNumber = 0;
    const allowed = new Set([
      "P",
      "DIV",
      "SPAN",
      "BR",
      "EM",
      "I",
      "STRONG",
      "B",
      "SUP",
      "H2",
      "H3",
      "H4",
      "BLOCKQUOTE",
    ]);
    function copyNode(node, parent) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.nodeValue.trim() && !activeVerse) return;
        const text = node.nodeValue;
        if (!activeVerse) {
          parent.append(document.createTextNode(text));
          return;
        }
        const span = document.createElement("span");
        span.dataset.verseRef = activeVerse;
        span.textContent = text;
        parent.append(span);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (
        (tag === "SPAN" || tag === "SUP") &&
        /(^|\s)(v|verse-number|versenum)(\s|$)/i.test(
          node.getAttribute("class") || "",
        )
      ) {
        const id = (node.id || "").match(/([A-Z0-9]{2,5})\.(\d+)\.(\d+)/i);
        const n = Number(
          node.getAttribute("data-number") ||
            node.textContent.match(/\d+/)?.[0],
        );
        if (id) activeVerse = `${id[1]}.${id[2]}.${id[3]}`;
        else if (n) activeVerse = `${book}.${chapter}.${n}`;
        else activeVerse = `${book}.${chapter}.${++autoNumber}`;
        const marker = document.createElement("sup");
        marker.className = "verse-number";
        marker.textContent = String(n || autoNumber);
        parent.append(marker);
        return;
      }
      if (!allowed.has(tag)) {
        for (const child of node.childNodes) copyNode(child, parent);
        return;
      }
      const el = document.createElement(tag.toLowerCase());
      if (tag === "P" || tag === "DIV") el.className = "scripture-paragraph";
      parent.append(el);
      for (const child of node.childNodes) copyNode(child, el);
    }
    const result = document.createDocumentFragment();
    for (const child of root.childNodes) copyNode(child, result);
    return result;
  }
  function renderChapter(data) {
    state.current = data;
    state.currentText = "";
    state.book = data.bookId || state.book;
    state.chapter = Number(data.chapter) || state.chapter;
    els.text.replaceChildren();
    if (Array.isArray(data.verses)) {
      const fragment = document.createDocumentFragment();
      for (const item of data.verses) {
        const p = document.createElement("p");
        p.className = "scripture-paragraph";
        const sup = document.createElement("sup");
        sup.className = "verse-number";
        sup.textContent = String(item.verse);
        const span = document.createElement("span");
        const ref = `${item.book_id || state.book}.${data.chapter}.${item.verse}`;
        span.dataset.verseRef = ref;
        span.textContent = item.text || "";
        p.append(sup, span);
        fragment.append(p);
        state.currentText += `${item.text || ""} `;
      }
      els.text.append(fragment);
    } else {
      els.text.append(
        safeInlineMarkup(data.content, data.bookId || state.book, data.chapter),
      );
      state.currentText = els.text.textContent || "";
    }
    els.title.textContent =
      data.reference || `${data.book || state.book} ${data.chapter}`;
    els.label.textContent = state.translationName;
    els.copyright.textContent = data.copyright || "";
    els.reader.hidden = false;
    els.results.hidden = true;
    els.text.style.fontSize = `${Number(state.saved.preferences.fontSize) || 20}px`;
    const isKjv =
      state.translation === PUBLIC_KJV && data.offlineAllowed === true;
    els.saveOffline.hidden = !isKjv;
    els.clearOffline.hidden = !isKjv;
    els.loadAudio.hidden = !state.audioAvailable;
    els.audio.pause();
    els.audio.hidden = true;
    els.audio.removeAttribute("src");
    els.offlineMessage.textContent = "";
    els.text.querySelectorAll("[data-verse-ref]").forEach((node) => {
      if (state.saved.highlights[node.dataset.verseRef])
        node.classList.add("is-highlighted");
    });
    const token = data.fumsToken;
    reportFums(token);
    saveProgress();
    updateNavigation();
  }
  function saveProgress() {
    state.saved.preferences.last = {
      translation: state.translation,
      book: state.book,
      chapter: state.chapter,
    };
    persistStudy();
  }
  function updateNavigation() {
    const index = els.chapter.selectedIndex;
    const bookIndex = state.books.findIndex((book) => book.id === state.book);
    els.previous.disabled = index < 0 || (index === 0 && bookIndex <= 0);
    els.next.disabled =
      index < 0 ||
      (index === els.chapter.options.length - 1 &&
        bookIndex >= state.books.length - 1);
  }
  async function loadTranslations() {
    els.translation.disabled = true;
    try {
      const data = await cachedApi("/translations", "translations");
      const list = data.translations || [];
      els.translation.replaceChildren();
      for (const t of list) {
        const lang = t.language === "Kiswahili" ? "Kiswahili" : "English";
        makeOption(els.translation, t.id, `${t.name} · ${lang}`);
        els.translation.lastElementChild.dataset.audioAvailable = String(
          Boolean(t.audioBibles?.length),
        );
      }
      if (!list.length)
        throw new Error(
          "No approved Bible translations are currently available.",
        );
      const last = state.saved.preferences.last;
      const preferred =
        list.find((t) => t.id === last?.translation) ||
        list.find((t) => t.id === PUBLIC_KJV) ||
        list[0];
      state.translation = preferred.id;
      state.translationName = preferred.name;
      state.audioAvailable = Boolean(preferred.audioBibles?.length);
      els.translation.value = preferred.id;
      els.translation.disabled = false;
      if (data.warning) setStatus(data.warning, "");
      await loadBooks(
        last?.book && preferred.id === last.translation ? last.book : null,
        last?.chapter,
      );
    } catch (error) {
      const local = await dbGet("meta:translations");
      const list = local?.data?.translations || [
        {
          id: PUBLIC_KJV,
          name: "King James Version (KJV)",
          language: "English",
          offlineAllowed: true,
        },
      ];
      if (list.length) {
        els.translation.replaceChildren();
        for (const t of list) {
          makeOption(
            els.translation,
            t.id,
            `${t.name} · ${t.language || "English"}`,
          );
          els.translation.lastElementChild.dataset.audioAvailable = String(
            Boolean(t.audioBibles?.length),
          );
        }
        state.translation = PUBLIC_KJV;
        state.audioAvailable = false;
        state.translationName = "King James Version (KJV)";
        els.translation.value = PUBLIC_KJV;
        els.translation.disabled = false;
        await loadBooks();
        setStatus("Offline mode · only saved KJV chapters can be read.");
      } else {
        els.translation.disabled = true;
        setStatus(
          error.name === "AbortError"
            ? "Bible translation request timed out. Please try again."
            : error.message,
          "error",
        );
      }
    }
  }
  async function loadBooks(preferredBook = null, preferredChapter = null) {
    setStatus("Loading books…", "loading");
    els.book.disabled = true;
    els.chapter.disabled = true;
    try {
      const data = await cachedApi(
        `/books?translation=${encodeURIComponent(state.translation)}`,
        `books:${state.translation}`,
      );
      state.books = data.books || [];
      els.book.replaceChildren();
      for (const book of state.books) makeOption(els.book, book.id, book.name);
      if (!state.books.length)
        throw new Error("Books are unavailable for this translation.");
      state.book =
        state.books.find((b) => b.id === preferredBook)?.id ||
        state.books[0].id;
      els.book.value = state.book;
      els.book.disabled = false;
      await loadChapters(preferredChapter);
    } catch (error) {
      setStatus(
        error.name === "AbortError"
          ? "Book list request timed out."
          : error.message,
        "error",
      );
    }
  }
  async function loadChapters(preferredChapter = null) {
    els.chapter.disabled = true;
    state.chapters = [];
    els.chapter.replaceChildren();
    setStatus("Loading chapters…", "loading");
    try {
      const data = await cachedApi(
        `/chapters?translation=${encodeURIComponent(state.translation)}&book=${encodeURIComponent(state.book)}`,
        `chapters:${state.translation}:${state.book}`,
      );
      state.chapters = data.chapters || [];
      els.chapter.replaceChildren();
      for (const ch of state.chapters)
        makeOption(
          els.chapter,
          ch.number || ch.id,
          String(ch.number || ch.reference || ch.id),
        );
      if (!state.chapters.length)
        throw new Error("Chapter list is unavailable.");
      const target = state.chapters.find(
        (ch) => Number(ch.number) === Number(preferredChapter),
      );
      els.chapter.value = target
        ? target.number || target.id
        : String(state.chapters[0].number || state.chapters[0].id);
      els.chapter.disabled = false;
      setStatus("Choose a book and chapter, or search by reference.");
      updateNavigation();
      if (preferredChapter) await loadChapter();
    } catch (error) {
      setStatus(
        error.name === "AbortError"
          ? "Chapter list request timed out."
          : error.message,
        "error",
      );
    }
  }
  async function loadChapter() {
    const selected = state.chapters[els.chapter.selectedIndex];
    if (!selected) return;
    const chapterNo = selected.number || Number(els.chapter.value);
    state.chapter = Number(chapterNo) || 1;
    setStatus("Loading Scripture…", "loading");
    try {
      const data = await jsonRequest(
        `/chapter?translation=${encodeURIComponent(state.translation)}&book=${encodeURIComponent(state.book)}&chapter=${encodeURIComponent(chapterNo)}`,
      );
      data.bookId = state.book;
      renderChapter(data);
      setStatus("Scripture loaded from the selected provider.");
    } catch (error) {
      const offline = await dbGet(
        chapterKey(state.translation, state.book, chapterNo),
      );
      if (offline?.data) {
        renderChapter(offline.data);
        setStatus("Offline reading · this chapter was saved in this browser.");
        return;
      }
      setStatus(
        error.name === "AbortError"
          ? "The Bible request timed out. Check your connection and try again."
          : error.message,
        "error",
      );
    }
  }
  function renderResults(items) {
    els.resultList.replaceChildren();
    if (!items.length) {
      const p = document.createElement("p");
      p.textContent = "No matching verses were returned.";
      els.resultList.append(p);
      return;
    }
    for (const result of items) {
      const article = document.createElement("article");
      article.className = "search-result";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = result.reference || "Open passage";
      button.addEventListener("click", () => openReference(result.reference));
      const text = document.createElement("p");
      text.textContent = result.text || result.content || "";
      article.append(button, text);
      els.resultList.append(article);
    }
  }
  async function openReference(reference) {
    if (!reference) return;
    if (state.translation !== PUBLIC_KJV) {
      els.query.value = reference;
      await searchBible(reference);
      return;
    }
    try {
      setStatus("Looking up passage…", "loading");
      const data = await jsonRequest(
        `/verse?translation=${encodeURIComponent(state.translation)}&reference=${encodeURIComponent(reference)}`,
      );
      state.book = data.verses?.[0]?.book_id || state.book;
      state.chapter = data.verses?.[0]?.chapter || state.chapter;
      state.currentText = (data.verses || []).map((v) => v.text).join(" ");
      els.title.textContent = data.reference;
      els.label.textContent = state.translationName;
      els.copyright.textContent = data.copyright || "";
      els.text.replaceChildren();
      const frag = document.createDocumentFragment();
      for (const verse of data.verses || []) {
        const p = document.createElement("p");
        const sup = document.createElement("sup");
        sup.className = "verse-number";
        sup.textContent = String(verse.verse);
        const span = document.createElement("span");
        span.dataset.verseRef = `${verse.book_id}.${verse.chapter}.${verse.verse}`;
        span.textContent = verse.text;
        p.append(sup, span);
        frag.append(p);
      }
      els.text.append(frag);
      els.reader.hidden = false;
      els.results.hidden = true;
      els.loadAudio.hidden = true;
      els.audio.pause();
      els.audio.hidden = true;
      els.audio.removeAttribute("src");
      els.saveOffline.hidden = true;
      els.clearOffline.hidden = true;
      setStatus("Passage loaded from the public-domain KJV fallback.");
      els.text.querySelectorAll("[data-verse-ref]").forEach((node) => {
        if (state.saved.highlights[node.dataset.verseRef])
          node.classList.add("is-highlighted");
      });
    } catch (error) {
      setStatus(
        error.name === "AbortError"
          ? "Passage lookup timed out."
          : error.message,
        "error",
      );
    }
  }
  async function searchBible(query = els.query.value.trim()) {
    if (!query) return;
    els.query.value = query;
    setStatus("Searching Scripture…", "loading");
    els.results.hidden = false;
    els.reader.hidden = true;
    try {
      const data = await jsonRequest(
        `/search?translation=${encodeURIComponent(state.translation)}&q=${encodeURIComponent(query)}`,
      );
      reportFums(
        data.results?.find((item) => item.fumsToken)?.fumsToken ||
          data.passages?.find((item) => item.fumsToken)?.fumsToken,
      );
      $("#searchCopyright").textContent = data.copyright || "";
      renderResults(
        [...(data.results || []), ...(data.passages || [])].map((item) => ({
          ...item,
          text:
            item.text ||
            new DOMParser().parseFromString(item.content || "", "text/html")
              .body.textContent ||
            "",
        })),
      );
      setStatus(`Search complete · ${data.total || 0} results.`);
    } catch (error) {
      const refLike =
        /\d/.test(query) && /\d/.test(query.split(/\s+/).at(-1) || "");
      if (state.translation === PUBLIC_KJV && refLike) {
        await openReference(query);
        return;
      }
      setStatus(
        error.name === "AbortError"
          ? "Search timed out. Please try again."
          : error.message,
        "error",
      );
    }
  }
  function selectVerse(node) {
    const ref = node.dataset.verseRef;
    if (!ref) return;
    state.selectedVerse = ref;
    const text = (node.closest("p") || node).textContent
      .replace(/^\s*\d+\s*/, "")
      .trim();
    els.tools.hidden = false;
    els.savedList.replaceChildren();
    const panel = document.createElement("div");
    panel.className = "selected-verse";
    const title = document.createElement("strong");
    title.textContent = displayReference(ref);
    const quote = document.createElement("blockquote");
    quote.textContent = text;
    const label = document.createElement("label");
    label.htmlFor = "verseNote";
    label.textContent = "Personal note";
    const textarea = document.createElement("textarea");
    textarea.id = "verseNote";
    textarea.maxLength = 2000;
    textarea.placeholder = "Write a note saved only in this browser…";
    textarea.value = state.saved.notes[ref] || "";
    const actions = document.createElement("div");
    actions.className = "selected-actions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "reader-mode";
    save.textContent = "Save note";
    save.addEventListener("click", () => {
      state.saved.notes[ref] = textarea.value.trim();
      persistStudy();
      renderSaved();
    });
    const bookmark = document.createElement("button");
    bookmark.type = "button";
    bookmark.className = "reader-mode";
    bookmark.textContent = state.saved.bookmarks[ref]
      ? "Remove bookmark"
      : "Bookmark";
    bookmark.addEventListener("click", () => {
      if (state.saved.bookmarks[ref]) delete state.saved.bookmarks[ref];
      else
        state.saved.bookmarks[ref] = {
          reference: ref,
          text,
          translation: state.translationName,
        };
      persistStudy();
      renderSaved();
      selectVerse(node);
    });
    const highlight = document.createElement("button");
    highlight.type = "button";
    highlight.className = "reader-mode";
    highlight.textContent = state.saved.highlights[ref]
      ? "Remove highlight"
      : "Highlight";
    highlight.addEventListener("click", () => {
      if (state.saved.highlights[ref]) {
        delete state.saved.highlights[ref];
        node.classList.remove("is-highlighted");
      } else {
        state.saved.highlights[ref] = true;
        node.classList.add("is-highlighted");
      }
      persistStudy();
      renderSaved();
      selectVerse(node);
    });
    const share = document.createElement("button");
    share.type = "button";
    share.className = "reader-mode";
    share.textContent = "Share verse";
    share.addEventListener("click", () => shareVerse(ref, text));
    actions.append(save, bookmark, highlight, share);
    panel.append(title, quote, label, textarea, actions);
    els.savedList.append(panel);
    els.tools.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function renderSaved() {
    const entries = Object.entries(state.saved.bookmarks);
    const notes = Object.entries(state.saved.notes).filter(([, note]) => note);
    const refs = new Set([
      ...entries.map(([ref]) => ref),
      ...notes.map(([ref]) => ref),
    ]);
    if (!refs.size) {
      els.tools.hidden = true;
      return;
    }
    els.tools.hidden = false;
    els.savedList.replaceChildren();
    for (const ref of refs) {
      const item = document.createElement("article");
      item.className = "saved-item";
      const title = document.createElement("strong");
      title.textContent = displayReference(ref);
      const text = document.createElement("p");
      text.textContent = state.saved.bookmarks[ref]?.text || "";
      const note = document.createElement("p");
      note.textContent = state.saved.notes[ref] || "";
      item.append(title);
      if (text.textContent) item.append(text);
      if (note.textContent) item.append(note);
      const open = document.createElement("button");
      open.type = "button";
      open.className = "reader-mode";
      open.textContent = "Open passage";
      open.addEventListener("click", () => openReference(ref));
      item.append(open);
      els.savedList.append(item);
    }
  }
  function displayReference(reference) {
    const parts = String(reference).split(".");
    if (parts.length < 3) return String(reference).replaceAll(".", ":");
    const book = state.books.find((item) => item.id === parts[0]);
    return `${book?.name || parts[0]} ${parts[1]}:${parts.slice(2).join(":")}`;
  }
  async function shareVerse(reference, text) {
    const readable = displayReference(reference);
    const url = new URL("bible.html", location.href);
    url.searchParams.set("ref", readable);
    const shareData = {
      title: `${readable} · Holy Bible`,
      text: `“${text}” — ${readable}`,
      url: url.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareData.text}\n${url.href}`);
        setStatus("Verse and link copied to clipboard.");
      }
    } catch (error) {
      if (error.name !== "AbortError")
        setStatus("Sharing was cancelled or unavailable.", "error");
    }
  }
  async function changeChapter(delta) {
    const index = els.chapter.selectedIndex + delta;
    if (index >= 0 && index < els.chapter.options.length) {
      els.chapter.selectedIndex = index;
      await loadChapter();
      return;
    }
    const bookIndex = state.books.findIndex((book) => book.id === state.book);
    const nextBook = state.books[bookIndex + delta];
    if (!nextBook) return;
    state.book = nextBook.id;
    els.book.value = state.book;
    await loadChapters(delta > 0 ? 1 : null);
    if (delta < 0 && state.chapters.length) {
      els.chapter.selectedIndex = state.chapters.length - 1;
      await loadChapter();
    }
  }
  els.nav.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.translation = els.translation.value;
    state.translationName =
      els.translation.selectedOptions[0]?.textContent.split(" · ")[0] ||
      "Bible";
    state.audioAvailable =
      els.translation.selectedOptions[0]?.dataset.audioAvailable === "true";
    state.book = els.book.value;
    await loadChapter();
  });
  els.translation.addEventListener("change", async () => {
    state.translation = els.translation.value;
    state.translationName =
      els.translation.selectedOptions[0]?.textContent.split(" · ")[0] ||
      "Bible";
    state.audioAvailable =
      els.translation.selectedOptions[0]?.dataset.audioAvailable === "true";
    await loadBooks();
  });
  els.book.addEventListener("change", async () => {
    state.book = els.book.value;
    await loadChapters();
  });
  els.chapter.addEventListener("change", updateNavigation);
  els.search.addEventListener("submit", (event) => {
    event.preventDefault();
    searchBible();
  });
  els.previous.addEventListener("click", () => changeChapter(-1));
  els.next.addEventListener("click", () => changeChapter(1));
  els.font.value = String(state.saved.preferences.fontSize || 20);
  els.fontValue.textContent = `${els.font.value} px`;
  els.font.addEventListener("input", () => {
    const size = Number(els.font.value);
    els.text.style.fontSize = `${size}px`;
    els.fontValue.textContent = `${size} px`;
    state.saved.preferences.fontSize = size;
    persistStudy();
  });
  const mode = state.saved.preferences.readerDark === true;
  $("#main-content").classList.toggle("reader-dark", mode);
  els.readingMode.setAttribute("aria-pressed", String(mode));
  els.readingMode.textContent = mode ? "Light reader" : "Dark reader";
  els.readingMode.addEventListener("click", () => {
    const active = $("#main-content").classList.toggle("reader-dark");
    els.readingMode.setAttribute("aria-pressed", String(active));
    els.readingMode.textContent = active ? "Light reader" : "Dark reader";
    state.saved.preferences.readerDark = active;
    persistStudy();
  });
  els.text.addEventListener("click", (event) => {
    const target = event.target.closest("[data-verse-ref]");
    if (target) selectVerse(target);
  });
  els.saveOffline.addEventListener("click", async () => {
    if (state.translation !== PUBLIC_KJV || !state.current?.offlineAllowed)
      return;
    const ok = await dbPut({
      key: chapterKey(state.translation, state.book, state.chapter),
      savedAt: Date.now(),
      data: state.current,
      offlineAllowed: true,
    });
    els.offlineMessage.textContent = ok
      ? "This KJV chapter is saved on this device for offline reading."
      : "Offline storage is unavailable in this browser.";
  });
  els.clearOffline.addEventListener("click", () => {
    dbDelete(chapterKey(state.translation, state.book, state.chapter));
    els.offlineMessage.textContent = "Saved copy removed from this device.";
  });
  $("#shareChapter").addEventListener("click", () =>
    shareVerse(els.title.textContent, state.currentText),
  );
  let audioFumsToken = null;
  els.loadAudio.addEventListener("click", async () => {
    els.loadAudio.disabled = true;
    els.loadAudio.textContent = "Loading audio…";
    try {
      const data = await jsonRequest(
        `/audio?translation=${encodeURIComponent(state.translation)}&book=${encodeURIComponent(state.book)}&chapter=${encodeURIComponent(state.chapter)}`,
      );
      audioFumsToken = data.fumsToken || null;
      els.audio.src = new URL(data.streamUrl, API).href;
      els.audio.hidden = false;
      els.audio.setAttribute(
        "aria-label",
        `${data.reference || els.title.textContent} audio · ${data.copyright || ""}`,
      );
      els.audio.load();
      els.offlineMessage.textContent =
        data.copyright ||
        "Audio provided under the selected translation's license.";
    } catch (error) {
      setStatus(
        error.name === "AbortError"
          ? "Audio request timed out."
          : error.message,
        "error",
      );
    } finally {
      els.loadAudio.disabled = false;
      els.loadAudio.textContent = "Load chapter audio";
    }
  });
  els.audio.addEventListener("play", () => {
    if (audioFumsToken && typeof window.fums === "function") {
      window.fums("trackListen", audioFumsToken);
      audioFumsToken = null;
    }
  });
  window.addEventListener("online", () => {
    if (navigator.onLine) setStatus("Connection restored.");
  });
  window.addEventListener("offline", () =>
    setStatus(
      "You are offline. Previously saved KJV chapters remain available on this device.",
    ),
  );
  const initialRef = new URLSearchParams(location.search).get("ref");
  openDb()
    .then((db) => {
      state.db = db;
      return loadTranslations();
    })
    .then(() => {
      renderSaved();
      if (initialRef) {
        els.query.value = initialRef;
        if (state.translation === PUBLIC_KJV) openReference(initialRef);
      }
    });
  (async () => {
    try {
      const data = await jsonRequest("/daily");
      $("#dailyVerseText").textContent = `“${data.verse.text}”`;
      $("#dailyVerseReference").textContent = data.verse.reference;
      $("#dailyVerseAttribution").textContent =
        `${data.verse.translation} · ${data.verse.copyright}`;
    } catch {
      $("#dailyVerseText").textContent =
        "Today’s Scripture is temporarily unavailable. Please try again later.";
      $("#dailyVerseReference").textContent = "";
      $("#dailyVerseAttribution").textContent = "";
    }
  })();
})();
