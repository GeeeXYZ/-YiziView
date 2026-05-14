// ─── InSPyReNet Inference Web Worker ───
// 在独立线程中运行 ONNX 推理，不阻塞主线程 UI

const ORT_CDN = 'https://unpkg.com/onnxruntime-web@1.17.3/dist';
let session = null;

// Worker 中加载 ORT（使用 importScripts）
function loadOrt() {
    if (typeof ort !== 'undefined') return;
    importScripts(`${ORT_CDN}/ort.min.js`);
    ort.env.wasm.wasmPaths = `${ORT_CDN}/`;
}

self.onmessage = async function (e) {
    const { type, modelBuffer, inputData, inputShape } = e.data;

    try {
        if (type === 'init') {
            // ── 初始化：加载 ORT + 编译 Session ──
            self.postMessage({ type: 'status', text: '加载推理引擎...' });
            loadOrt();

            self.postMessage({ type: 'status', text: '编译 WASM 推理模型（仅首次）...' });
            const t0 = performance.now();
            session = await ort.InferenceSession.create(modelBuffer, {
                executionProviders: ['wasm'],
            });
            const t1 = performance.now();
            self.postMessage({ type: 'ready', compileTime: Math.round(t1 - t0) });
        }

        if (type === 'run') {
            if (!session) {
                throw new Error('Session not initialized, call init first');
            }
            self.postMessage({ type: 'status', text: 'AI 推理中...' });
            const inputTensor = new ort.Tensor('float32', inputData, inputShape);
            const inputName = session.inputNames[0];
            const feeds = { [inputName]: inputTensor };

            const t0 = performance.now();
            const results = await session.run(feeds);
            const t1 = performance.now();

            const outputName = session.outputNames[0];
            const outputTensor = results[outputName];

            // 把结果传回主线程（transferable 避免拷贝）
            const maskData = new Float32Array(outputTensor.data);
            const dims = Array.from(outputTensor.dims);

            self.postMessage({
                type: 'result',
                maskData: maskData,
                dims: dims,
                inferenceTime: Math.round(t1 - t0),
            }, [maskData.buffer]); // transfer ownership
        }
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message || String(err) });
    }
};
