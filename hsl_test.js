const applySelectiveSat = (data, selSat) => {
    const mods = [selSat.reds/100, selSat.yellows/100, selSat.greens/100, selSat.cyans/100, selSat.blues/100, selSat.magentas/100];
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 127.5 ? d / (510 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        if (s > 0) {
            const region = h * 6;
            const idx1 = Math.floor(region) % 6;
            const idx2 = (idx1 + 1) % 6;
            const fraction = region - Math.floor(region);
            
            // To blend smoothly, we can use fraction.
            // When h is exactly red (h=0, region=0), fraction=0, mod = mod[0] (red)
            // When h is halfway to yellow (h=30 deg, region=0.5), fraction=0.5, mod is mixed.
            const sMod = mods[idx1] * (1 - fraction) + mods[idx2] * fraction;
            if (sMod !== 0) {
                let newS = sMod > 0 ? s + (1 - s) * sMod : s + s * sMod;
                const lNorm = l / 255;
                const q = lNorm < 0.5 ? lNorm * (1 + newS) : lNorm + newS - lNorm * newS;
                const p = 2 * lNorm - q;
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                data[i] = Math.round(hue2rgb(p, q, h + 1/3) * 255);
                data[i+1] = Math.round(hue2rgb(p, q, h) * 255);
                data[i+2] = Math.round(hue2rgb(p, q, h - 1/3) * 255);
            }
        }
    }
};
const data = new Uint8Array([255, 0, 0, 255]);
applySelectiveSat(data, {reds: -100, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0});
console.log(data);
