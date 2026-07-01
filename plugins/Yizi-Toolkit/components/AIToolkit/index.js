import { React, el, Settings, Sliders, Layers } from '../../core/globals.js';
import { useSettings } from '../../core/useSettings.js';
import { ComfyUITab } from './ComfyUITab.js';
import { GrsaiTab } from './GrsaiTab.js';

export default function AIToolkitWidget() {
    const [activeTab, setActiveTab] = React.useState('run');
    const [settings, setSettings] = useSettings();

    return el('div', { 
        className: "flex flex-col absolute inset-0 bg-[#121212] text-white select-none overflow-hidden transition-all ease-out duration-300"
    },
        // Header
        el('div', { className: "p-4 flex items-center justify-between shrink-0 bg-[#1a1a1a]" },
            el('div', { className: "flex items-center gap-2" },
                Layers ? el(Layers, { size: 16, className: "text-white" }) : null,
                el('span', { className: "font-bold text-sm text-white tracking-wide" }, "Yizi AIToolkit")
            )
        ),
        
        // Tabs
        el('div', { className: "flex bg-[#1a1a1a] shrink-0 p-2 gap-2" },
            el('button', { 
                onClick: () => setActiveTab('run'),
                className: `flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${activeTab === 'run' ? 'bg-[#34d399] text-black' : 'bg-[#262626] text-[#737373] hover:text-white hover:bg-[#404040]'}`
            }, "工作流"),
            el('button', { 
                onClick: () => setActiveTab('gen'),
                className: `flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${activeTab === 'gen' ? 'bg-[#34d399] text-black' : 'bg-[#262626] text-[#737373] hover:text-white hover:bg-[#404040]'}`
            }, "在线生图")
        ),
        
        // Main Content Area — no scroll here; each tab manages its own layout
        el('div', { className: "flex-1 overflow-hidden relative bg-[#121212]" },
            activeTab === 'run' ? el(ComfyUITab, { settings, setSettings }) :
            el('div', { className: "h-full overflow-y-auto p-4 ai-toolkit-scrollbar bg-[#121212]" }, el(GrsaiTab, { settings, setSettings }))
        )
    );
};
