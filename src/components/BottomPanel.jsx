
import React, { useState, useEffect } from 'react';
import { ConfigManager } from '../managers/ConfigManager';
import { FileSystem } from '../managers/FileSystem';
import { X, FileText, Copy, Tag } from 'lucide-react';

const BottomPanel = ({ selectedIndices, images, onTagsChange, aspectRatio, setAspectRatio, isViewing = false }) => {
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

            console.log('Metadata loaded:', metadata); // DEBUG

            // 1. Try A1111 / Parameters
            if (metadata.parameters) {
                const text = metadata.parameters;
                let pos = text;
                let neg = '';

                const negIndex = text.indexOf('Negative prompt:');
                if (negIndex !== -1) {
                    pos = text.substring(0, negIndex).trim();
                    const afterNeg = text.substring(negIndex + 'Negative prompt:'.length);
                    const stepsIndex = afterNeg.indexOf('Steps:');
                    if (stepsIndex !== -1) {
                        neg = afterNeg.substring(0, stepsIndex).trim();
                    } else {
                        neg = afterNeg.trim();
                    }
                } else {
                    const stepsIndex = text.indexOf('Steps:');
                    if (stepsIndex !== -1) {
                        pos = text.substring(0, stepsIndex).trim();
                    }
                }
                setPrompts({ positive: pos, negative: neg, type: 'a1111' });
            }
            // 2. Try ComfyUI Prompt (Regular or API Format)
            else if (metadata.prompt || metadata.prompt_parsed) {
                // If prompt_parsed exists (from our backend helper), use it directly if possible
                if (metadata.prompt_parsed && !metadata.positive) {
                    setPrompts({
                        positive: metadata.prompt_parsed, // It puts everything in positive currently
                        negative: '',
                        type: 'comfy'
                    });
                    return;
                }

                // Fallback to existing detailed parser for normal 'prompt'
                if (metadata.prompt) {
                    try {
                        const sanitizedPrompt = metadata.prompt.replace(/:\s*NaN/g, ': null').replace(/\[\s*NaN\s*\]/g, '[null]').replace(/,\s*NaN\s*\]/g, ', null]').replace(/\[\s*NaN\s*,/g, '[null,');
                        const json = JSON.parse(sanitizedPrompt);
                        // ... existing parser logic ...
                        const samplers = Object.values(json).filter(node =>
                            node.class_type && (
                                node.class_type.includes('Sampler') ||
                                node.class_type.includes('Efficient Loader') ||
                                node.class_type === 'KSampler' ||
                                node.class_type === 'KSamplerAdvanced'
                            )
                        );
                        // ... (rest of parser logic is fine, just need to ensure we run it)
                        // COPIED LOGIC FOR CONTEXT:
                        const foundPos = new Set();
                        const foundNeg = new Set();
                        const findTextInChain = (nodeId, visited = new Set()) => {
                            if (!nodeId || visited.has(nodeId)) return [];
                            visited.add(nodeId);
                            const node = json[nodeId];
                            if (!node) return [];
                            const texts = [];
                            const textKeys = ['text', 'text_g', 'text_l', 'positive', 'negative', 'string', 'value', 'prompt'];
                            textKeys.forEach(key => {
                                if (node.inputs && node.inputs[key]) {
                                    const val = node.inputs[key];
                                    if (typeof val === 'string' && val.trim().length > 1 && !val.startsWith('%')) {
                                        texts.push(val);
                                    } else if (Array.isArray(val)) {
                                        if (['text', 'text_g', 'text_l', 'string', 'value'].includes(key)) {
                                            texts.push(...findTextInChain(val[0], visited));
                                        }
                                    }
                                }
                            });
                            if (node.inputs) {
                                Object.values(node.inputs).forEach(val => {
                                    if (Array.isArray(val) && val.length === 2) {
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
                                if (sampler.class_type.includes('Efficient Loader')) {
                                    if (typeof sampler.inputs.positive === 'string') foundPos.add(sampler.inputs.positive);
                                    if (typeof sampler.inputs.negative === 'string') foundNeg.add(sampler.inputs.negative);
                                }
                            }
                        });
                        if (foundPos.size === 0 && foundNeg.size === 0) {
                            // Use prompt_parsed as fallback if detailed parse failed
                            if (metadata.prompt_parsed) {
                                foundPos.add(metadata.prompt_parsed);
                            } else {
                                Object.values(json).forEach(node => {
                                    // Also check for 'Text Multiline' explicitly here in frontend
                                    if (node.class_type === 'Text Multiline' && node.inputs && node.inputs.text) {
                                        foundPos.add(node.inputs.text);
                                    }
                                    if (node.class_type && node.class_type.includes('TextEncode')) {
                                        if (node.inputs && typeof node.inputs.text === 'string') {
                                            foundPos.add(node.inputs.text);
                                        }
                                    }
                                });
                            }
                        }
                        if (foundPos.size > 0 || foundNeg.size > 0) {
                            setPrompts({
                                positive: Array.from(foundPos).join('\n\n'),
                                negative: Array.from(foundNeg).join('\n\n'),
                                type: 'comfy'
                            });
                        }
                    } catch (e) {
                        // JSON Parse failed, fallback to prompt_parsed
                        if (metadata.prompt_parsed) {
                            setPrompts({
                                positive: metadata.prompt_parsed,
                                negative: '',
                                type: 'comfy'
                            });
                        }
                        console.error('Failed to parse ComfyUI prompt JSON:', e);
                    }
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
        await loadTags();
        if (onTagsChange) onTagsChange();
    };

    const hasSelection = selectedIndices && selectedIndices.size > 0;

    return (
        <div className={`${isViewing ? 'fixed' : 'absolute'} ${isViewing ? 'bottom-6' : 'bottom-4'} left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-[50] max-w-[95%] pointer-events-none transition-all`}>

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
            <div className="pointer-events-auto bg-neutral-900/90 backdrop-blur border border-neutral-700 rounded-full px-6 py-2 shadow-2xl flex items-center gap-4 transition-all w-max">
                {hasSelection && (
                    <>
                        {!isViewing && (
                            <div className="text-gray-400 text-xs font-medium border-r border-neutral-700 pr-4">
                                {selectedIndices.size} Selected
                            </div>
                        )}

                        {loadingTags ? (
                            <div className="text-gray-500 text-xs text-center min-w-[60px]">Loading...</div>
                        ) : commonTags.length === 0 ? (
                            <div className="text-gray-500 text-xs italic text-center min-w-[60px]">No tags</div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {commonTags.slice(0, 5).map(tag => (
                                    <div key={tag} className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap">
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
                                    <span className="text-gray-500 text-xs">+{commonTags.length - 5}</span>
                                )}
                            </div>
                        )}
                    </>
                )}

                {!hasSelection && !isViewing && (
                    <div className="text-gray-500 text-xs italic border-r border-neutral-700 pr-4">
                        No selection
                    </div>
                )}

                {/* Right Area */}
                {!isViewing ? (
                    <div className="flex items-center gap-4 border-l border-neutral-700 pl-4">
                        <div className="flex items-center bg-neutral-900 rounded-md border border-neutral-700 p-0.5">
                            {[
                                { id: '9:16', title: '9:16 Portrait', width: 9, height: 16 },
                                { id: '3:4', title: '3:4 Portrait', width: 12, height: 16 },
                                { id: '1:1', title: '1:1 Square', width: 14, height: 14 },
                                { id: '4:3', title: '4:3 Landscape', width: 16, height: 12 },
                                { id: '16:9', title: '16:9 Landscape', width: 16, height: 9 },
                            ].map(ratio => (
                                <button
                                    key={ratio.id}
                                    onClick={() => setAspectRatio(ratio.id)}
                                    className={`p-1.5 rounded transition-colors flex items-center justify-center w-8 h-8 ${aspectRatio === ratio.id ? 'bg-neutral-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    title={ratio.title}
                                >
                                    <div
                                        className="border-2 border-current rounded-[2.5px]"
                                        style={{
                                            width: `${ratio.width}px`,
                                            height: `${ratio.height}px`
                                        }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    selectedIndices.size === 1 && images[Array.from(selectedIndices)[0]] && (
                        <div className="text-gray-300 text-xs font-medium border-l border-neutral-700 pl-4 max-w-[250px] truncate">
                            {images[Array.from(selectedIndices)[0]].name}
                        </div>
                    )
                )}

                {/* Prompt Toggle Button */}
                {selectedIndices.size === 1 && (prompts.positive || prompts.negative) && (
                    <div className="flex items-center">
                        <div className="h-4 w-px bg-neutral-700 mx-2"></div>
                        <button
                            onClick={() => setShowPrompts(!showPrompts)}
                            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${showPrompts ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
                        >
                            <FileText size={14} />
                            {showPrompts ? 'Hide' : 'Prompt'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BottomPanel;
