import { React, el, FolderOpen, Play, Check, RefreshCw, ImagePlus, ChevronDown, Trash2 } from '../../core/globals.js';
import { uploadLocalToComfyUI, uploadLocalToOSS } from '../../core/uploadUtils.js';
import { PromptModule, addPromptToHistory } from './PromptModule.js';
import { getTheme } from '../theme.js';

export const ComfyUITab = ({ settings, setSettings }) => {
    const theme = getTheme(settings?.theme || 'dark');
    const [workflows, setWorkflows] = React.useState([]);
    const [selectedWf, setSelectedWf] = React.useState(null);
    const [imageSlots, setImageSlots] = React.useState([]);
    const [customPrompt, setCustomPrompt] = React.useState("");
    const [customSize, setCustomSize] = React.useState("");
    const [isExecuting, setIsExecuting] = React.useState(false);
    const [execStatus, setExecStatus] = React.useState("");
    const [results, setResults] = React.useState([]);

    React.useEffect(() => {
        if (!settings.workflowPath || !window.electron?.readWorkflowDir) return;
        
        const loadWorkflows = async () => {
            try {
                const files = await window.electron.readWorkflowDir(settings.workflowPath);
                if (!files || !files.length) return;
                
                const newWorkflows = [];
                for (const filePath of files) {
                    if (filePath.toLowerCase().endsWith('.json')) {
                        try {
                            const safePath = filePath.startsWith('media://') ? filePath : `media://local/${encodeURIComponent(filePath)}`;
                            const res = await fetch(safePath);
                            const text = await res.text();
                            const json = JSON.parse(text);
                            const fileName = filePath.substring(Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1);
                            
                            newWorkflows.push({
                                name: fileName.replace('.json', ''),
                                fileName: fileName,
                                json: json,
                                nodeCount: Object.keys(json).length
                            });
                        } catch(e) {
                            console.error("Failed to parse JSON workflow", filePath, e);
                        }
                    }
                }
                setWorkflows(newWorkflows);
            } catch (err) {
                console.error("Failed to auto-load workflows", err);
            }
        };
        
        loadWorkflows();
    }, [settings.workflowPath]);

    const activeServer = settings.servers.find(s => s.id === settings.activeServerId);

    const handleFolderSelect = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const newWorkflows = [];
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (f.name.toLowerCase().endsWith('.json')) {
                try {
                    const text = await f.text();
                    const json = JSON.parse(text);
                    newWorkflows.push({
                        name: f.name.replace('.json', ''),
                        fileName: f.name,
                        json: json,
                        nodeCount: Object.keys(json).length
                    });
                } catch(e) {
                    console.error("Failed to parse JSON workflow", f.name, e);
                }
            }
        }
        setWorkflows(newWorkflows);
        // Save folder path if possible
        if (files[0].path) {
            const dir = files[0].path.substring(0, Math.max(files[0].path.lastIndexOf('/'), files[0].path.lastIndexOf('\\')));
            setSettings({ workflowPath: dir });
        }
    };

    const selectWorkflow = (wf) => {
        setSelectedWf(wf);
        // Parse FetchImageByURL slots
        const slots = [];
        for (const key in wf.json) {
            if (wf.json[key]?.class_type === 'FetchImageByURL') {
                slots.push({
                    nodeId: key,
                    title: wf.json[key]._meta?.title || `图片输入 ${key}`,
                    localPath: null,
                    previewUrl: null
                });
            }
        }
        setImageSlots(slots);
        setResults([]);
    };

    const handleSlotDrop = (e, slotId) => {
        e.preventDefault();
        const dataPath = e.dataTransfer.getData('text/plain');
        if (dataPath && dataPath.includes('.')) {
            assignSlot(slotId, dataPath);
            return;
        }
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            const path = window.electron?.getFilePath ? window.electron.getFilePath(files[0]) : files[0].path;
            assignSlot(slotId, path);
        }
    };

    const assignSlot = (slotId, path) => {
        setImageSlots(prev => prev.map(s => s.nodeId === slotId ? {
            ...s,
            localPath: path,
            previewUrl: path.startsWith('media://') ? path : `media://local/${encodeURIComponent(path)}`
        } : s));
    };

    const executeWorkflow = async () => {
        if (!activeServer) return alert("请在设置中选择或添加 ComfyUI 服务器");
        const missing = imageSlots.find(s => !s.localPath);
        if (missing) return alert(`请填满所有图片插槽 (${missing.title})`);

        setIsExecuting(true);
        setExecStatus("准备上传图片...");
        try {
            // 1. Upload Images
            const payloadJson = JSON.parse(JSON.stringify(selectedWf.json));
            for (let i = 0; i < imageSlots.length; i++) {
                const slot = imageSlots[i];
                let finalUrl = '';
                if (settings.comfyUploadStrategy === 'direct') {
                    setExecStatus(`上传图片到 ComfyUI... (${i+1}/${imageSlots.length})`);
                    const uploadData = await uploadLocalToComfyUI(activeServer.url, slot.localPath);
                    finalUrl = uploadData.viewUrl;
                } else {
                    setExecStatus(`经由 OSS 中转图片... (${i+1}/${imageSlots.length})`);
                    finalUrl = await uploadLocalToOSS(slot.localPath, { url: settings.ossApiUrl, token: settings.ossApiToken });
                }
                // Update Node
                if (payloadJson[slot.nodeId]) {
                    if (!payloadJson[slot.nodeId].inputs) payloadJson[slot.nodeId].inputs = {};
                    payloadJson[slot.nodeId].inputs.image_url = finalUrl;
                    if (customSize) payloadJson[slot.nodeId].inputs.size = parseInt(customSize, 10);
                    if (customPrompt) payloadJson[slot.nodeId].inputs.prompt = customPrompt;
                }
            }

            // 2. Submit Prompt
            setExecStatus("提交任务至队列...");
            const baseUrl = activeServer.url.endsWith('/') ? activeServer.url.slice(0, -1) : activeServer.url;
            
            const fetchHeaders = { "Content-Type": "application/json" };
            (activeServer.headers || []).forEach(h => {
                if (h.key && h.value) fetchHeaders[h.key.trim()] = h.value.trim();
            });

            const submitRes = await fetch(`${baseUrl}/prompt`, {
                method: "POST",
                headers: fetchHeaders,
                body: JSON.stringify({ client_id: "yizi_aitoolkit", prompt: payloadJson })
            });

            if (!submitRes.ok) throw new Error("ComfyUI /prompt 失败: " + await submitRes.text());
            const submitText = await submitRes.text();
            let submitData;
            try {
                submitData = JSON.parse(submitText);
            } catch(err) {
                throw new Error(`ComfyUI /prompt 接口返回了 HTML 页面而不是数据。请检查服务器地址是否正确: ${submitText.substring(0, 50)}...`);
            }
            const promptId = submitData.prompt_id;

            // 3. Poll History
            setExecStatus("渲染中...");
            let historyResult = null;
            while(true) {
                await new Promise(r => setTimeout(r, 2000));
                const histRes = await fetch(`${baseUrl}/history/${promptId}`);
                if (!histRes.ok) throw new Error(`查询状态失败: ${histRes.status} ${await histRes.text().catch(()=>'')}`);
                
                const histText = await histRes.text();
                let histData;
                try {
                    histData = JSON.parse(histText);
                } catch(err) {
                    throw new Error(`ComfyUI 返回了非预期的 HTML (可能地址配置错误或需要鉴权): ${histText.substring(0, 50)}...`);
                }
                
                if (histData[promptId]) {
                    historyResult = histData[promptId];
                    break;
                }
            }

            // 4. Extract Images & Save
            setExecStatus("拉取结果...");
            const outputUrls = [];
            if (historyResult.outputs) {
                for (const nodeId in historyResult.outputs) {
                    const nodeOut = historyResult.outputs[nodeId];
                    if (nodeOut.images && nodeOut.images.length > 0) {
                        for (const img of nodeOut.images) {
                            const dlUrl = `${baseUrl}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`;
                            outputUrls.push(dlUrl);
                            
                            // Auto save locally if configured
                            if (settings.autoSavePath) {
                                try {
                                    setExecStatus("保存到本地...");
                                    const imgRes = await fetch(dlUrl);
                                    const imgBlob = await imgRes.blob();
                                    const reader = new FileReader();
                                    reader.readAsDataURL(imgBlob);
                                    await new Promise(r => {
                                        reader.onloadend = async () => {
                                            const base64data = reader.result;
                                            const targetFile = `${settings.autoSavePath}\\ComfyUI_${Date.now()}_${img.filename}`;
                                            if (window.electron?.saveEditedImage) {
                                                await window.electron.saveEditedImage(targetFile, base64data, true);
                                                window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
                                            }
                                            r();
                                        };
                                    });
                                } catch(e) { console.error("AutoSave Error:", e); }
                            }
                        }
                    }
                }
            }
            setResults(outputUrls);
            setExecStatus("");
        } catch (e) {
            console.error("Execution failed", e);
            alert("执行失败: " + e.message);
            setExecStatus("");
        } finally {
            setIsExecuting(false);
        }
    };

    return el('div', { className: "flex flex-col h-full" },

        // ═══ ZONE 1: Server + Workflow Selector (固定区域，不随下方滚动) ═══
        el('div', { className: "shrink-0 flex flex-col text-black" },
            // Server Display
            el('div', { className: "flex items-center justify-between py-6 px-4" },
                el('div', { className: "text-[10px] uppercase tracking-widest font-black" }, "ACTIVE SERVER"),
                el('div', { className: "text-[10px] font-mono font-black" }, activeServer ? activeServer.name : "NONE")
            ),

            // Workflow Selection
            el('div', { className: "flex flex-col gap-4 pb-6 px-4" },
                el('div', { className: "flex items-center justify-between" },
                    el('div', { className: "text-xs font-black uppercase tracking-widest" }, "WORKFLOW TEMPLATE"),
                    el('label', { className: "text-[9px] font-black uppercase cursor-pointer border border-black/80 rounded-full hover:bg-black hover:text-white px-3 py-1 transition-all flex items-center gap-1 active:scale-95 text-black" },
                        FolderOpen ? el(FolderOpen, { size: 10 }) : null, "FOLDER",
                        el('input', { type: "file", webkitdirectory: "true", onChange: handleFolderSelect, className: "hidden" })
                    )
                ),
                el('div', { className: "border border-black/80 rounded-2xl bg-white py-1.5" },
                    el('div', { className: "flex flex-col max-h-[160px] overflow-y-auto thin-scrollbar" },
                        workflows.length === 0 ? el('div', { className: "text-[10px] uppercase tracking-widest p-4 text-center font-black opacity-50" }, "NO DIRECTORY CONFIGURED") :
                        workflows.map((wf, i) => el('div', {
                            key: wf.fileName,
                            onClick: () => selectWorkflow(wf),
                            className: `p-3 px-4 cursor-pointer transition-colors flex items-center justify-between font-black border-b border-black/10 last:border-b-0 ${selectedWf?.fileName === wf.fileName ? 'bg-black text-white' : 'hover:bg-black/5 text-black'}`
                        },
                            el('span', { className: "text-[11px] uppercase tracking-wide" }, wf.name),
                            el('span', { className: `text-[9px] font-mono uppercase tracking-widest ${selectedWf?.fileName === wf.fileName ? 'text-white/70' : 'text-black/50'}` }, `${wf.nodeCount} NODES`)
                        ))
                    )
                )
            )
        ),

        // ═══ ZONE 2: Inputs + Submit + Results (独立滚动区域) ═══
        el('div', { className: "flex-1 overflow-y-auto thin-scrollbar" },
            el('div', { className: "flex flex-col" },

                // ── Always visible: Size ──
                el('div', { className: "flex flex-col gap-2 px-4 py-6 border-b border-black" },
                    el('label', { className: "text-[10px] uppercase tracking-widest font-black text-black" }, "CUSTOM SIZE"),
                    el('input', { type: "text", value: customSize, onChange: e => setCustomSize(e.target.value), placeholder: "E.G. 1920", className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-black outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]" })
                ),

                // ── Workflow-dependent: Image slots + Submit ──
                selectedWf
                    ? el('div', { className: "flex flex-col gap-6 p-4 animate-yizi-toolkit-pop" },
                        el('div', { className: "text-xs font-black uppercase tracking-widest text-black" }, "IMAGE INPUTS"),

                        imageSlots.length > 0 ? el('div', { className: `grid ${imageSlots.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-4` },
                            imageSlots.map(slot => el('div', { key: slot.nodeId, className: "flex flex-col gap-2" },
                                el('span', { className: "text-[10px] font-black uppercase tracking-widest text-black truncate" }, slot.title),
                                el('div', {
                                    className: `w-full ${imageSlots.length === 1 ? 'h-[140px]' : 'aspect-square'} bg-white border border-black/80 border-dashed hover:bg-black/5 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer transition-all relative group text-black`,
                                    onDragOver: e => e.preventDefault(),
                                    onDrop: e => handleSlotDrop(e, slot.nodeId)
                                },
                                    slot.previewUrl ? el('img', { src: slot.previewUrl, className: "w-full h-full object-cover pointer-events-none" }) :
                                    el('div', { className: "flex flex-col items-center gap-2 opacity-40 font-black" },
                                        ImagePlus ? el(ImagePlus, { size: 24 }) : null,
                                        el('span', { className: "text-[10px] uppercase tracking-widest" }, "DROP")
                                    ),
                                    slot.localPath && el('button', {
                                        onClick: (e) => { e.stopPropagation(); assignSlot(slot.nodeId, null); },
                                        className: "absolute top-2 right-2 bg-black hover:bg-[#ef4444] text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                                    }, Trash2 ? el(Trash2, { size: 12 }) : "X")
                                )
                            ))
                        ) : el('div', { className: "text-[10px] text-center uppercase tracking-widest font-black text-black opacity-50 py-4" }, "NO IMAGE INPUTS"),

                        // ── Prompt (shared module) ──
                        el(PromptModule, {
                            value: customPrompt,
                            onChange: setCustomPrompt,
                            historyKey: 'aitoolkit-comfyui-prompts',
                            placeholder: 'OVERRIDE PROMPT...',
                            rows: 3
                        }),

                        // Submit Button
                        el('button', {
                            onClick: () => { addPromptToHistory('aitoolkit-comfyui-prompts', customPrompt); executeWorkflow(); },
                            disabled: isExecuting,
                            className: `w-full py-4 rounded-full text-sm font-black uppercase tracking-widest border border-black/80 flex items-center justify-center gap-2 transition-all ${isExecuting ? 'bg-transparent text-black opacity-50 cursor-not-allowed' : 'bg-black text-white hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_#000] active:scale-95'}`
                        },
                            isExecuting ? RefreshCw ? el(RefreshCw, { size: 16, className: "animate-spin" }) : null : Play ? el(Play, { size: 16 }) : null,
                            isExecuting ? execStatus : "SEND TO COMFYUI"
                        ),

                        // Results
                        results.length > 0 && el('div', { className: "flex flex-col gap-4 mt-4 animate-yizi-toolkit-pop border-t border-black pt-6" },
                            el('div', { className: "text-xs font-black uppercase tracking-widest text-black flex items-center justify-between" },
                                "RESULTS",
                                settings.autoSavePath ? el('span', { className: "text-[9px] opacity-50" }, "AUTO-SAVED") : null
                            ),
                            el('div', { className: "grid grid-cols-2 gap-4" },
                                results.map((rUrl, i) => el('div', { key: i, className: "relative aspect-square rounded-2xl overflow-hidden group cursor-pointer border border-black/80 bg-white" },
                                    el('img', { src: rUrl, className: "w-full h-full object-cover" }),
                                    el('div', {
                                        onClick: () => window.dispatchEvent(new CustomEvent('maximize-in-panel', { detail: { path: rUrl, url: rUrl } })),
                                        className: "absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    }, el('span', { className: "text-[10px] font-black uppercase tracking-widest text-black border border-black/80 px-4 py-2 rounded-full" }, "PREVIEW"))
                                ))
                            )
                        )
                    )
                    : el('div', { className: "flex items-center justify-center py-12 text-[10px] uppercase tracking-widest font-black text-black opacity-30 mt-4" }, "SELECT TEMPLATE")
            )
        )
    );
};
