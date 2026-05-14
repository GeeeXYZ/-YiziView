import { BgRemoverWidget, FloatingProgressWidget, QueueManager } from './BgRemoverWidget.js';
const { YiziAPI, React, lucide } = window;
const createElement = React.createElement;
const el = (tag, props = {}, ...children) => createElement(tag, props, ...children);

// Clean up old instances during hot reload
if (window.__BgRemoverWidget) {
    YiziAPI.unregisterComponent('right-dock', window.__BgRemoverWidget);
}
if (window.__BgRemoverFloating) {
    YiziAPI.unregisterComponent('global-overlay', window.__BgRemoverFloating);
}
window.__BgRemoverWidget = BgRemoverWidget;
window.__BgRemoverFloating = FloatingProgressWidget;

// Always register floating widget, it will return null if no tasks are active
YiziAPI.registerComponent('global-overlay', FloatingProgressWidget);

YiziAPI.registerAction({
    id: 'ai-bg-remover',
    name: 'Yizi - AI Background Remover',
    defaultShortcut: 'Ctrl+Shift+B',
    onExecute: () => {
        const isMounted = YiziAPI.getComponents('right-dock').includes(window.__BgRemoverWidget);
        if (isMounted) {
            YiziAPI.unregisterComponent('right-dock', window.__BgRemoverWidget);
        } else {
            YiziAPI.registerComponent('right-dock', window.__BgRemoverWidget);
        }
    }
});

YiziAPI.registerAction({
    id: 'ai-bg-remover-context',
    get name() {
        const lang = localStorage.getItem('yizi_language') || 'zh';
        return el('span', { className: 'text-blue-400 font-medium' }, lang === 'en' ? 'Remove background' : '移除背景');
    },
    showInContextMenu: true,
    onExecute: (paths) => {
        if (!paths || paths.length === 0) return;
        QueueManager.enqueuePaths(paths);
    }
});
