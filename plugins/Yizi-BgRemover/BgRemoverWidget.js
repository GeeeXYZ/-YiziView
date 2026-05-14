const { React, lucide } = window;
const { useState, useRef, useCallback, useEffect } = React;
const el = (tag, props = {}, ...c) => React.createElement(tag, props, ...c);

// ─── Config ───
const SIZE = 1024;
const MODELS = [
    { 
        id: 'rmbg-1.4', 
        name: 'BRIA RMBG-1.4', 
        url: 'https://hf-mirror.com/briaai/RMBG-1.4/resolve/main/onnx/model.onnx',
        cacheKey: 'rmbg_1.4'
    },
    { 
        id: 'isnet', 
        name: 'ISNet', 
        url: 'https://hf-mirror.com/x-Liola-x/isnet-general-use-onnx/resolve/main/isnet-general-use.onnx',
        cacheKey: 'isnet_v2'
    }
];

const DB_NAME = 'YiziBgRemover'; const DB_STORE = 'models';
const ORT_CDN = 'https://unpkg.com/onnxruntime-web@1.26.0/dist';

const checker = {
    backgroundImage: 'linear-gradient(45deg,#1a1a1a 25%,transparent 25%,transparent 75%,#1a1a1a 75%),linear-gradient(45deg,#1a1a1a 25%,transparent 25%,transparent 75%,#1a1a1a 75%)',
    backgroundSize: '16px 16px', backgroundPosition: '0 0,8px 8px', backgroundColor: '#222'
};

// ─── IndexedDB ───
const openDB = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function getCache(key) { try { const db = await openDB(); return new Promise(r => { const t = db.transaction(DB_STORE,'readonly'); const q = t.objectStore(DB_STORE).get(key); q.onsuccess = () => r(q.result||null); q.onerror = () => r(null); }); } catch { return null; } }
async function setCache(key, buf) { try { const db = await openDB(); db.transaction(DB_STORE,'readwrite').objectStore(DB_STORE).put(buf, key); } catch(e) { console.warn('cache fail',e); } }

// ─── Load ORT script ───
function loadOrtScript(useWebGPU) {
    return new Promise((res, rej) => {
        if (window.ort) return res(window.ort);
        const s = document.createElement('script');
        s.src = `${ORT_CDN}/${useWebGPU ? 'ort.webgpu.min.js' : 'ort.min.js'}`;
        s.onload = () => {
            if (window.ort) { 
                window.ort.env.wasm.wasmPaths = `${ORT_CDN}/`; 
                window.ort.env.wasm.numThreads = 1; 
                res(window.ort); 
            }
            else rej(new Error('ort not found'));
        };
        s.onerror = () => rej(new Error('ORT script load failed'));
        document.head.appendChild(s);
    });
}

// ─── Preprocess ───
function preprocess(img) {
    const ow = img.naturalWidth || img.width;
    const oh = img.naturalHeight || img.height;
    const scale = Math.min(SIZE / ow, SIZE / oh);
    const dw = Math.round(ow * scale);
    const dh = Math.round(oh * scale);
    const dx = Math.round((SIZE - dw) / 2);
    const dy = Math.round((SIZE - dh) / 2);

    const c = document.createElement('canvas'); c.width = c.height = SIZE;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, dx, dy, dw, dh);

    const d = ctx.getImageData(0, 0, SIZE, SIZE).data;
    const n = SIZE * SIZE, f = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) {
        f[i]         = d[i*4]/255 - 0.5;
        f[n+i]       = d[i*4+1]/255 - 0.5;
        f[2*n+i]     = d[i*4+2]/255 - 0.5;
    }
    return { f, layout: { dx, dy, dw, dh, scale } };
}

