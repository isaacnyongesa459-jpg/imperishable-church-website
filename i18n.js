/* Shared static-site internationalization for Imperishable Crown. */
(() => {
  'use strict';
  const STORAGE_KEY = 'imperishable-language';
  const LANGUAGES = {
    en: { name: 'English', locale: 'en-KE', dir: 'ltr', label: 'Language' },
    fr: { name: 'Français', locale: 'fr-FR', dir: 'ltr', label: 'Langue' },
    sw: { name: 'Kiswahili', locale: 'sw-KE', dir: 'ltr', label: 'Lugha' },
    hi: { name: 'हिन्दी', locale: 'hi-IN', dir: 'ltr', label: 'भाषा' },
    ar: { name: 'العربية', locale: 'ar', dir: 'rtl', label: 'اللغة' },
    de: { name: 'Deutsch', locale: 'de-DE', dir: 'ltr', label: 'Sprache' },
    es: { name: 'Español', locale: 'es-ES', dir: 'ltr', label: 'Idioma' },
    pt: { name: 'Português', locale: 'pt-BR', dir: 'ltr', label: 'Idioma' },
    zh: { name: '中文', locale: 'zh-CN', dir: 'ltr', label: '语言' },
    ja: { name: '日本語', locale: 'ja-JP', dir: 'ltr', label: '言語' }
  };
  const supported = new Set(Object.keys(LANGUAGES));
  const baseLanguage = value => String(value || '').toLowerCase().split(/[-_]/)[0];
  const validLanguage = value => supported.has(baseLanguage(value)) ? baseLanguage(value) : null;
  const detectLanguage = () => {
    const preferences = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages : [navigator.language];
    for (const preference of preferences) {
      const match = validLanguage(preference);
      if (match) return match;
    }
    return 'en';
  };
  const storedLanguage = () => {
    try { return validLanguage(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  };
  let locale = storedLanguage() || detectLanguage();
  let catalog = {};
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  let observer;
  let scheduled = false;

  function applyDocumentLanguage() {
    const config = LANGUAGES[locale] || LANGUAGES.en;
    document.documentElement.lang = config.locale;
    document.documentElement.dir = config.dir;
    document.documentElement.dataset.language = locale;
  }

  async function loadCatalog(code) {
    if (code === 'en') {
      const response = await fetch('./locales/en/translation.json', { cache: 'force-cache' });
      if (!response.ok) throw new Error('English locale unavailable');
      return response.json();
    }
    const response = await fetch(`./locales/${code}/translation.json`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Locale ${code} unavailable`);
    return response.json();
  }

  function normalize(value) { return String(value).replace(/\s+/g, ' ').trim(); }
  function translateTextNode(node) {
    let record = originalText.get(node);
    if (!record) {
      record = { source: normalize(node.nodeValue), applied: null };
      originalText.set(node, record);
    } else if (record.applied !== null && node.nodeValue !== record.applied) {
      record.source = normalize(node.nodeValue);
      record.applied = null;
    }
    if (!record.source) return;
    const translated = catalog[record.source];
    const target = translated || record.source;
    const current = node.nodeValue;
    const leading = (current.match(/^\s*/) || [''])[0];
    const trailing = (current.match(/\s*$/) || [''])[0];
    const next = `${leading}${target}${trailing}`;
    if (current !== next) node.nodeValue = next;
    record.applied = next;
  }

  function translateAttribute(element, name) {
    const current = element.getAttribute(name);
    if (current === null || !normalize(current)) return;
    let records = originalAttributes.get(element);
    if (!records) { records = new Map(); originalAttributes.set(element, records); }
    let record = records.get(name);
    if (!record) {
      record = { source: normalize(current), applied: null };
      records.set(name, record);
    } else if (record.applied !== null && current !== record.applied) {
      record.source = normalize(current);
      record.applied = null;
    }
    const target = catalog[record.source] || record.source;
    if (current !== target) element.setAttribute(name, target);
    record.applied = target;
  }

  function translateDates() {
    document.querySelectorAll('[data-locale-date][datetime]').forEach(element => {
      const date = new Date(element.getAttribute('datetime'));
      if (Number.isNaN(date.getTime())) return;
      const style = element.dataset.localeDate || 'long';
      element.textContent = new Intl.DateTimeFormat(LANGUAGES[locale].locale, { dateStyle: style }).format(date);
    });
  }

  function applyTranslations() {
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && !node.parentElement.closest('script,style,noscript,option[data-language-option]')) translateTextNode(node);
    }
    document.body.querySelectorAll('*').forEach(element => {
      ['placeholder', 'title', 'aria-label', 'alt'].forEach(name => translateAttribute(element, name));
    });
    if (window.__imperishableEnglishTitle === undefined) window.__imperishableEnglishTitle = document.title;
    document.title = catalog[window.__imperishableEnglishTitle] || window.__imperishableEnglishTitle;
    translateDates();
  }

  function scheduleTranslation() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; applyTranslations(); });
  }

  function addLanguageSelector() {
    const existing = document.getElementById('siteLanguage');
    if (existing) {
      const config = LANGUAGES[locale];
      existing.value = locale;
      existing.setAttribute('aria-label', config.label);
      const existingLabel = document.querySelector('label[for="siteLanguage"]');
      if (existingLabel) existingLabel.textContent = config.label;
      return;
    }
    const header = document.querySelector('.header-inner');
    const splash = document.querySelector('.splash-content');
    const host = header || splash;
    if (!host) return;
    const wrap = document.createElement('div');
    wrap.className = 'language-switcher';
    const label = document.createElement('label');
    label.className = 'visually-hidden';
    label.htmlFor = 'siteLanguage';
    label.textContent = LANGUAGES[locale].label;
    const select = document.createElement('select');
    select.id = 'siteLanguage';
    select.name = 'language';
    select.setAttribute('aria-label', LANGUAGES[locale].label);
    Object.entries(LANGUAGES).forEach(([code, config]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = config.name;
      option.dataset.languageOption = 'true';
      select.append(option);
    });
    select.value = locale;
    select.addEventListener('change', () => setLanguage(select.value));
    wrap.append(label, select);
    const menu = header && header.querySelector('.menu-toggle');
    if (menu) header.insertBefore(wrap, menu);
    else if (header) header.append(wrap);
    else {
      const actions = splash.querySelector('.splash-actions');
      if (actions) splash.insertBefore(wrap, actions);
      else splash.append(wrap);
    }
  }

  async function setLanguage(requested) {
    const next = validLanguage(requested);
    if (!next) return;
    let nextCatalog;
    try { nextCatalog = await loadCatalog(next); }
    catch (error) {
      console.warn('Could not load the selected language; using English.', error);
      if (next !== 'en') {
        locale = 'en';
        try { localStorage.setItem(STORAGE_KEY, 'en'); } catch {}
        applyDocumentLanguage();
        catalog = await loadCatalog('en').catch(() => ({}));
        applyTranslations();
        addLanguageSelector();
      }
      return;
    }
    locale = next;
    catalog = nextCatalog;
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    applyDocumentLanguage();
    applyTranslations();
    addLanguageSelector();
    document.dispatchEvent(new CustomEvent('church:localechange', { detail: { language: locale, locale: LANGUAGES[locale].locale } }));
  }

  applyDocumentLanguage();
  window.ChurchI18n = {
    languages: LANGUAGES,
    get language() { return locale; },
    get locale() { return LANGUAGES[locale].locale; },
    t(value) { return catalog[normalize(value)] || value; },
    setLanguage,
    ready: loadCatalog(locale).then(value => {
      catalog = value;
      if (document.body) applyTranslations();
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { applyTranslations(); addLanguageSelector(); }, { once: true });
      else { applyTranslations(); addLanguageSelector(); }
      if (document.body && !observer) {
        observer = new MutationObserver(scheduleTranslation);
        observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'] });
      }
      return value;
    }).catch(error => {
      console.warn('Selected locale unavailable; falling back to English.', error);
      if (locale !== 'en') {
        locale = 'en'; applyDocumentLanguage();
        return loadCatalog('en').then(value => { catalog = value; return value; });
      }
      return {};
    })
  };
})();
