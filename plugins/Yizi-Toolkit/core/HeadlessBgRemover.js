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
    
    if (edgeFeather > 0) rctx.filter = `blur(${edgeFeather}px)`;
    rctx.drawImage(mc, layout.dx, layout.dy, layout.dw, layout.dh, 0, 0, ow, oh);
    rctx.filter = 'none';
    
    const rd = rctx.getImageData(0, 0, ow, oh);

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

export class HeadlessBgRemover {
    constructor() {
        this.cachedSession = null;
        this.backend = null;
        this.isProcessing = false;
        this.activeModelId = null;
    }

    async run(imagePath, settings) {
        if (this.isProcessing) {
            window.YiziAPI?.showToast?.('当前有抠图任务正在进行，请稍候...', 'warning');
            return;
        }
        
        this.isProcessing = true;
        let toastId = window.YiziAPI?.showToast?.('准备智能抠图...', 'loading', 0);
        
        try {
            const activeModelId = settings?.bgActiveModelId || 'rmbg-1.4';
            const useGPU = settings?.bgUseGPU !== false;
            const alphaThreshold = Number(settings?.bgAlphaThreshold) || 0;
            const edgeFeather = Number(settings?.bgEdgeFeather) || 0;
            const activeModel = MODELS.find(m => m.id === activeModelId);

            // 1. Model
            let modelBuf = await getCache(activeModel.cacheKey);
            if (!modelBuf) {
                if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, `首次使用，正在下载 ${activeModel.name} 模型...`, 'loading');
                let resp;
                try { resp = await fetch(activeModel.url); } catch(e) { console.error('fetch error', e); }
                if (!resp || !resp.ok) throw new Error(`模型下载失败`);
                const total = +resp.headers.get('Content-Length') || 0;
                const reader = resp.body.getReader(); const chunks = []; let got = 0;
                while (true) {
                    const {done, value} = await reader.read(); if (done) break;
                    chunks.push(value); got += value.length;
                    if (total && toastId !== undefined) { 
                        const p = Math.round(got/total*100); 
                        window.YiziAPI?.updateToast?.(toastId, `下载模型... ${p}%`, 'loading');
                    }
                }
                if (total > 0 && got !== total) throw new Error(`网络中断`);
                modelBuf = new Uint8Array(got); let off = 0;
                for (const c of chunks) { modelBuf.set(c, off); off += c.length; }
                await setCache(activeModel.cacheKey, modelBuf);
            }

            // 2. Session
            if (!this.cachedSession || this.activeModelId !== activeModelId) {
                this.activeModelId = activeModelId;
                this.cachedSession = null;
                const hasGPU = !!navigator.gpu;
                if (hasGPU && useGPU) {
                    try {
                        if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "编译 WebGPU 模型...", 'loading');
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
                    if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "初始化 CPU 引擎...", 'loading');
                    this.backend = 'wasm-worker';
                    const w = getWasmWorker();
                    const bufCopy = new Uint8Array(modelBuf).buffer;
                    await new Promise((res, rej) => {
                        const h = (e) => {
                            if (e.data.type === 'status' && toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, e.data.text, 'loading');
                            if (e.data.type === 'ready') { w.removeEventListener('message', h); workerSessionReady = true; res(); }
                            if (e.data.type === 'error') { w.removeEventListener('message', h); rej(new Error(e.data.msg)); }
                        };
                        w.addEventListener('message', h);
                        w.postMessage({type:'init', buf:bufCopy}, [bufCopy]);
                    });
                    this.cachedSession = true;
                }
            }

            // 3. Preprocess
            if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "读取图像...", 'loading');
            const imgUrl = imagePath.startsWith('media://') ? imagePath : `media://local/${encodeURIComponent(imagePath)}`;
            const img = new Image(); img.crossOrigin = 'anonymous';
            await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = imgUrl; });
            const { f: inputData, layout } = preprocess(img);

            // 4. Inference
            let maskData, dims, ms;
            if (this.backend === 'webgpu') {
                if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "GPU 推理中...", 'loading');
                const tensor = new window.ort.Tensor('float32', inputData, [1,3,SIZE,SIZE]);
                const it0 = performance.now();
                const res = await this.cachedSession.run({[this.cachedSession.inputNames[0]]: tensor});
                ms = Math.round(performance.now() - it0);
                const out = res[this.cachedSession.outputNames[0]];
                maskData = out.data; dims = Array.from(out.dims);
            } else {
                if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "CPU 推理中...", 'loading');
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
            if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "合成透明背景...", 'loading');
            const resultUrl = postprocess(maskData, dims[2], dims[3], img, layout, alphaThreshold, edgeFeather);

            // 6. Save Automatically
            if (window.electron && window.electron.saveEditedImage) {
                if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "正在保存文件...", 'loading');
                let pngPath = imagePath.replace(/\.[^/.]+$/, "") + "_nobg.png";
                await window.electron.saveEditedImage(pngPath, resultUrl, false);
                window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
                if(toastId !== undefined) window.YiziAPI?.closeToast?.(toastId);
                toastId = undefined;
                window.YiziAPI?.showToast?.('抠图完成，已保存为 _nobg.png', 'success');
            } else {
                if(toastId !== undefined) window.YiziAPI?.closeToast?.(toastId);
                toastId = undefined;
                window.YiziAPI?.showToast?.('运行环境不支持直接保存', 'error');
            }
        } catch (err) {
            console.error('[HeadlessBgRemover]', err);
            if(toastId !== undefined) window.YiziAPI?.closeToast?.(toastId);
            toastId = undefined;
            window.YiziAPI?.showToast?.(`抠图失败: ${err.message}`, 'error');
        } finally {
            this.isProcessing = false;
            if(toastId !== undefined) window.YiziAPI?.closeToast?.(toastId);
        }
    }
}