// ─── Postprocess ───
function postprocess(mask, mH, mW, origImg, layout, alphaThreshold = 0, edgeFeather = 0) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < mask.length; i++) { if (mask[i]<mn) mn=mask[i]; if (mask[i]>mx) mx=mask[i]; }
    const rng = mx - mn || 1;
    
    // 1. Create the low-res 1024x1024 raw soft mask
    const mc = document.createElement('canvas'); mc.width = mW; mc.height = mH;
    const mctx = mc.getContext('2d'); const mid = mctx.createImageData(mW, mH);
    for (let i = 0; i < mask.length; i++) {
        let v = Math.round(((mask[i]-mn)/rng)*255);
        mid.data[i*4]=v; mid.data[i*4+1]=v; mid.data[i*4+2]=v; mid.data[i*4+3]=255;
    }
    mctx.putImageData(mid, 0, 0);

    const ow = origImg.naturalWidth||origImg.width, oh = origImg.naturalHeight||origImg.height;
    const oc = document.createElement('canvas'); oc.width = ow; oc.height = oh;
    const octx = oc.getContext('2d'); octx.drawImage(origImg, 0, 0);
    const od = octx.getImageData(0, 0, ow, oh);

    const rc = document.createElement('canvas'); rc.width = ow; rc.height = oh;
    const rctx = rc.getContext('2d'); 
    rctx.imageSmoothingEnabled = true;
    rctx.imageSmoothingQuality = 'high';
    
    // Apply feathering (blur) to the mask
    if (edgeFeather > 0) {
        rctx.filter = `blur(${edgeFeather}px)`;
    }
    
    // Crop letterbox padding and resize back to original aspect ratio
    // This utilizes the browser's high-quality bilinear/bicubic interpolation
    rctx.drawImage(mc, layout.dx, layout.dy, layout.dw, layout.dh, 0, 0, ow, oh);
    
    // Reset filter
    rctx.filter = 'none';
    
    const rd = rctx.getImageData(0, 0, ow, oh);

    // Apply alpha thresholding ON THE HIGH-RES mask to prevent jagged pixelation
    for (let i = 0; i < od.data.length/4; i++) {
        let alpha = rd.data[i*4];
        if (alpha <= alphaThreshold) {
            alpha = 0;
        } else if (alphaThreshold > 0) {
            alpha = Math.round(((alpha - alphaThreshold) / (255 - alphaThreshold)) * 255);
        }
        od.data[i*4+3] = alpha;
    }
    
    octx.putImageData(od, 0, 0);
    return oc.toDataURL('image/png');
}

let wasmWorker = null, workerSessionReady = false;
function getWasmWorker() {
    if (wasmWorker) return wasmWorker;
    const code = `
        const CDN = '${ORT_CDN}';
        let sess = null;
        self.onmessage = async (e) => {
            try {
                if (e.data.type === 'init') {
                    importScripts(CDN + '/ort.min.js');
                    ort.env.wasm.wasmPaths = CDN + '/';
                    ort.env.wasm.numThreads = 1;
                    self.postMessage({type:'status',text:'编译 WASM 模型...'});
                    sess = await ort.InferenceSession.create(e.data.buf, {executionProviders:['wasm']});
                    self.postMessage({type:'ready'});
                }
                if (e.data.type === 'run') {
                    const t = new ort.Tensor('float32', e.data.input, e.data.shape);
                    const t0 = performance.now();
                    const r = await sess.run({[sess.inputNames[0]]: t});
                    const o = r[sess.outputNames[0]];
                    const md = new Float32Array(o.data);
                    self.postMessage({type:'result', mask:md, dims:Array.from(o.dims), ms:Math.round(performance.now()-t0)}, [md.buffer]);
                }
            } catch(err) { self.postMessage({type:'error', msg:err.message}); }
        };
    `;
    wasmWorker = new Worker(URL.createObjectURL(new Blob([code], {type:'application/javascript'})));
    return wasmWorker;
}

