import React, { useState, useEffect } from 'react';
import { ConfigManager } from '../managers/ConfigManager';
import { FileSystem } from '../managers/FileSystem';
import { X, FileText, Copy } from 'lucide-react';

const BottomPanel = ({ selectedIndices, images, onTagsChange }) => {
    const [commonTags, setCommonTags] = useState([]);
    const [loadingTags, setLoadingTags] = useState(false);

    // Prompts State
    const [prompts, setPrompts] = useState({ positive: '', negative: '', type: null }); // type: 'a1111' | 'comfy'
    const [loadingPrompts, setLoadingPrompts] = useState(false);
    const [showPrompts, setShowPrompts] = useState(false);

    useEffect(() => {
        loadTags();
        loadPrompts();
    }, [selectedIndices, images]);

    const loadTags = async () => {
        if (!selectedIndices || selectedIndices.size === 0) {
            setCommonTags([]);
            return;
        }

        setLoadingTags(true);
        try {
            const selectedFiles = [];
            selectedIndices.forEach(index => {
                if (images[index]) selectedFiles.push(images[index].path);
            });

            if (selectedFiles.length === 0) {
                setCommonTags([]);
                setLoadingTags(false);
                return;
            }

            const tagsMap = await ConfigManager.getTagsForFiles(selectedFiles);

            // Logic: Show ALL tags that appear in ANY of the selected files (Union)
            const allTags = new Set();
            Object.values(tagsMap).forEach(tags => {
                if (Array.isArray(tags)) {
                    tags.forEach(t => allTags.add(t));
                }
            });

            setCommonTags(Array.from(allTags));
        } catch (error) {
            console.error('Failed to load tags for selection:', error);
        } finally {
            setLoadingTags(false);
        }
    };

    const loadPrompts = async () => {
        setPrompts({ positive: '', negative: '', type: null });
        setShowPrompts(false);

        // Only load prompts if exactly one image is selected
        if (!selectedIndices || selectedIndices.size !== 1) return;

        setLoadingPrompts(true);
        try {
            const index = Array.from(selectedIndices)[0];
            const image = images[index];
            if (!image) return;

            const metadata = await FileSystem.readImageMetadata(image.path);

            // 1. Try A1111 / Parameters
            if (metadata.parameters) {
                // Parse "Positive" and "Negative"
                // Format usually: "Positive Prompt\nNegative prompt: Negative..."
                // Or just "Pos..."
                // Heuristic split
                const text = metadata.parameters;
                let pos = text;
                let neg = '';

                const negIndex = text.indexOf('Negative prompt:');
                if (negIndex !== -1) {
                    pos = text.substring(0, negIndex).trim();
                    const afterNeg = text.substring(negIndex + 'Negative prompt:'.length);
                    // Find steps which usually ends negative prompt
                    const stepsIndex = afterNeg.indexOf('Steps:');
                    if (stepsIndex !== -1) {
                        neg = afterNeg.substring(0, stepsIndex).trim();
                    } else {
                        neg = afterNeg.trim();
                    }
                } else {
                    // Maybe check for "Steps:" to cut off params
                    const stepsIndex = text.indexOf('Steps:');
                    if (stepsIndex !== -1) {
                        pos = text.substring(0, stepsIndex).trim();
                    }
                }

                setPrompts({ positive: pos, negative: neg, type: 'a1111' });
            }
            // 2. Try ComfyUI Prompt (JSON)
            else if (metadata.prompt) {
                try {
                    // Sanitize JSON
                    const sanitizedPrompt = metadata.prompt.replace(/:\s*NaN/g, ': null').replace(/\[\s*NaN\s*\]/g, '[null]').replace(/,\s*NaN\s*\]/g, ', null]').replace(/\[\s*NaN\s*,/g, '[null,');
                    const json = JSON.parse(sanitizedPrompt);

                    // Strategy: Trace from KSampler
                    // 1. Find KSampler nodes
                    const samplers = Object.values(json).filter(node =>
                        node.class_type && (
                            node.class_type.includes('Sampler') ||
                            node.class_type.includes('Efficient Loader') ||
                            node.class_type === 'KSampler' ||
                            node.class_type === 'KSamplerAdvanced'
                        )
                    );

                    const foundPos = new Set();
                    const foundNeg = new Set();

                    // Recursive helper to find text in conditioning chain
                    const findTextInChain = (nodeId, visited = new Set()) => {
                        if (!nodeId || visited.has(nodeId)) return [];
                        visited.add(nodeId);

                        const node = json[nodeId];
                        if (!node) return [];

                        const texts = [];

                        // Check direct text inputs
                        const textKeys = ['text', 'text_g', 'text_l', 'positive', 'negative', 'string', 'value', 'prompt'];
                        textKeys.forEach(key => {
                            if (node.inputs && node.inputs[key]) {
                                const val = node.inputs[key];
                                if (typeof val === 'string' && val.trim().length > 1 && !val.startsWith('%')) {
                                    // Exclude obviously technical strings if needed, or keeping them is fine.
                                    // Check for Primitive Node behavior where 'value' is the text
                                    texts.push(val);
                                } else if (Array.isArray(val)) {
                                    // Link: [NodeID, Slot]
                                    // Should we trace TEXT inputs? 
                                    // Usually text input comes from Primitive node. 
                                    // If we are looking at 'text' input and it's a link, traverse it.
                                    if (['text', 'text_g', 'text_l', 'string', 'value'].includes(key)) {
                                        texts.push(...findTextInChain(val[0], visited));
                                    }
                                }
                            }
                        });

                        // If this node is strictly a CLIPTextEncode-like node, we are good.
                        // If it's a Combiner or Reroute, we might need to trace 'input' or similar?
                        // But usually KSampler -> positive -> [CLIPTextEncode] or [Combine -> [CLIPTextEncode, ...]]
                        // KSampler inputs are 'positive', 'negative' (Conditioning).
                        // If we are tracing Conditioning, we shouldn't look for 'text' keys immediately on the Combiner?
                        // Combiner usually takes 'conditioning_1', 'conditioning_2'.
                        // This recursion logic is mixed (Searching for text AND tracing connections).

                        // Let's split: Trace Conditioning vs Finding Text.
                        // But simpler heuristic:
                        // Just traverse ALL inputs that are Links.
                        // And if ANY node in the chain has a 'text'/'value' field that looks like a prompt, grab it.

                        // Heuristic Recursion:
                        // If this node has typical text fields, grab them.
                        // Then recurse into inputs that are links (Conditioning or Text links).
                        if (node.inputs) {
                            Object.values(node.inputs).forEach(val => {
                                if (Array.isArray(val) && val.length === 2) {
                                    // It's a link. Trace it.
                                    // Limit depth or just rely on visited set.
                                    texts.push(...findTextInChain(val[0], visited));
                                }
                            });
                        }

                        return texts;
                    };

                    samplers.forEach(sampler => {
                        if (sampler.inputs) {
                            if (sampler.inputs.positive && Array.isArray(sampler.inputs.positive)) {
                                const texts = findTextInChain(sampler.inputs.positive[0]);
                                texts.forEach(t => foundPos.add(t));
                            }
                            if (sampler.inputs.negative && Array.isArray(sampler.inputs.negative)) {
                                const texts = findTextInChain(sampler.inputs.negative[0]);
                                texts.forEach(t => foundNeg.add(t));
                            }
                            // Efficient Loader specific
                            if (sampler.class_type.includes('Efficient Loader')) {
                                if (typeof sampler.inputs.positive === 'string') foundPos.add(sampler.inputs.positive);
                                if (typeof sampler.inputs.negative === 'string') foundNeg.add(sampler.inputs.negative);
                            }
                        }
                    });

                    // Fallback: If no samplers found or trace failed, dump all CLIPTextEncode
                    if (foundPos.size === 0 && foundNeg.size === 0) {
                        Object.values(json).forEach(node => {
                            if (node.class_type && node.class_type.includes('TextEncode')) {
                                if (node.inputs && typeof node.inputs.text === 'string') {
                                    foundPos.add(node.inputs.text);
                                }
                            }
                        });
                    }

                    if (foundPos.size > 0 || foundNeg.size > 0) {
                        setPrompts({
                            positive: Array.from(foundPos).join('\n\n'),
                            negative: Array.from(foundNeg).join('\n\n'),
                            type: 'comfy'
                        });
                    }

                } catch (e) {
                    console.error('Failed to parse ComfyUI prompt JSON:', e);
                }
            }

        } catch (error) {
            console.error('Failed to load prompts:', error);
        } finally {
            setLoadingPrompts(false);
        }
    };

    const handleRemoveTag = async (tagName) => {
        const selectedFiles = [];
        selectedIndices.forEach(index => {
            if (images[index]) selectedFiles.push(images[index].path);
        });

        await ConfigManager.removeFilesFromTag(selectedFiles, tagName);
        // Refresh tags
        await loadTags();
        // Notify parent to refresh if needed (e.g. if we are in Tag View, removing tag might remove image from view)
        if (onTagsChange) onTagsChange();
    };

    if (!selectedIndices || selectedIndices.size === 0) return null;

    return (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-50 w-full pointer-events-none">

            {/* Prompts Panel (Expandable) */}
            {(prompts.positive || prompts.negative) && (
                <div className={`pointer-events-auto bg-neutral-900/95 backdrop-blur border border-neutral-700 rounded-xl p-4 shadow-2xl transition-all duration-300 w-[600px] max-w-[90vw] overflow-y-auto max-h-[300px] ${showPrompts ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none hidden'}`}>
                    {prompts.positive && (
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider">Prompt</h4>
                                <button
                                    onClick={() => navigator.clipboard.writeText(prompts.positive)}
                                    className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                                    title="Copy Positive Prompt"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">{prompts.positive}</p>
                        </div>
                    )}
                    {prompts.negative && (
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Negative Prompt</h4>
                                <button
                                    onClick={() => navigator.clipboard.writeText(prompts.negative)}
                                    className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                                    title="Copy Negative Prompt"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">{prompts.negative}</p>
                        </div>
                    )}
                    <div className="mt-2 text-[10px] text-gray-600 uppercase text-right">
                        Source: {prompts.type === 'a1111' ? 'Parameters' : 'ComfyUI Metadata'}
                    </div>
                </div>
            )}

            {/* Main Bar */}
            <div className="pointer-events-auto bg-neutral-900/90 backdrop-blur border border-neutral-700 rounded-full px-6 py-2 shadow-2xl flex items-center gap-4 transition-all">
                <div className="text-gray-400 text-xs font-medium border-r border-neutral-700 pr-4">
                    {selectedIndices.size} Selected
                </div>

                {loadingTags ? (
                    <div className="text-gray-500 text-xs">Loading tags...</div>
                ) : commonTags.length === 0 ? (
                    <div className="text-gray-500 text-xs italic">No tags</div>
                ) : (
                    <div className="flex items-center gap-2">
                        {commonTags.slice(0, 5).map(tag => (
                            <div key={tag} className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 text-xs px-2 py-1 rounded-full transition-colors">
                                <span>{tag}</span>
                                <button
                                    onClick={() => handleRemoveTag(tag)}
                                    className="text-gray-500 hover:text-red-400 focus:outline-none flex items-center"
                                    title="Remove Tag"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                        {commonTags.length > 5 && (
                            <span className="text-gray-500 text-xs">+{commonTags.length - 5} more</span>
                        )}
                    </div>
                )}

                {/* Prompt Toggle Button */}
                {selectedIndices.size === 1 && (prompts.positive || prompts.negative) && (
                    <>
                        <div className="h-4 w-px bg-neutral-700 mx-2"></div>
                        <button
                            onClick={() => setShowPrompts(!showPrompts)}
                            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${showPrompts ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
                        >
                            <FileText size={14} />
                            {showPrompts ? 'Hide Info' : 'Show Info'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default BottomPanel;
