import { useState, useEffect } from 'react';
import { t, subscribeToLanguageChange, getLanguage } from '../locales/i18n';

export const useTranslation = () => {
    const [lang, setLang] = useState(getLanguage());

    useEffect(() => {
        const unsubscribe = subscribeToLanguageChange(setLang);
        return () => unsubscribe();
    }, []);

    return { t, lang };
};