// ─── Queue Manager (Global State) ───
export const QueueManager = {
    tasks: [],
    isProcessing: false,
    useGPU: localStorage.getItem('yizi_bg_useGPU') !== 'false',
    alphaThreshold: Number(localStorage.getItem('yizi_bg_alpha')) || 0,
    edgeFeather: 0,
    activeModelId: localStorage.getItem('yizi_bg_model') || 'rmbg-1.4',
    cachedSession: null,
    backend: null,
    listeners: new Set(),
    
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    },
    notify() {
        this.listeners.forEach(fn => fn());
    },
    getState() {
        return {
            tasks: this.tasks,
            isProcessing: this.isProcessing,
            useGPU: this.useGPU,
            alphaThreshold: this.alphaThreshold,
            edgeFeather: this.edgeFeather,
            activeModelId: this.activeModelId,
            backend: this.backend
        };
    },
    
    setUseGPU(val) {
        if (this.useGPU === val) return;
        this.useGPU = val;
        localStorage.setItem('yizi_bg_useGPU', val);
        this.cachedSession = null;
        this.backend = null;
        this.notify();
    },
    
    setActiveModelId(id) {
        if (this.activeModelId === id) return;
        this.activeModelId = id;
        localStorage.setItem('yizi_bg_model', id);
        this.cachedSession = null;
        this.backend = null;
        this.notify();
    },
    
    setAlphaThreshold(val) {
        this.alphaThreshold = val;
        localStorage.setItem('yizi_bg_alpha', val);
        this.notify();
    },

    setEdgeFeather(val) {
        this.edgeFeather = val;
        this.notify();
    },
    
    updateTask(id, updates) {
        this.tasks = this.tasks.map(t => t.id === id ? { ...t, ...updates } : t);
        this.notify();
    },
    
    clearAll() {
        this.tasks = [];
        this.notify();
    },
    
    enqueueFiles(files) {
        const newTasks = files.map(f => {
            const filePath = (window.electron && window.electron.getFilePath) 
                ? window.electron.getFilePath(f) 
                : f.path;
            return {
                id: Math.random().toString(36).substr(2, 9),
                name: f.name,
                fileUrl: URL.createObjectURL(f),
                path: filePath,
                status: 'pending',
                progress: 0,
                statusText: '等待处理'
            };
        });
        this.tasks = [...this.tasks, ...newTasks];
        this.notify();
        this.processNext();
    },

    enqueuePaths(paths) {
        const newTasks = paths.map(p => {
            const name = p.split(/[/\\]/).pop();
            return {
                id: Math.random().toString(36).substr(2, 9),
                name: name,
                fileUrl: `media://local/${encodeURIComponent(p)}`,
                path: p,
                status: 'pending',
                progress: 0,
                statusText: '等待处理'
            };
        });
        this.tasks = [...this.tasks, ...newTasks];
        this.notify();
        this.processNext();
    },

    async processNext() {
        if (this.isProcessing) return;
        const nextTask = this.tasks.find(t => t.status === 'pending');
        if (!nextTask) return;

        this.isProcessing = true;
        this.updateTask(nextTask.id, { status: 'processing', statusText: '准备中...' });
        const t0 = performance.now();

        try {
            const activeModel = MODELS.find(m => m.id === this.activeModelId);
            
            // 1. Model
            let modelBuf = await getCache(activeModel.cacheKey);
            if (!modelBuf) {
                this.updateTask(nextTask.id, { statusText: `下载 ${activeModel.name} 模型...` });
                let resp;
                try { resp = await fetch(activeModel.url); } catch(e) { console.error('fetch error', e); }
                if (!resp || !resp.ok) throw new Error(`模型下载失败`);
                const total = +resp.headers.get('Content-Length') || 0;
                const reader = resp.body.getReader(); const chunks = []; let got = 0;
                while (true) {
                    const {done, value} = await reader.read(); if (done) break;
                    chunks.push(value); got += value.length;
                    if (total) { 
                        const p = Math.round(got/total*100); 
                        this.updateTask(nextTask.id, { progress: p, statusText: `下载模型... ${p}%` });
                    }
                }
                if (total > 0 && got !== total) throw new Error(`网络中断`);
                modelBuf = new Uint8Array(got); let off = 0;
                for (const c of chunks) { modelBuf.set(c, off); off += c.length; }
                await setCache(activeModel.cacheKey, modelBuf);
            }

            // 2. Session
            if (!this.cachedSession) {
                const hasGPU = !!navigator.gpu;
                if (hasGPU && this.useGPU) {
                    try {
                        this.updateTask(nextTask.id, { statusText: "编译 WebGPU 模型..." });
                        const ort = await loadOrtScript(true);
                        this.cachedSession = await ort.InferenceSession.create(modelBuf.buffer.slice(0), {
                            executionProviders: ['webgpu', 'wasm'],
                        });
                        this.backend = 'webgpu';
                    } catch (gpuErr) {
                        console.warn('[BgRemover] WebGPU failed, fallback to WASM:', gpuErr);
                        this.cachedSession = null; this.backend = null;
                    }
                }
                if (!this.cachedSession) {
                    this.updateTask(nextTask.id, { statusText: "初始化 CPU 引擎..." });
                    this.backend = 'wasm-worker';
                    const w = getWasmWorker();
                    const bufCopy = new Uint8Array(modelBuf).buffer;
                    await new Promise((res, rej) => {
                        const h = (e) => {
                            if (e.data.type === 'status') this.updateTask(nextTask.id, { statusText: e.data.text });
                            if (e.data.type === 'ready') { w.removeEventListener('message', h); workerSessionReady = true; res(); }
                            if (e.data.type === 'error') { w.removeEventListener('message', h); rej(new Error(e.data.msg)); }
                        };
                        w.addEventListener('message', h);
                        w.postMessage({type:'init', buf:bufCopy}, [bufCopy]);
                    });
                    this.cachedSession = true;
                }
                this.notify();
            }

            // 3. Preprocess
            this.updateTask(nextTask.id, { statusText: "读取图像..." });
            const img = new Image(); img.crossOrigin = 'anonymous';
            await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = nextTask.fileUrl; });
            const { f: inputData, layout } = preprocess(img);

            // 4. Inference
            let maskData, dims, ms;
            if (this.backend === 'webgpu') {
                this.updateTask(nextTask.id, { statusText: "GPU 加速推理中..." });
                const tensor = new window.ort.Tensor('float32', inputData, [1,3,SIZE,SIZE]);
                const it0 = performance.now();
                const res = await this.cachedSession.run({[this.cachedSession.inputNames[0]]: tensor});
                ms = Math.round(performance.now() - it0);
                const out = res[this.cachedSession.outputNames[0]];
                maskData = out.data; dims = Array.from(out.dims);
            } else {
                this.updateTask(nextTask.id, { statusText: "CPU 推理中..." });
                const w = getWasmWorker();
                const r = await new Promise((res, rej) => {
                    const h = (e) => {
                        if (e.data.type === 'result') { w.removeEventListener('message',h); res(e.data); }
                        if (e.data.type === 'error') { w.removeEventListener('message',h); rej(new Error(e.data.msg)); }
                    };
                    w.addEventListener('message', h);
                    w.postMessage({type:'run', input:inputData, shape:[1,3,SIZE,SIZE]}, [inputData.buffer]);
                });
                maskData = r.mask; dims = r.dims; ms = r.ms;
            }

            // 5. Postprocess
            this.updateTask(nextTask.id, { statusText: "合成透明背景..." });
            const resultUrl = postprocess(maskData, dims[2], dims[3], img, layout, this.alphaThreshold, this.edgeFeather);

            // 6. Save Automatically
            if (nextTask.path && window.electron && window.electron.saveEditedImage) {
                this.updateTask(nextTask.id, { statusText: "正在保存文件..." });
                const pngPath = nextTask.path.replace(/\.[^/.]+$/, "") + ".png";
                await window.electron.saveEditedImage(pngPath, resultUrl, false);
            }

            this.updateTask(nextTask.id, { status: 'done', resultUrl, statusText: '已完成', info: `${this.backend === 'webgpu'?'GPU':'CPU'} · ${(ms/1000).toFixed(1)}s` });

        } catch (err) {
            console.error('[BgRemover]', err);
            this.updateTask(nextTask.id, { status: 'error', error: err.message });
        } finally {
            this.isProcessing = false;
            this.notify();
            // Continue with next task
            setTimeout(() => this.processNext(), 50);
        }
    }
};

