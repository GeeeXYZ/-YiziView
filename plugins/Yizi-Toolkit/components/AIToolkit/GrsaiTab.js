import { React, el, Play, RefreshCw, ImagePlus, Trash2, Sparkles, X, Crown, Zap, Star } from '../../core/globals.js';
import { PromptModule, addPromptToHistory } from './PromptModule.js';
import { uploadLocalToOSS } from '../../core/uploadUtils.js';
import { getTheme } from '../theme.js';

// Model definitions matching Grsai API spec exactly
const GEN_MODELS = [
    {
        id: 'gpt-image-2',
        name: 'GPT Image 2',
        Icon: Sparkles,
        desc: '高质量多功能生图',
        sizes: [
            { value: '1024x1024', label: '1024×1024 (方形)' },
            { value: '1792x1024', label: '1792×1024 (横版)' },
            { value: '1024x1792', label: '1024×1792 (竖版)' },
        ],
        qualities: [
            { value: 'standard', label: '标准' },
            { value: 'hd', label: 'HD 高清' },
        ],
        buildAspectRatio: (size) => size,
        extraParams: () => ({}),
    },
    {
        id: 'gpt-image-2-vip',
        name: 'GPT Image 2 VIP',
        Icon: Crown || Star,
        desc: '至尊高清 1-4K 自定义分辨率',
        sizes: [
            { value: 'auto', label: '自动 (Auto)' },
            { value: '1:1',  label: '1:1 方形' },
            { value: '16:9', label: '16:9 宽屏' },
            { value: '9:16', label: '9:16 竖屏' },
            { value: '4:3',  label: '4:3 宽屏' },
            { value: '3:4',  label: '3:4 竖屏' },
            { value: '3:2',  label: '3:2 相机' },
            { value: '2:3',  label: '2:3 肖像' },
        ],
        qualities: [
            { value: '1K', label: '1K 标清' },
            { value: '2K', label: '2K 高清' },
            { value: '4K', label: '4K 超清' },
        ],
        buildAspectRatio: (size, quality) => {
            if (size === 'auto') return 'auto';
            const map = {
                '1:1':  { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880' },
                '16:9': { '1K': '1280x720',  '2K': '2048x1152', '4K': '3840x2160' },
                '9:16': { '1K': '720x1280',  '2K': '1152x2048', '4K': '2160x3840' },
                '4:3':  { '1K': '1152x864',  '2K': '2304x1728', '4K': '3264x2448' },
                '3:4':  { '1K': '864x1152',  '2K': '1728x2304', '4K': '2448x3264' },
                '3:2':  { '1K': '1536x1024', '2K': '2048x1360', '4K': '3504x2336' },
                '2:3':  { '1K': '1024x1536', '2K': '1360x2048', '4K': '2336x3504' },
            };
            return map[size]?.[quality] || '2048x2048';
        },
        extraParams: () => ({}),
    },
    {
        id: 'nano-banana-2',
        name: 'Nano Banana 2',
        Icon: Zap,
        desc: '快速高效生图',
        sizes: [
            { value: '1:1',  label: '1:1 方形' },
            { value: '16:9', label: '16:9 横版' },
            { value: '9:16', label: '9:16 竖版' },
            { value: '4:3',  label: '4:3' },
            { value: '3:4',  label: '3:4' },
        ],
        qualities: [
            { value: '1K', label: '1K 标准' },
            { value: '2K', label: '2K 高清' },
        ],
        buildAspectRatio: (size) => size,
        extraParams: () => ({}),
    },
];

const loadState = (key, defaultVal) => {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : defaultVal;
    } catch {
        return defaultVal;
    }
};

