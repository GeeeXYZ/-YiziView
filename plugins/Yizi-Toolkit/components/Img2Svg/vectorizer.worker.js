// Web Worker for image vectorization (img2svg)
self.onmessage = async function(e) {
    const { type, engine, imgData, options } = e.data;
    if (type === 'trace') {
        try {
            if (engine === 'potrace') {
                // Potrace tracing for monochrome B&W curves
                importScripts('potrace.js');
                const potrace = self['potrace-plus'];
                if (!potrace) {
                    throw new Error('Failed to load Potrace engine');
                }

                const w = imgData.width;
                const h = imgData.height;
                const bmp = new potrace.Bitmap(w, h);

                // Threshold parameter: 0 to 255
                const threshold = options.threshold !== undefined ? options.threshold : 128;
                const invert = !!options.invert;

                // Binarize the ImageData into Potrace's binary grid (1 = black, 0 = white)
                for (let i = 0; i < bmp.size; i++) {
                    const r = imgData.data[i * 4];
                    const g = imgData.data[i * 4 + 1];
                    const b = imgData.data[i * 4 + 2];
                    const a = imgData.data[i * 4 + 3];

                    // Grayscale intensity calculation
                    const intensity = (r * 0.299 + g * 0.587 + b * 0.114);
                    // Transparent pixels (low alpha) are treated as white (0)
                    let val = (a < 50 || intensity > threshold) ? 0 : 1;
                    if (invert) val = 1 - val;

                    bmp.data[i] = val;
                }

                // Configuration matching Potrace algorithms
                const params = {
                    turnpolicy: options.turnpolicy || 'majority',
                    turdsize: options.turdsize !== undefined ? options.turdsize : 2, // Noise filter
                    optcurve: options.optcurve !== false,
                    alphamax: options.alphamax !== undefined ? options.alphamax : 1, // Corners threshold
                    opttolerance: options.opttolerance !== undefined ? options.opttolerance : 0.2, // Fitting
                    getPolygon: false
                };

                const traced = potrace.potraceGetPathList(bmp, params);

                // Export to beautiful optimized SVG paths
                const svgData = potrace.getSVGData({
                    pathList: traced.pathList,
                    polygons: traced.polygons,
                    width: w,
                    height: h,
                    scale: 1,
                    scaleAdjust: 1,
                    toRelative: true,
                    toShorthands: true,
                    optimize: true,
                    decimals: 2
                });

                // Return final SVG
                self.postMessage({ type: 'success', svg: svgData.svg });

            } else {
                // ImageTracerJS for multi-color tracing
                importScripts('imagetracer.js');
                const tracer = self.ImageTracer;
                if (!tracer) {
                    throw new Error('Failed to load ImageTracer engine');
                }

                // Options mapped to Illustrator-like sliders
                const tracerOpts = {
                    corsenabled: false,
                    ltres: options.ltres !== undefined ? options.ltres : 1, // Curve fitting
                    qtres: options.qtres !== undefined ? options.qtres : 1, // Spline fitting
                    pathomit: options.pathomit !== undefined ? options.pathomit : 8, // Noise reduction
                    rightangleenhance: options.rightangleenhance !== false,
                    colorsampling: 2, // Deterministic sampling
                    numberofcolors: options.numberofcolors !== undefined ? options.numberofcolors : 8, // Color count
                    colorquantcycles: 3,
                    strokewidth: 0, // Solid shapes fill (no strokes)
                    scale: 1,
                    roundcoords: 2,
                    viewbox: true
                };

                // Tracing step
                const tracedData = tracer.imagedataToTracedata(imgData, tracerOpts);

                // Option: Ignore White background layers
                if (options.ignoreWhite) {
                    const filteredLayers = [];
                    const filteredPalette = [];
                    for (let i = 0; i < tracedData.layers.length; i++) {
                        const color = tracedData.palette[i];
                        // If color is extremely close to pure white, skip it
                        if (color.r > 245 && color.g > 245 && color.b > 245) {
                            continue;
                        }
                        filteredLayers.push(tracedData.layers[i]);
                        filteredPalette.push(color);
                    }
                    tracedData.layers = filteredLayers;
                    tracedData.palette = filteredPalette;
                }

                // Render out SVG markup
                const svgContent = tracer.getsvgstring(tracedData, tracerOpts);
                self.postMessage({ type: 'success', svg: svgContent });
            }
        } catch (err) {
            self.postMessage({ type: 'error', error: err.stack || err.message || String(err) });
        }
    }
};
