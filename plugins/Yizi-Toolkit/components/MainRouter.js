import { React, el, Sparkles, Scissors, Frame, Image, ChevronLeft, Settings } from '../core/globals.js';

const loadState = (key, defaultVal) => {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : defaultVal;
    } catch {
        return defaultVal;
    }
};

const TOOLS = [
    { id: 'ai', title: 'AI 创作', desc: '基于大模型的图像生成', icon: Sparkles, color: 'text-violet-400' },
    { id: 'card', title: '卡片排版', desc: '海报与卡片快速排版', icon: Frame, color: 'text-amber-400' }
];

export const MainRouter = () => {
    const [activeTool, setActiveTool] = React.useState(() => loadState('yizi-toolkit-active', 'menu'));
    const [LoadedComponent, setLoadedComponent] = React.useState(null);

    React.useEffect(() => {
        localStorage.setItem('yizi-toolkit-active', JSON.stringify(activeTool));
        let isMounted = true;

        if (activeTool === 'menu') {
            setLoadedComponent(null);
            return;
        }

        // Lazy load the requested component
        const loadComponent = async () => {
            try {
                let mod;
                if (activeTool === 'ai') mod = await import('./AIToolkit/index.js');
                else if (activeTool === 'card') mod = await import('./CardLayout/index.js');
                else if (activeTool === 'settings') mod = await import('./GlobalSettings.js');
                
                if (isMounted && mod) {
                    setLoadedComponent(() => mod.default);
                }
            } catch (err) {
                console.error(`[YiziToolkit] Failed to load tool ${activeTool}:`, err);
                if (isMounted) {
                    setLoadedComponent(() => () => el('div', { className: 'p-4 text-red-400 text-xs text-center' }, '加载模块失败，请稍后再试或检查日志'));
                }
            }
        };

        loadComponent();
        return () => { isMounted = false; };
    }, [activeTool]);

    // Render Menu
    if (activeTool === 'menu') {
        return el('div', { className: 'flex flex-col h-full animate-yizi-fade-in' },
            el('div', { className: 'p-4 border-b border-neutral-800 flex items-center justify-between shrink-0' },
                el('div', { className: 'text-sm font-semibold text-neutral-200 flex items-center gap-2 tracking-wide' }, 
                    el(Sparkles, { size: 16, className: 'text-violet-400' }), 
                    'Yizi Toolkit'
                ),
                el('button', { 
                    onClick: () => setActiveTool('settings'),
                    className: 'p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors',
                    title: '全局设置'
                }, el(Settings, { size: 14 }))
            ),
            el('div', { className: 'flex-1 overflow-y-auto p-3 flex flex-col gap-2 yizi-toolkit-scrollbar' },
                TOOLS.map(tool => el('div', {
                    key: tool.id,
                    onClick: () => setActiveTool(tool.id),
                    className: 'group flex items-center gap-3 p-3 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-xl cursor-pointer transition-all active:scale-[0.98]'
                },
                    el('div', { className: 'w-10 h-10 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0 shadow-inner group-hover:bg-neutral-800 transition-colors' },
                        tool.icon ? el(tool.icon, { size: 18, className: tool.color }) : null
                    ),
                    el('div', { className: 'flex flex-col gap-0.5 min-w-0' },
                        el('div', { className: 'text-xs font-semibold text-neutral-200 tracking-wide' }, tool.title),
                        el('div', { className: 'text-[10px] text-neutral-500 truncate' }, tool.desc)
                    )
                ))
            )
        );
    }

    // Render Active Tool
    const activeData = TOOLS.find(t => t.id === activeTool) || (activeTool === 'settings' ? { id: 'settings', title: '全局设置', icon: Settings, color: 'text-neutral-400' } : null);
    
    return el('div', { className: 'flex flex-col h-full animate-yizi-fade-in bg-[#09090b]' },
        // Sub-header Navigation
        el('div', { className: 'p-3 border-b border-neutral-800 flex items-center gap-2 shrink-0 bg-neutral-950/50 backdrop-blur-sm z-10 sticky top-0' },
            el('button', {
                onClick: () => setActiveTool('menu'),
                className: 'p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium'
            },
                ChevronLeft ? el(ChevronLeft, { size: 14 }) : '←',
                '返回'
            ),
            el('div', { className: 'w-px h-3 bg-neutral-800 mx-1' }),
            activeData && el('div', { className: `flex items-center gap-1.5 text-xs font-semibold tracking-wide ${activeData.color}` },
                activeData.icon ? el(activeData.icon, { size: 12 }) : null,
                activeData.title
            )
        ),
        // Tool Content
        el('div', { className: 'flex-1 overflow-y-auto relative yizi-toolkit-scrollbar' },
            LoadedComponent 
                ? el(React.Suspense, { fallback: el('div', { className: 'p-4 text-neutral-500 text-xs text-center' }, '加载组件...') }, el(LoadedComponent))
                : el('div', { className: 'flex items-center justify-center h-32 text-neutral-500 text-xs' }, '载入中...')
        )
    );
};