// ─── Custom Hook for QueueManager ───
function useQueueManager() {
    const [state, setState] = useState(QueueManager.getState());
    useEffect(() => QueueManager.subscribe(() => setState(QueueManager.getState())), []);
    return state;
}

// ─── Floating Progress Overlay ───
export const FloatingProgressWidget = () => {
    const { tasks, isProcessing } = useQueueManager();
    const activeTasks = tasks.filter(t => t.status === 'processing' || t.status === 'pending');
    
    if (activeTasks.length === 0) return null;

    const currentTask = activeTasks.find(t => t.status === 'processing') || activeTasks[0];
    const totalCount = tasks.length;
    const doneCount = tasks.filter(t => t.status === 'done' || t.status === 'error').length;
    const overallProgress = Math.round((doneCount / totalCount) * 100);

    return el('div', { className: "w-72 bg-neutral-900 border border-neutral-700 shadow-2xl rounded-xl p-3 flex flex-col gap-2 pointer-events-auto text-white backdrop-blur-md bg-opacity-95" },
        el('div', { className: "flex items-center justify-between" },
            el('div', { className: "flex items-center gap-1.5" },
                lucide?.Scissors ? el(lucide.Scissors, { size: 14, className: "text-blue-400" }) : null,
                el('span', { className: "text-sm font-semibold text-neutral-200" }, "Yizi - AI Background Remover")
            ),
            el('span', { className: "text-xs text-neutral-400" }, `${doneCount + 1} / ${totalCount}`)
        ),
        el('div', { className: "flex flex-col gap-1" },
            el('span', { className: "text-xs text-neutral-300 truncate" }, currentTask.name),
            el('span', { className: "text-[10px] text-blue-400" }, currentTask.statusText)
        ),
        el('div', { className: "w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden" },
            el('div', { className: "h-full bg-blue-500 transition-all duration-300", style: { width: `${currentTask.progress || 5}%` } })
        )
    );
};

