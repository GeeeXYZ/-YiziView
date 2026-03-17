function shiftVec(optsObj, intensityLimit = 0.16) {
    if (!optsObj) return [0, 0, 0];
    const {x, y} = optsObj;
    const d = Math.min(1.0, Math.sqrt(x*x + y*y));
    if (d === 0) return [0, 0, 0];
    let h = Math.atan2(y, x) / (Math.PI * 2);
    if (h < 0) h += 1;
    const hue2rgb = (p, q, t) => {
        if(t < 0) t += 1;
        if(t > 1) t -= 1;
        if(t < 1/6) return p + (q - p) * 6 * t;
        if(t < 1/2) return q;
        if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    const r = hue2rgb(0, 1, h + 1/3);
    const g = hue2rgb(0, 1, h);
    const b = hue2rgb(0, 1, h - 1/3);
    return [(r - 0.5) * 2 * d * intensityLimit, (g - 0.5) * 2 * d * intensityLimit, (b - 0.5) * 2 * d * intensityLimit];
}

export class SelectiveWebGLFilter {
    constructor(maxWidth = 4096, maxHeight = 4096) {
        this.canvas = document.createElement('canvas');
        this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true, alpha: true }) || 
                  this.canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true, alpha: true });
        if (!this.gl) {
             throw new Error("WebGL is not supported by your browser");
        }
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;

        this.program = this.createProgram(this.getVertexShader(), this.getFragmentShader());
        
        this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");
        this.texCoordLocation = this.gl.getAttribLocation(this.program, "a_texCoord");
        
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0,
        ]), this.gl.STATIC_DRAW);

        this.texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ]), this.gl.STATIC_DRAW);

        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        
        this.locations = {
            u_image: this.gl.getUniformLocation(this.program, "u_image"),
            u_mods: this.gl.getUniformLocation(this.program, "u_mods"),
            u_brightness: this.gl.getUniformLocation(this.program, "u_brightness"),
            u_contrast: this.gl.getUniformLocation(this.program, "u_contrast"),
            u_saturation: this.gl.getUniformLocation(this.program, "u_saturation"),
            u_hue: this.gl.getUniformLocation(this.program, "u_hue"),
            u_shadows: this.gl.getUniformLocation(this.program, "u_shadows"),
            u_midtones: this.gl.getUniformLocation(this.program, "u_midtones"),
            u_highlights: this.gl.getUniformLocation(this.program, "u_highlights"),
        };
        
        this.gl.useProgram(this.program);
    }

    createProgram(vsSource, fsSource) {
        const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, fsSource);
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error(this.gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    loadShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error("Shader Err: ", this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    getVertexShader() {
        return `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
    }

    getFragmentShader() {
        return `
            precision mediump float;
            uniform sampler2D u_image;
            uniform float u_mods[6];
            uniform float u_brightness;
            uniform float u_contrast;
            uniform float u_saturation;
            uniform float u_hue;
            uniform vec3 u_shadows;
            uniform vec3 u_midtones;
            uniform vec3 u_highlights;
            varying vec2 v_texCoord;

            vec3 rgb2hsl(vec3 c) {
                float mx = max(c.r, max(c.g, c.b));
                float mn = min(c.r, min(c.g, c.b));
                float d = mx - mn;
                vec3 hsl = vec3(0.0, 0.0, (mx + mn) / 2.0);
                if (d > 0.0) {
                    hsl.y = hsl.z > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
                    if (c.r == mx) hsl.x = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
                    else if (c.g == mx) hsl.x = (c.b - c.r) / d + 2.0;
                    else hsl.x = (c.r - c.g) / d + 4.0;
                    hsl.x /= 6.0;
                }
                return hsl;
            }

            float hue2rgb(float p, float q, float t) {
                if (t < 0.0) t += 1.0;
                if (t > 1.0) t -= 1.0;
                if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
                if (t < 1.0/2.0) return q;
                if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
                return p;
            }

            vec3 hsl2rgb(vec3 c) {
                if (c.y == 0.0) return vec3(c.z);
                float q = c.z < 0.5 ? c.z * (1.0 + c.y) : c.z + c.y - c.z * c.y;
                float p = 2.0 * c.z - q;
                vec3 rgb;
                rgb.r = hue2rgb(p, q, c.x + 1.0/3.0);
                rgb.g = hue2rgb(p, q, c.x);
                rgb.b = hue2rgb(p, q, c.x - 1.0/3.0);
                return vec3(rgb.r, rgb.g, rgb.b);
            }

            float getMod(float idx) {
                if (idx < 0.5) return u_mods[0];
                if (idx < 1.5) return u_mods[1];
                if (idx < 2.5) return u_mods[2];
                if (idx < 3.5) return u_mods[3];
                if (idx < 4.5) return u_mods[4];
                return u_mods[5];
            }

            void main() {
                vec4 color = texture2D(u_image, v_texCoord);
                
                color.rgb *= u_brightness;
                color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
                color.rgb = clamp(color.rgb, 0.0, 1.0);
                
                vec3 hsl = rgb2hsl(color.rgb);
                
                if (hsl.y > 0.0) {
                    float hueRegion = fract(hsl.x) * 6.0; 
                    float idx = floor(hueRegion);
                    float f = hueRegion - idx;
                    
                    float m1 = getMod(idx);
                    float m2 = getMod(mod(idx + 1.0, 6.0));
                    
                    float sMod = mix(m1, m2, f);
                    if (sMod != 0.0) {
                        hsl.y = sMod > 0.0 ? hsl.y + (1.0 - hsl.y) * sMod : hsl.y + hsl.y * sMod;
                        hsl.y = clamp(hsl.y, 0.0, 1.0);
                    }
                }
                color.rgb = hsl2rgb(hsl);
                
                if (u_saturation != 1.0) {
                    float gray = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
                    color.rgb = mix(vec3(gray), color.rgb, u_saturation);
                    color.rgb = clamp(color.rgb, 0.0, 1.0);
                }
                
                if (u_hue != 0.0) {
                    hsl = rgb2hsl(color.rgb);
                    hsl.x = fract(hsl.x + u_hue / 360.0);
                    color.rgb = hsl2rgb(hsl);
                }
                
                float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
                float shadowW = smoothstep(0.4, 0.0, luma);
                float highlightW = smoothstep(0.6, 1.0, luma);
                float midtoneW = clamp(1.0 - shadowW - highlightW, 0.0, 1.0);
                
                color.rgb += (u_shadows * shadowW) + (u_midtones * midtoneW) + (u_highlights * highlightW);
                color.rgb = clamp(color.rgb, 0.0, 1.0);
                
                gl_FragColor = vec4(color.rgb, color.a);
            }
        `;
    }

    render(imageElement, options) {
        if (!imageElement.naturalWidth || !imageElement.naturalHeight) return null;
        
        let w = imageElement.naturalWidth;
        let h = imageElement.naturalHeight;
        
        let scale = 1;
        if (w > this.maxWidth || h > this.maxHeight) {
            scale = Math.min(this.maxWidth / w, this.maxHeight / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
        }

        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);

        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageElement);

        this.gl.useProgram(this.program);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.enableVertexAttribArray(this.texCoordLocation);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

        const b = (options.brightness !== undefined ? options.brightness : 100) / 100;
        const c = (options.contrast !== undefined ? options.contrast : 100) / 100;
        const s = (options.saturation !== undefined ? options.saturation : 100) / 100;
        const h_deg = options.hue !== undefined ? options.hue : 0;
        
        const selective = options.selectiveSat || { reds: 0, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0 };
        const mods = new Float32Array([
            selective.reds/100, selective.yellows/100, selective.greens/100, 
            selective.cyans/100, selective.blues/100, selective.magentas/100
        ]);

        this.gl.uniform1f(this.locations.u_brightness, b);
        this.gl.uniform1f(this.locations.u_contrast, c);
        this.gl.uniform1f(this.locations.u_saturation, s);
        this.gl.uniform1f(this.locations.u_hue, h_deg);
        this.gl.uniform1fv(this.locations.u_mods, mods);

        const intensityPercent = options.gradingIntensity !== undefined ? Number(options.gradingIntensity) : 20;
        const intensityLimit = (intensityPercent / 100) * 0.8;

        this.gl.uniform3fv(this.locations.u_shadows, shiftVec(options.gradingShadows, intensityLimit));
        this.gl.uniform3fv(this.locations.u_midtones, shiftVec(options.gradingMidtones, intensityLimit));
        this.gl.uniform3fv(this.locations.u_highlights, shiftVec(options.gradingHighlights, intensityLimit));

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        return this.canvas;
    }
}
