// --- Headless Tools for Context Menu ---
import { HeadlessBgRemover } from './core/HeadlessBgRemover.js';
import { HeadlessImg2Svg } from './core/HeadlessImg2Svg.js';

try {
const { React, YiziAPI } = window;
const el = (tag, props = {}, ...c) => React.createElement(tag, props, ...c);

if (!document.getElementById('yizi-toolkit-css')) {
    const link = document.createElement('link');
    link.id = 'yizi-toolkit-css';
    link.rel = 'stylesheet';
    link.href = `yiziview-plugin://Yizi-Toolkit/style.css?t=${Date.now()}`;
    document.head.appendChild(link);
}

// Clean up old right-dock and topbar-actions just in case
if (window.__ToolkitTopbarTrigger) {
    YiziAPI.unregisterComponent('topbar-actions', window.__ToolkitTopbarTrigger);
    window.__ToolkitTopbarTrigger = null;
}
if (window.__ToolkitWidgetWrapper) {
    YiziAPI.unregisterComponent('right-dock', window.__ToolkitWidgetWrapper);
    window.__ToolkitWidgetWrapper = null;
}

let FloatingToolkitComponent = null;

const FloatingToolkitWrapper = () => {
    const [loaded, setLoaded] = React.useState(false);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        let isMounted = true;
        if (!FloatingToolkitComponent) {
            import('./components/FloatingToolkit.js').then(mod => {
                FloatingToolkitComponent = mod.FloatingToolkit;
                if (isMounted) setLoaded(true);
            }).catch(err => {
                console.error('[YiziToolkit] Failed to load FloatingToolkit:', err);
                if (isMounted) setError(err.message);
            });
        } else {
            setLoaded(true);
        }
        return () => { isMounted = false; };
    }, []);

    if (error) return el('div', { className: 'fixed bottom-8 right-8 p-4 bg-red-900/90 text-white rounded-xl z-[9999]' }, `Toolkit 启动错误: ${error}`);
    if (!loaded) return null; // Wait for load before rendering FAB
    
    return el(FloatingToolkitComponent);
};

// Register Floating Toolkit globally to overlay
if (window.__FloatingToolkitWrapper) {
    YiziAPI.unregisterComponent('global-overlay', window.__FloatingToolkitWrapper);
}
window.__FloatingToolkitWrapper = FloatingToolkitWrapper;
YiziAPI.registerComponent('global-overlay', FloatingToolkitWrapper);

// Keep the Context Menu Action for backward compatibility but do nothing when clicked directly (or could open the FAB)
YiziAPI.registerAction({
    id: 'yizi-toolkit',
    name: 'Yizi Toolkit (悬浮窗)',
    onExecute: () => {
        // We could dispatch an event to open it, but FAB handles its own state
        YiziAPI.showToast?.('Toolkit 已转为右下角悬浮窗模式', 'info');
    }
});

if (!window.__YiziHeadlessBgRemover) window.__YiziHeadlessBgRemover = new HeadlessBgRemover();
if (!window.__YiziHeadlessImg2Svg) window.__YiziHeadlessImg2Svg = new HeadlessImg2Svg();

const isImage = (path) => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(path);

YiziAPI.registerAction({
    id: 'yizi-bg-remover',
    name: '智能抠图 (AI)',
    showInContextMenu: true,
    onExecute: (paths) => {
        if (!paths || paths.length === 0) return;
        const target = paths[0];
        if (!isImage(target)) {
            YiziAPI.showToast('智能抠图只能处理图片文件', 'warning');
            return;
        }
        const settings = window.__YiziToolkitSettings || JSON.parse(localStorage.getItem('yizi_toolkit_settings') || '{}');
        window.__YiziHeadlessBgRemover.run(target, settings);
    }
});

YiziAPI.registerAction({
    id: 'yizi-img2svg',
    name: '转为矢量图 (SVG)',
    showInContextMenu: true,
    submenu: [
        { 
            label: '徽标 / Logo 模式', 
            onClick: (paths) => {
                if (!paths || paths.length === 0 || !isImage(paths[0])) return YiziAPI.showToast('只能处理图片', 'warning');
                const settings = window.__YiziToolkitSettings || JSON.parse(localStorage.getItem('yizi_toolkit_settings') || '{}');
                window.__YiziHeadlessImg2Svg.run(paths[0], 'logo', settings);
            } 
        },
        { 
            label: '黑白线稿模式', 
            onClick: (paths) => {
                if (!paths || paths.length === 0 || !isImage(paths[0])) return YiziAPI.showToast('只能处理图片', 'warning');
                const settings = window.__YiziToolkitSettings || JSON.parse(localStorage.getItem('yizi_toolkit_settings') || '{}');
                window.__YiziHeadlessImg2Svg.run(paths[0], 'sketch', settings);
            } 
        },
        { 
            label: '高保真插画模式', 
            onClick: (paths) => {
                if (!paths || paths.length === 0 || !isImage(paths[0])) return YiziAPI.showToast('只能处理图片', 'warning');
                const settings = window.__YiziToolkitSettings || JSON.parse(localStorage.getItem('yizi_toolkit_settings') || '{}');
                window.__YiziHeadlessImg2Svg.run(paths[0], 'detailed', settings);
            } 
        }
    ]
});

} catch (err) {
    window.electron && window.electron.saveEditedImage && window.electron.saveEditedImage("C:\\Users\\Ge.W\\.gemini\\antigravity\\plugin_error.txt", err.stack || err.message, true);
    console.error(err);
}
