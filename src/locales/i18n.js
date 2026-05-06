import zh from './zh';
import en from './en';

const dictionaries = { zh, en };
const defaultLang = 'zh';

let currentLang = localStorage.getItem('yizi_language') || defaultLang;

const listeners = new Set();

export const setLanguage = (lang) => {
    if (dictionaries[lang]) {
        currentLang = lang;
        localStorage.setItem('yizi_language', lang);
        listeners.forEach(listener => listener(lang));
        // Optional: Dispatch event to notify non-React vanilla components
        window.dispatchEvent(new CustomEvent('language-changed', { detail: lang }));
    }
};

export const getLanguage = () => currentLang;

export const t = (key, params = {}) => {
    const dict = dictionaries[currentLang];
    if (!dict) return key;
    
    let text = dict[key] || key;
    
    // Replace params
    Object.keys(params).forEach(k => {
        text = text.replace(`{${k}}`, params[k]);
    });
    
    return text;
};

export const subscribeToLanguageChange = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};