export const GrsaiTab = ({ settings }) => {
    const theme = getTheme(settings?.theme || 'dark');
    const [modelId, setModelId] = React.useState(() => loadState('grsai-state-modelId', 'gpt-image-2'));
    const [prompt, setPrompt] = React.useState(() => loadState('grsai-state-prompt', ''));
    const [refImages, setRefImages] = React.useState(() => loadState('grsai-state-refImages', ['', '', '', '']));
    const [activeRefIdx, setActiveRefIdx] = React.useState(() => loadState('grsai-state-activeRefIdx', 0));
    const [genSize, setGenSize] = React.useState(() => loadState('grsai-state-genSize', '1024x1024'));
    const [genQuality, setGenQuality] = React.useState(() => loadState('grsai-state-genQuality', 'standard'));
    const [isExecuting, setIsExecuting] = React.useState(false);
    const [execStatus, setExecStatus] = React.useState('');
    const [tasks, setTasks] = React.useState(() => {
        try {
            const saved = localStorage.getItem('grsai-tasks');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    const [credits, setCredits] = React.useState(null);
    const [creditsError, setCreditsError] = React.useState(null);

    const currentModel = GEN_MODELS.find(m => m.id === modelId) || GEN_MODELS[0];

    // Persist tasks & maintain refs for async callbacks
    const tasksRef = React.useRef(tasks);
    const settingsRef = React.useRef(settings);
    
    React.useEffect(() => {
        tasksRef.current = tasks;
        localStorage.setItem('grsai-tasks', JSON.stringify(tasks.slice(0, 50)));
    }, [tasks]);

    React.useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    // Persist UI states
    React.useEffect(() => {
        localStorage.setItem('grsai-state-modelId', JSON.stringify(modelId));
        localStorage.setItem('grsai-state-prompt', JSON.stringify(prompt));
        localStorage.setItem('grsai-state-refImages', JSON.stringify(refImages));
        localStorage.setItem('grsai-state-activeRefIdx', JSON.stringify(activeRefIdx));
        localStorage.setItem('grsai-state-genSize', JSON.stringify(genSize));
        localStorage.setItem('grsai-state-genQuality', JSON.stringify(genQuality));
    }, [modelId, prompt, refImages, activeRefIdx, genSize, genQuality]);

    // Reset size/quality only when user explicitly changes model (not on mount)
    const prevModelRef = React.useRef(modelId);
    React.useEffect(() => {
        if (prevModelRef.current !== modelId) {
            const m = GEN_MODELS.find(m => m.id === modelId);
            if (m) {
                setGenSize(m.sizes[0].value);
                setGenQuality(m.qualities[0].value);
            }
            prevModelRef.current = modelId;
        }
    }, [modelId]);

    const fetchCredits = async () => {
        const s = settingsRef.current || settings;
        if (!s.grsaiEndpoint || !s.grsaiApiKey) return;
        setCreditsError(null);
        try {
            let endpointStr = s.grsaiEndpoint.trim();
            if (!endpointStr.startsWith('http')) endpointStr = 'https://' + endpointStr;
            
            const tokenToUse = s.grsaiCreditToken ? s.grsaiCreditToken.trim() : s.grsaiApiKey.trim().replace(/^Bearer\s+/i, '');
            const headers = { 
                'Content-Type': 'application/json'
            };
            const body = JSON.stringify({ token: tokenToUse });

            // Candidate 1: Stripped path (might keep /v1)
            let baseUrl = endpointStr;
            if (baseUrl.endsWith('/api/generate')) baseUrl = baseUrl.replace(/\/api\/generate$/, '');
            else if (baseUrl.endsWith('/generate')) baseUrl = baseUrl.replace(/\/generate$/, '');
            
            // Candidate 2: Pure origin
            const originUrl = new URL(endpointStr).origin;

            const candidates = baseUrl !== originUrl ? [baseUrl, originUrl] : [baseUrl];
            let lastResp = null;
            
            for (const base of candidates) {
                const resp = await fetch(`${base}/client/openapi/getCredits`, { method: 'POST', headers, body });
                lastResp = resp;
                if (resp.ok && resp.status !== 404) {
                    break; // Found the right one!
                }
            }

            if (!lastResp.ok) {
                setCreditsError(`HTTP ${lastResp.status}`);
                return;
            }
            const data = await lastResp.json();
            if (data.code === 0 && data.data?.credits !== undefined) {
                setCredits(data.data.credits);
                setCreditsError(null);
            } else {
                setCreditsError(data.msg || '响应异常');
            }
        } catch (e) {
            console.error('[AIToolkit] Failed to fetch credits:', e);
            setCreditsError(e.message === 'Failed to fetch' ? '网络错误/跨域' : e.message);
        }
    };

    React.useEffect(() => {
        fetchCredits();
    }, [settings.grsaiEndpoint, settings.grsaiApiKey]);

    const generateMicroThumbnail = async (url) => {
        try {
            const imgRes = await fetch(url);
            const imgBlob = await imgRes.blob();
            const objectUrl = URL.createObjectURL(imgBlob);
            return await new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const size = 64;
                    const ratio = Math.min(size / img.width, size / img.height);
                    canvas.width = Math.max(1, img.width * ratio);
                    canvas.height = Math.max(1, img.height * ratio);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(objectUrl);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                };
                img.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(null);
                };
                img.src = objectUrl;
            });
        } catch (e) {
            return null;
        }
    };

    const doAutoSave = async (urls) => {
        const s = settingsRef.current;
        if (!s.autoSavePath) return;
        for (const url of urls) {
            try {
                const imgRes = await fetch(url);
                const imgBlob = await imgRes.blob();
                const reader = new FileReader();
                reader.readAsDataURL(imgBlob);
                await new Promise(r => {
                    reader.onloadend = async () => {
                        const targetFile = `${s.autoSavePath}\\Grsai_${Date.now()}_${Math.floor(Math.random()*1000)}.png`;
                        if (window.electron?.saveEditedImage) {
                            await window.electron.saveEditedImage(targetFile, reader.result, true);
                            window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
                        }
                        r();
                    };
                });
            } catch(e) { console.error('AutoSave Error:', e); }
        }
    };

    // ── Background Polling & Submitting ──
    React.useEffect(() => {
        let active = true;
        const poll = async () => {
            if (!active) return;
            const preparingTasks = tasksRef.current.filter(t => t.status === 'preparing');
            const pendingTasks = tasksRef.current.filter(t => t.status === 'pending');

            // 1. Handle preparing tasks (Upload & Submit API)
            for (const task of preparingTasks) {
                if (!active) break;
                try {
                    const actualKey = settingsRef.current.grsaiApiKey.trim().replace(/^Bearer\s+/i, '');
                    const currentModel = GEN_MODELS.find(m => m.id === task.config.modelId) || GEN_MODELS[0];
                    const rawImages = task.config.refImages.filter(r => r);
                    const images = [];
                    for (const img of rawImages) {
                        if (img.startsWith('media://local/')) {
                            const fileRes = await fetch(img);
                            const blob = await fileRes.blob();
                            const reader = new FileReader();
                            reader.readAsDataURL(blob);
                            await new Promise(r => { reader.onloadend = () => { images.push(reader.result); r(); }});
                        } else {
                            images.push(img);
                        }
                    }

                    const extraParams = typeof currentModel.extraParams === 'function' ? currentModel.extraParams(task.config.genQuality) : {};
                    const payload = {
                        model: currentModel.id,
                        prompt: task.config.prompt,
                        images,
                        aspectRatio: typeof currentModel.buildAspectRatio === 'function'
                            ? currentModel.buildAspectRatio(task.config.genSize, task.config.genQuality) : task.config.genSize,
                        replyType: 'async',
                        ...extraParams,
                    };

                    const resp = await fetch(settingsRef.current.grsaiEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${actualKey}` },
                        body: JSON.stringify(payload)
                    });
                    
                    if (!resp.ok) throw new Error(`[${resp.status}] ${await resp.text()}`);
                    const data = await resp.json();
                    
                    if (data.id) {
                        tasksRef.current = tasksRef.current.map(t => t.id === task.id ? { ...t, id: data.id, status: 'pending' } : t);
                        setTasks([...tasksRef.current]);
                        fetchCredits();
                    } else {
                        throw new Error('API未返回任务ID');
                    }
                } catch(e) {
                    console.error('Submit error:', e);
                    tasksRef.current = tasksRef.current.map(t => t.id === task.id ? { ...t, status: 'failed' } : t);
                    setTasks([...tasksRef.current]);
                }
            }

            // 2. Handle pending tasks (Query result)
            if (pendingTasks.length > 0 && settingsRef.current.grsaiEndpoint && settingsRef.current.grsaiApiKey) {
                const queryEndpoint = settingsRef.current.grsaiEndpoint.replace('/generate', '/result');
                const actualKey = settingsRef.current.grsaiApiKey.trim().replace(/^Bearer\s+/i, '');

                for (const task of pendingTasks) {
                    if (!active) break;
                    try {
                        const resp = await fetch(`${queryEndpoint}?id=${encodeURIComponent(task.id)}`, {
                            headers: { 'Authorization': `Bearer ${actualKey}` }
                        });
                        if (!resp.ok) continue;
                        const data = await resp.json();
                        if (data.status === 'succeeded' && data.results?.length) {
                            const newUrls = data.results.map(r => r.url);
                            const thumbnails = await Promise.all(newUrls.map(url => generateMicroThumbnail(url)));
                            tasksRef.current = tasksRef.current.map(t => t.id === task.id ? { ...t, status: 'succeeded', results: newUrls, thumbnails: thumbnails, progress: 100 } : t);
                            setTasks([...tasksRef.current]);
                            doAutoSave(newUrls);
                            fetchCredits();
                        } else if (data.status === 'failed') {
                            tasksRef.current = tasksRef.current.map(t => t.id === task.id ? { ...t, status: 'failed' } : t);
                            setTasks([...tasksRef.current]);
                        } else if (data.progress !== undefined) {
                            tasksRef.current = tasksRef.current.map(t => t.id === task.id ? { ...t, progress: data.progress } : t);
                            setTasks([...tasksRef.current]);
                        }
                    } catch(e) {
                        console.error('Polling error', e);
                    }
                }
            }
            if (active) setTimeout(poll, 3000);
        };
        poll();
        return () => { active = false; };
    }, []);

    const handleRefDrop = async (e, idx) => {
        e.preventDefault();
        let path = e.dataTransfer.getData('text/plain');
        if (!path || !path.includes('.')) {
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) {
                path = window.electron?.getFilePath ? window.electron.getFilePath(files[0]) : files[0].path;
            }
        }
        if (path) {
            const newRefs = [...refImages];
            newRefs[idx] = path.startsWith('media://') ? path : `media://local/${encodeURIComponent(path)}`;
            setRefImages(newRefs);
        }
    };

    const clearRef = (idx) => {
        const newRefs = [...refImages];
        newRefs[idx] = '';
        setRefImages(newRefs);
    };

    const generate = async () => {
        if (!settings.grsaiEndpoint || !settings.grsaiApiKey) return alert('请先在设置中配置 Grsai API');
        if (!prompt.trim()) return alert('请输入提示词');

        const taskId = `local-${Date.now()}`;
        const newTask = {
            id: taskId,
            prompt: prompt.trim(),
            status: 'preparing',
            results: [],
            progress: 0,
            createdAt: Date.now(),
            config: {
                modelId,
                prompt: prompt.trim(),
                refImages: [...refImages],
                genSize,
                genQuality
            }
        };

        setTasks(prev => [newTask, ...prev]);
        addPromptToHistory('aitoolkit-grsai-prompts', prompt);
    };

    const handleRemake = (task) => {
        if (!task.config) return;
        setModelId(task.config.modelId);
        setPrompt(task.config.prompt);
        setRefImages(task.config.refImages);
        setGenSize(task.config.genSize);
        setGenQuality(task.config.genQuality);
    };

    return el('div', { className: 'flex flex-col' },

        // ── Credits bar & Model chips combined ──
        el('div', { className: "flex flex-col px-4 py-6 border-b border-black gap-6 text-black" },
            el('div', { className: "flex items-center justify-between" },
                el('div', { className: "text-xs font-black uppercase tracking-widest" }, 'GENERATION MODEL'),
                el('div', {
                    className: "flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/80 hover:bg-black hover:text-white cursor-pointer transition-colors active:scale-95 group",
                    title: creditsError ? `Error: ${creditsError}` : 'Click to refresh credits',
                    onClick: fetchCredits
                },
                    el('div', { className: `w-1.5 h-1.5 rounded-full ${credits !== null ? 'bg-black group-hover:bg-white animate-pulse' : (creditsError ? 'bg-[#ef4444]' : 'bg-black/40 group-hover:bg-white/40')}` }),
                    el('span', { className: `text-[10px] font-mono font-black ${creditsError ? 'text-[#ef4444] group-hover:text-[#ef4444]' : ''}` },
                        credits !== null 
                            ? (credits >= 10000 ? `${(credits / 1000).toFixed(1)}k` : credits.toLocaleString())
                            : (creditsError ? 'ERROR' : '---')
                    ),
                    el('span', { className: 'text-[9px] font-black uppercase tracking-widest opacity-80' }, 'CREDITS')
                )
            ),
            el('div', { className: 'flex gap-2' },
                GEN_MODELS.map(m => el('button', {
                    key: m.id,
                    onClick: () => setModelId(m.id),
                    className: `flex-1 py-2 px-1 rounded-xl border border-black/80 text-xs font-black transition-all flex flex-col items-center gap-1.5 ${
                        modelId === m.id
                            ? 'bg-black text-white shadow-[2px_2px_0px_#000]'
                            : 'bg-white text-black hover:bg-black/5 hover:shadow-[2px_2px_0px_#000]'
                    }`
                },
                    m.Icon ? el(m.Icon, { size: 14, className: modelId === m.id ? 'text-white' : 'text-black' }) : null,
                    el('div', { className: `text-[9px] uppercase tracking-widest text-center px-1` }, m.name)
                ))
            )
        ),

        // (Moved Prompt module below Size & Quality)

        // ── Size & Quality ──
        el('div', { className: "flex gap-4 px-4 py-4 border-b border-black text-black" },
            el('div', { className: 'flex-1 flex items-center justify-between gap-2' },
                el('label', { className: 'text-[10px] font-black uppercase tracking-widest shrink-0' }, 'SIZE'),
                el('div', { className: "relative border border-black/80 rounded-full overflow-hidden bg-white hover:shadow-[2px_2px_0px_#000] transition-shadow w-full max-w-[140px]" },
                    el('select', { value: genSize, onChange: e => setGenSize(e.target.value), className: "w-full appearance-none bg-transparent pl-3 pr-8 py-1.5 text-[10px] outline-none font-black text-black cursor-pointer" },
                        currentModel.sizes.map(s => el('option', { key: s.value, value: s.value }, s.value))
                    ),
                    el('div', { className: "absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[8px]" }, "▼")
                )
            ),
            el('div', { className: 'flex-1 flex items-center justify-between gap-2' },
                el('label', { className: 'text-[10px] font-black uppercase tracking-widest shrink-0' }, 'QUALITY'),
                el('div', { className: "relative border border-black/80 rounded-full overflow-hidden bg-white hover:shadow-[2px_2px_0px_#000] transition-shadow w-full max-w-[140px]" },
                    el('select', { value: genQuality, onChange: e => setGenQuality(e.target.value), className: "w-full appearance-none bg-transparent pl-3 pr-8 py-1.5 text-[10px] outline-none font-black text-black cursor-pointer" },
                        currentModel.qualities.map(q => el('option', { key: q.value, value: q.value }, q.value))
                    ),
                    el('div', { className: "absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[8px]" }, "▼")
                )
            )
        ),

        // (Prompt removed from here)

        // ── Reference Images (4 slots) ──
        el('div', { className: "flex flex-col gap-2 px-4 py-6 border-b border-black text-black" },
            el('label', { className: 'text-[10px] font-black uppercase tracking-widest' }, 'REFERENCE IMAGES (OPTIONAL)'),
            el('div', { className: 'grid grid-cols-4 gap-3' },
                [0,1,2,3].map(idx => el('div', {
                    key: idx,
                    className: `aspect-square rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer transition-all relative group border border-black/80 bg-white ${
                        activeRefIdx === idx ? 'shadow-[4px_4px_0px_#000]' : 'hover:bg-black/5 hover:shadow-[2px_2px_0px_#000]'
                    }`,
                    onClick: () => setActiveRefIdx(idx),
                    onDragOver: e => e.preventDefault(),
                    onDrop: e => handleRefDrop(e, idx)
                },
                    refImages[idx]
                        ? el('img', { src: refImages[idx], className: 'w-full h-full object-cover pointer-events-none' })
                        : el('div', { className: 'font-black text-[10px] opacity-40 uppercase tracking-widest' },
                            ImagePlus ? el(ImagePlus, { size: 16 }) : 'ADD'
                        ),
                    refImages[idx] && el('button', {
                        onClick: (e) => { e.stopPropagation(); clearRef(idx); },
                        className: 'absolute top-1 right-1 bg-black hover:bg-[#ef4444] text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity active:scale-90'
                    }, X ? el(X, { size: 10 }) : '×')
                ))
            )
        ),

        // ── Prompt (shared module) ──
        el('div', { className: 'px-4 py-6 border-b border-black text-black' },
            el(PromptModule, {
                value: prompt,
                onChange: setPrompt,
                historyKey: 'aitoolkit-grsai-prompts',
                placeholder: 'DESCRIBE YOUR VISION...',
                rows: 3
            })
        ),

        // ── Submit ──
        el('div', { className: 'px-4 py-6 border-b border-black' },
            el('button', {
                onClick: generate,
                className: "w-full py-4 rounded-full border border-black/80 text-sm font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all bg-black text-white hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_#000] active:scale-95"
            },
                Sparkles ? el(Sparkles, { size: 16 }) : null,
                'GENERATE IMAGE'
            )
        ),

        // ── History / Tasks ──
        tasks.length > 0 && el('div', { className: 'flex flex-col px-4 py-6 pb-12 animate-yizi-toolkit-pop text-black' },
            el('div', { className: 'text-[10px] font-black flex items-center justify-between uppercase tracking-widest pb-4' },
                'TASK HISTORY',
                settings.autoSavePath ? el('span', { className: 'text-[9px] opacity-50 uppercase tracking-widest' }, 'AUTO-SAVED') : null
            ),
            el('div', { className: 'flex flex-col gap-4' },
                tasks.map(task => el('div', { key: task.id, className: "flex flex-col gap-3 p-4 rounded-2xl border border-black/80 bg-white" },
                    el('div', { className: 'flex gap-4' },
                        // Thumbnails (left side)
                        task.status === 'succeeded' && task.results?.length > 0
                            ? el('div', { className: 'flex gap-2 shrink-0' },
                                task.results.slice(0, 4).map((rUrl, i) => {
                                    const thumbSrc = (task.thumbnails && task.thumbnails[i]) ? task.thumbnails[i] : rUrl;
                                    return el('div', {
                                        key: i,
                                        className: 'w-16 h-16 rounded-xl border border-black/80 bg-black/5 overflow-hidden cursor-pointer hover:scale-105 transition-transform active:scale-95',
                                        onClick: () => window.dispatchEvent(new CustomEvent('maximize-in-panel', { detail: { path: rUrl, url: rUrl } }))
                                    },
                                        el('img', { src: thumbSrc, className: 'w-full h-full object-cover' })
                                    );
                                })
                            )
                            : task.status === 'pending' || task.status === 'preparing'
                                ? el('div', { className: 'w-16 h-16 rounded-xl border border-black/80 bg-black/5 flex items-center justify-center shrink-0' },
                                    RefreshCw ? el(RefreshCw, { size: 16, className: 'animate-spin opacity-50' }) : null
                                )
                                : null,
                        // Prompt + status (right side)
                        el('div', { className: 'flex-1 min-w-0 flex flex-col justify-between' },
                            el('div', { className: 'text-[11px] break-words whitespace-pre-wrap leading-relaxed font-black line-clamp-2 uppercase' }, task.prompt),
                            el('div', { className: 'flex items-center justify-between mt-2' },
                                el('div', { className: 'text-[9px] font-black uppercase tracking-widest flex items-center gap-1' },
                                    task.status === 'preparing' ? el('span', { className: 'text-amber-500' }, 'UPLOADING...') :
                                    task.status === 'pending' ? el('span', { className: 'text-amber-500' }, 'PROCESSING', task.progress !== undefined ? ` ${task.progress}%` : '') :
                                    task.status === 'failed' ? el('span', { className: 'text-[#ef4444]' }, 'FAILED') :
                                    el('span', { className: 'opacity-50' }, 'DONE')
                                ),
                                el('div', { className: 'flex items-center gap-2' },
                                    task.config && el('button', {
                                        onClick: () => handleRemake(task),
                                        className: 'p-1.5 rounded-full border border-black/80 opacity-50 hover:opacity-100 hover:bg-black hover:text-white transition-all active:scale-90',
                                        title: 'REMIX'
                                    }, RefreshCw ? el(RefreshCw, { size: 10 }) : 'R'),
                                    el('button', {
                                        onClick: () => setTasks(prev => prev.filter(t => t.id !== task.id)),
                                        className: 'p-1.5 rounded-full border border-black/80 opacity-50 hover:opacity-100 hover:bg-[#ef4444] hover:border-[#ef4444] hover:text-white transition-all active:scale-90',
                                        title: 'DELETE'
                                    }, Trash2 ? el(Trash2, { size: 10 }) : '×')
                                )
                            )
                        )
                    ),
                    // Progress bar
                    (task.status === 'pending' || task.status === 'preparing') && el('div', { className: 'w-full h-2 border border-black/80 rounded-full overflow-hidden mt-1 bg-white' },
                        el('div', { className: 'h-full bg-black transition-all duration-300', style: { width: `${task.progress}%` } })
                    )
                ))
            )
        )
    );
};
