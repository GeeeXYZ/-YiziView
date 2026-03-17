export function createCurveLUT(points) {
    if (!points || points.length < 2) {
        const lut = new Uint8Array(256);
        for (let i = 0; i < 256; i++) lut[i] = i;
        return lut;
    }

    // Sort points by x just to be sure
    const sorted = [...points].sort((a, b) => a.x - b.x);

    const xs = sorted.map(p => p.x);
    const ys = sorted.map(p => p.y);
    const n = sorted.length;

    // Monotone cubic interpolation (Fritsch-Carlson algorithm)
    const secants = new Float32Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
        secants[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
    }

    const m = new Float32Array(n);
    m[0] = secants[0];
    for (let i = 1; i < n - 1; i++) {
        if (secants[i - 1] === 0 && secants[i] === 0) {
            m[i] = 0;
        } else {
            m[i] = 2 / (1 / secants[i - 1] + 1 / secants[i]);
            // Ensure monotonicity
            if (m[i] * secants[i - 1] < 0 || m[i] * secants[i] < 0) {
                m[i] = 0;
            }
        }
    }
    m[n - 1] = secants[n - 2];

    const lut = new Uint8Array(256);
    let pointIdx = 0;

    for (let x = 0; x < 256; x++) {
        if (x <= xs[0]) {
            lut[x] = Math.max(0, Math.min(255, ys[0]));
            continue;
        }
        if (x >= xs[n - 1]) {
            lut[x] = Math.max(0, Math.min(255, ys[n - 1]));
            continue;
        }

        while (pointIdx < n - 1 && x > xs[pointIdx + 1]) {
            pointIdx++;
        }

        const xl = xs[pointIdx];
        const xr = xs[pointIdx + 1];
        const yl = ys[pointIdx];
        const yr = ys[pointIdx + 1];

        const h = xr - xl;
        const t = (x - xl) / h;

        const h00 = 2 * t * t * t - 3 * t * t + 1;
        const h10 = t * t * t - 2 * t * t + t;
        const h01 = -2 * t * t * t + 3 * t * t;
        const h11 = t * t * t - t * t;

        let y = h00 * yl + h10 * h * m[pointIdx] + h01 * yr + h11 * h * m[pointIdx + 1];
        
        lut[x] = Math.max(0, Math.min(255, Math.round(y)));
    }

    return lut;
}
