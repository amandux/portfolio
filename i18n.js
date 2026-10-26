/* =========================================================
   i18n.js — tiny, dependency-free locale switcher.
   Shared by index.html and case-study-ecorisk.html.

   - Resolves the active locale (URL has none in this static
     site, so: saved choice -> browser language -> "en").
   - Applies the active dictionary to every element tagged
     with data-i18n (text content, via a safe textContent
     set) or data-i18n-attr (one or more "attr:key" pairs).
   - Supports simple inline tags in translated strings
     (currently just <br>) via a tiny safe allowlist-based
     renderer, never raw innerHTML of arbitrary translator
     input.
   - Persists an explicit user choice in localStorage and
     degrades gracefully if storage is unavailable.
   - Dispatches a "localechange" event on document so pages
     can react (e.g. re-fetch a locale-specific data file).
   ========================================================= */

(function (window, document) {
  'use strict';

  var SUPPORTED = ['en', 'pt-BR'];
  var DEFAULT_LOCALE = 'pt-BR';
  var STORAGE_KEY = 'site_locale';
  var DICTS = {}; // cache: { en: {...}, 'pt-BR': {...} }

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function detectBrowserLocale() {
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) {
      if (/^pt/i.test(langs[i])) return 'pt-BR';
    }
    return DEFAULT_LOCALE;
  }

  function resolveInitialLocale() {
    var saved = safeStorageGet(STORAGE_KEY);
    if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    // Português (BR) is the site's main language: no browser-language override.
    return DEFAULT_LOCALE;
  }

  // Only <br> is allowed as inline markup inside a translated string.
  // Everything else is treated as literal text (escaped), so a
  // translation file can never inject arbitrary HTML.
  function renderInline(container, raw) {
    var parts = String(raw).split(/(<br\s*\/?>)/i);
    container.textContent = '';
    for (var i = 0; i < parts.length; i++) {
      if (/^<br\s*\/?>$/i.test(parts[i])) {
        container.appendChild(document.createElement('br'));
      } else if (parts[i] !== '') {
        container.appendChild(document.createTextNode(parts[i]));
      }
    }
  }

  function lookup(dict, key) {
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    return null;
  }

  function applyDict(dict, locale) {
    var missing = [];

    var textNodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < textNodes.length; i++) {
      var el = textNodes[i];
      var key = el.getAttribute('data-i18n');
      var value = lookup(dict, key);
      if (value === null) {
        missing.push(key);
        continue; // fallback: leave existing text as-is
      }
      renderInline(el, value);
    }

    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var node = attrNodes[j];
      var pairs = node.getAttribute('data-i18n-attr').split(';');
      for (var p = 0; p < pairs.length; p++) {
        var pair = pairs[p].trim();
        if (!pair) continue;
        var split = pair.split(':');
        var attrName = split[0].trim();
        var attrKey = split[1] ? split[1].trim() : '';
        var attrValue = lookup(dict, attrKey);
        if (attrValue === null) {
          missing.push(attrKey);
          continue;
        }
        node.setAttribute(attrName, attrValue);
      }
    }

    if (missing.length && window.console && console.warn) {
      console.warn('[i18n] Missing keys for locale "' + locale + '":', missing);
    }
  }

  function updateSwitcherUI(locale) {
    var buttons = document.querySelectorAll('[data-lang-btn]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var isActive = btn.getAttribute('data-lang-btn') === locale;
      btn.setAttribute('aria-pressed', String(isActive));
      btn.classList.toggle('is-active', isActive);
    }
  }

  function loadDict(locale) {
    if (DICTS[locale]) return Promise.resolve(DICTS[locale]);
    // i18n.js lives in /i18n/, dictionaries sit next to it.
    var base = (function () {
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        if (/i18n\/i18n\.js$/.test(scripts[i].src)) {
          return scripts[i].src.replace(/i18n\.js(\?.*)?$/, '');
        }
      }
      return 'i18n/';
    })();
    return fetch(base + locale + '.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Could not load locale dictionary: ' + locale);
        return res.json();
      })
      .then(function (dict) {
        DICTS[locale] = dict;
        return dict;
      });
  }

  var currentLocale = null;

  function setLocale(locale, opts) {
    opts = opts || {};
    if (SUPPORTED.indexOf(locale) === -1) locale = DEFAULT_LOCALE;
    return loadDict(locale).then(function (dict) {
      currentLocale = locale;
      document.documentElement.setAttribute('lang', locale);
      applyDict(dict, locale);
      updateSwitcherUI(locale);
      if (opts.persist !== false) safeStorageSet(STORAGE_KEY, locale);
      document.dispatchEvent(new CustomEvent('localechange', { detail: { locale: locale, dict: dict } }));
      return dict;
    });
  }

  function getLocale() {
    return currentLocale;
  }

  // For page-specific scripts that generate text dynamically (e.g. an
  // error message set via JS rather than present in the initial DOM).
  // Falls back to the key itself if missing, and warns in the console.
  function t(key) {
    var dict = DICTS[currentLocale] || {};
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    if (window.console && console.warn) console.warn('[i18n] Missing key for t():', key);
    return key;
  }

  function wireSwitcher() {
    var buttons = document.querySelectorAll('[data-lang-btn]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        var locale = e.currentTarget.getAttribute('data-lang-btn');
        setLocale(locale);
      });
    }
  }

  // Public API
  window.i18n = {
    setLocale: setLocale,
    getLocale: getLocale,
    t: t,
    supported: SUPPORTED.slice()
  };

  // Boot: apply translations before first paint settles, then wire switcher.
  var initialLocale = resolveInitialLocale();
  setLocale(initialLocale, { persist: false }).then(function () {
    wireSwitcher();
  }).catch(function (err) {
    if (window.console && console.error) console.error('[i18n] Failed to initialize:', err);
  });

})(window, document);
