import { React } from './globals.js';

const DEFAULT_SETTINGS = {
    servers: [],
    activeServerId: null,
    comfyUploadStrategy: 'direct', // 'direct' or 'oss'
    autoSavePath: '',
    grsaiEndpoint: 'https://grsaiapi.com/v1/api/generate',
    grsaiApiKey: '',
    ossApiUrl: 'https://wx-cloth-ehtgmbzhgb.cn-shenzhen.fcapp.run/',
    ossApiToken: 'j5grszlj4ml',
    workflowPath: ''
};

export const useSettings = () => {
    const [settings, setSettingsState] = React.useState(() => {
        try {
            const saved = localStorage.getItem('yiziview_aitoolkit_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) {
            console.error("Failed to parse AI Toolkit settings", e);
        }
        return DEFAULT_SETTINGS;
    });

    const setSettings = React.useCallback((update) => {
        setSettingsState(prev => {
            const next = typeof update === 'function' ? update(prev) : { ...prev, ...update };
            localStorage.setItem('yiziview_aitoolkit_settings', JSON.stringify(next));
            window.dispatchEvent(new CustomEvent('yizi-toolkit-settings-changed', { detail: next }));
            return next;
        });
    }, []);

    React.useEffect(() => {
        const handleSettingsChange = (e) => {
            setSettingsState(e.detail);
        };
        window.addEventListener('yizi-toolkit-settings-changed', handleSettingsChange);
        return () => window.removeEventListener('yizi-toolkit-settings-changed', handleSettingsChange);
    }, []);

    return [settings, setSettings];
};
