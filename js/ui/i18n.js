export const SUPPORTED_LOCALES = Object.freeze({ id: "Bahasa Indonesia", en_us: "English" });
export const RTL_LOCALES = Object.freeze([]);
const FALLBACK = "en_us";
const HTML_LANG = { id: "id", en_us: "en" };

async function loadDictionary(locale) {
    const res = await fetch(`i18n/${locale}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${locale}`);
    return res.json();
}

/** Interpolasi `{param}`; parameter yang tidak ada dibiarkan apa adanya. */
export function format(template, params = {}) {
    return template.replace(/\{(\w+)\}/g, (m, name) => (Object.hasOwn(params, name) ? String(params[name]) : m));
}

/** Terjemahan ringan pengganti jquery.i18n (ADR-0005). */
export function createI18n() {
    let locale = FALLBACK;
    let dict = {};
    let fallback = {};

    const t = (k, params) => format(dict[k] ?? fallback[k] ?? k, params);

    return {
        t,
        get locale() {
            return locale;
        },

        /** Memuat locale (dengan fallback ke en_us bila gagal). */
        async setLocale(next) {
            const target = Object.hasOwn(SUPPORTED_LOCALES, next) ? next : FALLBACK;
            if (Object.keys(fallback).length === 0) fallback = await loadDictionary(FALLBACK);
            try {
                dict = target === FALLBACK ? fallback : await loadDictionary(target);
                locale = target;
            } catch (err) {
                console.warn("i18n: falling back to en_us", err);
                dict = fallback;
                locale = FALLBACK;
            }
            document.documentElement.lang = HTML_LANG[locale] ?? "en";
            document.documentElement.dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
            this.apply(document);
            return locale;
        },

        /** Menerapkan terjemahan ke elemen statis ber-atribut `data-i18n*` (selalu lewat textContent). */
        apply(root) {
            for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
            for (const el of root.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
            for (const el of root.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
        },
    };
}
