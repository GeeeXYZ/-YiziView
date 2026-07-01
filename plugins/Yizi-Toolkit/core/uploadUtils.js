export const uploadLocalToComfyUI = async (serverUrl, localPath) => {
    try {
        const safePath = localPath.startsWith('media://') ? localPath : `media://local/${encodeURIComponent(localPath)}`;
        const fileRes = await fetch(safePath);
        const blob = await fileRes.blob();
        
        const formData = new FormData();
        formData.append('image', blob, `plugin_upload_${Date.now()}.png`);
        formData.append('type', 'input');
        formData.append('subfolder', 'aitoolkit_uploads');
        formData.append('overwrite', 'true');

        const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
        const res = await fetch(`${baseUrl}/upload/image`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) throw new Error("Upload failed: " + res.status);
        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch(e) {
            throw new Error(`图片上传失败，ComfyUI 接口返回了非 JSON 内容 (可能配置了错误的地址或反代拦截了请求): ${text.substring(0, 50)}...`);
        }
        // Returns { name: "...", subfolder: "...", type: "input" }
        return {
            filename: json.name,
            subfolder: json.subfolder,
            type: json.type,
            viewUrl: `${baseUrl}/view?filename=${encodeURIComponent(json.name)}&subfolder=${encodeURIComponent(json.subfolder)}&type=${json.type}`
        };
    } catch (e) {
        console.error("uploadLocalToComfyUI error:", e);
        throw e;
    }
};

export const uploadLocalToOSS = async (localPath, ossConfig) => {
    // Simulated OSS fallback logic matching the user's old Vue code
    const safePath = localPath.startsWith('media://') ? localPath : `media://local/${encodeURIComponent(localPath)}`;
    const fileRes = await fetch(safePath);
    const blob = await fileRes.blob();

    const stsEndpoint = ossConfig.url.replace(/\/$/, '') + '/comfyui/order/sts';
    const res = await fetch(stsEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ossConfig.token}`
        },
        body: JSON.stringify({ order_id: "plugin_upload.temp" })
    });
    if (!res.ok) throw new Error("OSS STS Error");
    const json = await res.json();
    const stsData = json.result || json.data || json;

    const OSS = window.OSS; // Must have loaded ali-oss script or we import it dynamically
    if (!OSS) throw new Error("ali-oss library not found");

    const client = new OSS({
        region: stsData.region || 'oss-cn-shenzhen',
        accessKeyId: stsData.accessKeyId || stsData.Credentials?.AccessKeyId,
        accessKeySecret: stsData.accessKeySecret || stsData.Credentials?.AccessKeySecret,
        stsToken: stsData.securityToken || stsData.Credentials?.SecurityToken,
        bucket: stsData.bucket || stsData.bucketName || 'wx-clothes',
        secure: true
    });

    const objectName = `delivery_imgs/plugin_upload/temp/img_${Date.now()}_${Math.random().toString(36).substring(2,8)}.png`;
    const uploadRes = await client.put(objectName, blob);
    return uploadRes.url.replace(/^http:/, 'https:');
};