// ─── Sidebar Plugin Component ───
export const BgRemoverWidget = () => {
    const { tasks, useGPU, backend, alphaThreshold, edgeFeather, activeModelId } = useQueueManager();
    const [isDragging, setIsDragging] = useState(false);

    // --- Drag & Drop Handlers ---
    const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const onDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length) QueueManager.enqueueFiles(files);
    };

    const activeText = backend === 'webgpu' ? 'GPU 工作中' : backend === 'wasm-worker' ? 'CPU 工作中' : '就绪';
    const badgeColor = backend === 'webgpu' ? 'text-green-400' : backend === 'wasm-worker' ? 'text-blue-400' : 'text-neutral-500';

    return el('div', { 
        className: `w-full h-full bg-[#0a0a0a] flex flex-col text-white transition-colors duration-200 ${isDragging ? 'bg-blue-900/20' : ''}`,
        onDragOver, onDragLeave, onDrop
    },
        el('div', { className: "p-4 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900" },
            el('div', { className: "flex items-center gap-2" },
                lucide?.Scissors ? el(lucide.Scissors, { size: 16, className: "text-blue-500" }) : null,
                el('span', { className: "font-medium text-sm text-neutral-200" }, "Yizi - AI Background Remover")
            ),
            el('span', { className: `text-[10px] font-medium flex items-center gap-1 ${badgeColor}` }, 
                lucide?.Activity && backend ? el(lucide.Activity, { size: 10 }) : null,
                activeText
            )
        ),
        
        // 明显的 GPU/CPU 切换区域和模型选择
        el('div', { className: "p-4 border-b border-neutral-800 bg-neutral-900/50 flex flex-col gap-3 shrink-0" },
            // 模型选择器
            el('div', { className: "flex flex-col gap-1.5" },
                el('span', { className: "text-[10px] text-neutral-400 font-medium uppercase tracking-widest" }, "AI Engine (模型)"),
                el('div', { className: "relative" },
                    el('select', {
                        value: activeModelId,
                        onChange: (e) => QueueManager.setActiveModelId(e.target.value),
                        className: "w-full appearance-none bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs rounded-md pl-3 pr-8 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                    },
                        MODELS.map(m => el('option', { key: m.id, value: m.id }, m.name))
                    ),
                    el('div', { className: "absolute inset-y-0 right-2 flex items-center pointer-events-none text-neutral-500" },
                        lucide?.ChevronDown ? el(lucide.ChevronDown, { size: 14 }) : null
                    )
                )
            ),
            
            // 硬件加速
            el('div', { className: "flex flex-col gap-1.5" },
                el('span', { className: "text-[10px] text-neutral-400 font-medium uppercase tracking-widest" }, "Hardware (运算硬件)"),
                el('div', { className: "flex bg-neutral-800 rounded-lg p-1 gap-1" },
                    el('button', {
                        onClick: () => QueueManager.setUseGPU(true),
                        className: `flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${useGPU ? 'bg-blue-500 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`
                    }, "WebGPU 加速"),
                    el('button', {
                        onClick: () => QueueManager.setUseGPU(false),
                        className: `flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${!useGPU ? 'bg-neutral-600 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`
                    }, "CPU 兼容模式")
                )
            ),
            
            // Alpha Threshold Slider
            el('div', { className: "mt-1 flex flex-col gap-1.5" },
                el('div', { className: "flex justify-between items-center" },
                    el('span', { className: "text-[10px] text-neutral-400 font-medium uppercase tracking-widest" }, "Alpha Cutoff (边缘净化)"),
                    el('span', { className: "text-[10px] text-blue-400 font-mono" }, alphaThreshold)
                ),
                el('input', {
                    type: "range", min: "0", max: "200", value: alphaThreshold,
                    onChange: (e) => QueueManager.setAlphaThreshold(Number(e.target.value)),
                    className: "w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                })
            ),
            
            // Edge Feather Slider
            el('div', { className: "mt-1 flex flex-col gap-1.5" },
                el('div', { className: "flex justify-between items-center" },
                    el('span', { className: "text-[10px] text-neutral-400 font-medium uppercase tracking-widest" }, "Edge Feather (边缘羽化)"),
                    el('span', { className: "text-[10px] text-blue-400 font-mono" }, edgeFeather)
                ),
                el('input', {
                    type: "range", min: "0", max: "50", value: edgeFeather,
                    onChange: (e) => QueueManager.setEdgeFeather(Number(e.target.value)),
                    className: "w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                })
            )
        ),
        
        el('div', { className: "flex-1 overflow-y-auto p-3 flex flex-col gap-3 relative" },
            tasks.length === 0 && el('div', { className: "absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none" },
                lucide?.ImagePlus ? el(lucide.ImagePlus, { size: 48, className: "text-neutral-700 mb-4" }) : null,
                el('span', { className: "text-sm text-neutral-400 font-medium mb-1" }, "将左侧图片拖入此处"),
                el('span', { className: "text-xs text-neutral-600" }, "支持批量拖拽 · 自动保存到原目录")
            ),

            tasks.length > 0 && el('div', { className: "flex justify-end mb-1" },
                el('button', { onClick: () => QueueManager.clearAll(), className: "text-xs text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-1" },
                    lucide?.Trash2 ? el(lucide.Trash2, { size: 12 }) : null, "清空列表"
                )
            ),

            tasks.map(task => 
                el('div', { key: task.id, className: "bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex flex-col gap-2 shadow-sm" },
                    el('div', { className: "flex items-start gap-3" },
                        el('div', { className: "w-12 h-12 rounded bg-[#111] overflow-hidden shrink-0 border border-neutral-800 relative", style: task.status === 'done' ? checker : {} },
                            el('img', { src: task.resultUrl || task.fileUrl, className: "w-full h-full object-contain" }),
                            task.status === 'processing' && el('div', { className: "absolute inset-0 bg-black/60 flex items-center justify-center" },
                                lucide?.Loader2 ? el(lucide.Loader2, { size: 16, className: "text-blue-500 animate-spin" }) : null
                            )
                        ),
                        el('div', { className: "flex flex-col flex-1 min-w-0 justify-center h-12" },
                            el('div', { className: "flex justify-between items-center mb-1" },
                                el('span', { className: "text-xs font-medium text-neutral-300 truncate pr-2" }, task.name),
                                task.status === 'done' && lucide?.CheckCircle2 && el(lucide.CheckCircle2, { size: 14, className: "text-green-500 shrink-0" }),
                                task.status === 'error' && lucide?.AlertCircle && el(lucide.AlertCircle, { size: 14, className: "text-red-500 shrink-0" })
                            ),
                            el('div', { className: "flex justify-between items-center" },
                                el('span', { className: `text-[10px] ${task.status === 'error' ? 'text-red-400' : 'text-neutral-500'}` }, 
                                    task.status === 'error' ? '处理失败' : task.statusText
                                ),
                                task.status === 'done' && el('span', { className: "text-[10px] text-blue-400" }, task.info)
                            )
                        )
                    ),
                    task.status === 'processing' && task.progress > 0 && el('div', { className: "w-full h-1 bg-neutral-800 rounded-full overflow-hidden mt-1" },
                        el('div', { className: "h-full bg-blue-500 transition-all", style: { width: `${task.progress}%` } })
                    ),
                    task.error && el('div', { className: "text-[10px] text-red-400 bg-red-400/10 p-1.5 rounded" }, task.error)
                )
            )
        )
    );
};
