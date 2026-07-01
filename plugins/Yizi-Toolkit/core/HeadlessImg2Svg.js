export class HeadlessImg2Svg {
    constructor() {
        this.worker = null;
        this.isProcessing = false;
        this.initWorker();
    }

    initWorker() {
        if (!this.worker) {
            try {
                this.worker = new Worker('yiziview-plugin://Yizi-Toolkit/components/Img2Svg/vectorizer.worker.js');
                this.worker.onerror = (err) => {
                    console.error('[HeadlessImg2Svg] Vectorizer Worker error:', err);
                };
            } catch (err) {
                console.error('[HeadlessImg2Svg] Failed to init worker:', err);
            }
        }
    }

    async run(imagePath, mode, settings) {
        if (this.isProcessing) {
            window.YiziAPI?.showToast?.('当前有转换任务正在进行，请稍候...', 'warning');
            return;
        }

        if (!this.worker) this.initWorker();
        if (!this.worker) {
            window.YiziAPI?.showToast?.('矢量化引擎初始化失败', 'error');
            return;
        }

        this.isProcessing = true;
        let toastId = window.YiziAPI?.showToast?.('准备转换为矢量图...', 'loading', 0);

        try {
            // Apply Presets
            let engine = 'imagetracer';
            let numberOfColors = 8, noiseThreshold = 8, bwThreshold = 128, fitting = 1.0, ignoreWhite = true, invert = false;

            if (mode === 'logo') {
                engine = 'imagetracer';
                numberOfColors = 8;
                noiseThreshold = 8;
                fitting = 1.0;
                ignoreWhite = true;
            } else if (mode === 'sketch') {
                engine = 'potrace';
                bwThreshold = 128;
                noiseThreshold = 2;
                fitting = 0.2;
                invert = false;
            } else if (mode === 'detailed') {
                engine = 'imagetracer';
                numberOfColors = 24;
                noiseThreshold = 2;
                fitting = 0.5;
                ignoreWhite = false;
            }

            // Load Image
            if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "读取图像...", 'loading');
            const imgUrl = imagePath.startsWith('media://') ? imagePath : `media://local/${encodeURIComponent(imagePath)}`;
            
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('图片读取失败，请检查文件格式'));
                img.src = imgUrl;
            });

            // Draw to Canvas
            if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "提取像素特征...", 'loading');
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Construct Options
            const options = {
                engine,
                threshold: bwThreshold,
                invert,
                turdsize: noiseThreshold,
                pathomit: noiseThreshold,
                ignoreWhite,
                numberofcolors: numberOfColors,
                scale: 1,
                colorsampling: 1,
                mincolorratio: 0,
                colorquantcycles: 3,
                blurradius: 0,
                blurdelta: 20,
                qtres: fitting,
                qtanfac: 0.5,
                pal: [] // auto palette
            };

            if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "执行矢量化计算 (SVG)...", 'loading');

            const svgString = await new Promise((resolve, reject) => {
                const handler = (e) => {
                    const { type, svg, error } = e.data;
                    this.worker.removeEventListener('message', handler);
                    if (type === 'success') {
                        resolve(svg);
                    } else {
                        reject(new Error(error || '计算出错'));
                    }
                };
                this.worker.addEventListener('message', handler);
                
                // We must handle stringifying options exactly as the worker expects
                this.worker.postMessage({
                    imgData: imgData,
                    options: JSON.stringify(options)
                });
            });

            if (window.electron && window.electron.saveEditedFile) {
                if(toastId !== undefined) window.YiziAPI?.updateToast?.(toastId, "保存文件...", 'loading');
                const svgPath = imagePath.replace(/\.[^/.]+$/, "") + ".vector.svg";
                // Convert SVG string to buffer or just write it as string
                // Assuming saveEditedFile takes buffer or string. Or we can create a Blob.
                const enc = new TextEncoder();
                const buffer = enc.encode(svgString);
                
                await window.electron.saveEditedFile(svgPath, buffer);
                window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
                
                if(toastId !== undefined) window.YiziAPI?.closeToast?.(toastId);
                toastId = undefined;
                window.YiziAPI?.showToast?.('矢量化完成，已保存为 .vector.svg', 'success');
            } else {
                if(toastId !== undefined) window.YiziAPI?.closeToast?.(toastId);
                toastId = undefined;
                window.YiziAPI?.showToast?.('运行环境不支持直接保存文件', 'error');
            }

        } catch (err) {
            console.error('[HeadlessImg2Svg]', err);
            if(toastId !== undefined) window.YiziAPI?.closeToast?.(toastId);
            toastId = undefined;
            window.YiziAPI?.showToast?.(`矢量化失败: ${err.message}`, 'error');
        } finally {
            this.isProcessing = false;
        }
    }
}
