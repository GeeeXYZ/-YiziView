import { React, el, Clock, Pin, PinOff, X, Trash2, Copy } from '../../core/globals.js';

const HISTORY_MAX = 15;

const loadHistory = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
};

const persistHistory = (key, history) => {
    localStorage.setItem(key, JSON.stringify(history));
};

/**
 * Call this from parent when a prompt is actually submitted (generate/execute).
 * Adds the prompt text to history, deduplicates, and enforces the 15-entry cap on unpinned items.
 */
export const addPromptToHistory = (historyKey, text) => {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    let history = loadHistory(historyKey);

    // Remove exact duplicates (will re-add at top)
    history = history.filter(h => h.text !== trimmed);

    // Insert at front
    history.unshift({ text: trimmed, pinned: false, ts: Date.now() });

    // Enforce cap: pinned items are exempt, only trim unpinned
    const pinned = history.filter(h => h.pinned);
    const unpinned = history.filter(h => !h.pinned);
    history = [...pinned, ...unpinned.slice(0, HISTORY_MAX)];

    persistHistory(historyKey, history);
};

/**
 * Shared Prompt Input with history dropdown and pin support.
 * Props:
 *   value       - controlled prompt string
 *   onChange     - (newText: string) => void
 *   historyKey   - localStorage key for this prompt's history
 *   placeholder  - textarea placeholder
 *   rows         - textarea rows (default 3)
 */
export const PromptModule = ({ value, onChange, historyKey, placeholder, rows }) => {
    const [showHistory, setShowHistory] = React.useState(false);
    const [history, setHistory] = React.useState([]);

    // Refresh history list whenever panel opens
    React.useEffect(() => {
        if (showHistory) setHistory(loadHistory(historyKey));
    }, [showHistory, historyKey]);

    // On mount: restore last-used prompt
    React.useEffect(() => {
        const last = localStorage.getItem(historyKey + ':last');
        if (last && !value) onChange(last);
    }, []);

    // Persist current prompt as last-used (debounced via the controlled value)
    React.useEffect(() => {
        if (value) localStorage.setItem(historyKey + ':last', value);
    }, [value, historyKey]);

    const togglePin = (idx) => {
        const updated = [...history];
        updated[idx] = { ...updated[idx], pinned: !updated[idx].pinned };
        persistHistory(historyKey, updated);
        setHistory(updated);
    };

    const removeItem = (idx) => {
        const updated = history.filter((_, i) => i !== idx);
        persistHistory(historyKey, updated);
        setHistory(updated);
    };

    const selectItem = (item) => {
        onChange(item.text);
    };

    return el('div', { className: 'flex flex-col gap-1.5 relative' },
        // ── Label row ──
        el('div', { className: 'flex items-center justify-between px-1' },
            el('label', { className: 'text-[10px] font-black uppercase tracking-widest' }, 'PROMPT'),
            el('button', {
                onClick: () => setShowHistory(!showHistory),
                title: 'History',
                className: `px-2 py-1 text-[9px] uppercase font-black rounded-full border border-black/80 transition-all active:scale-90 ${showHistory ? 'bg-black text-white' : 'bg-transparent text-black hover:bg-black hover:text-white'}`
            }, Clock ? el(Clock, { size: 10 }) : '⏱')
        ),

        // ── Textarea ──
        el('textarea', {
            value: value || '',
            onChange: e => onChange(e.target.value),
            placeholder: placeholder || 'DESCRIBE WHAT YOU WANT...',
            rows: rows || 3,
            className: "w-full rounded-2xl border border-black/80 bg-white p-4 text-[11px] font-black outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000] resize-none ai-toolkit-scrollbar placeholder-black/30"
        }),

        // ── History Panel ──
        showHistory && el('div', { className: 'flex flex-col border border-black/80 rounded-2xl overflow-hidden mt-2 bg-white' },
            // Header
            el('div', { className: 'flex items-center justify-between px-3 py-2 border-b-2 border-black bg-white' },
                el('span', { className: 'text-[10px] font-black uppercase tracking-widest' }, 'HISTORY'),
                el('button', {
                    onClick: () => setShowHistory(false),
                    className: 'p-1 rounded-full border border-transparent hover:border-black/80 transition-colors hover:bg-black hover:text-white text-black active:scale-90'
                }, X ? el(X, { size: 10 }) : '×')
            ),
            // Items
            el('div', { className: 'max-h-[200px] overflow-y-auto ai-toolkit-scrollbar' },
                history.length === 0
                    ? el('div', { className: 'text-[10px] uppercase tracking-widest text-center py-4 font-black opacity-50' }, 'NO HISTORY')
                    : history.map((item, idx) => el('div', {
                        key: idx,
                        className: `flex items-start gap-2 px-3 py-2 group transition-colors border-b border-black/10 last:border-b-0 ${item.pinned ? 'bg-black/5' : 'hover:bg-black/5'}`
                    },
                        // Pin indicator bar
                        item.pinned && el('div', { className: 'w-1 shrink-0 self-stretch rounded-full bg-black mr-1' }),
                        // Prompt text
                        el('div', {
                            onClick: () => selectItem(item),
                            className: `flex-1 text-[11px] cursor-pointer leading-relaxed transition-colors line-clamp-2 font-black ${item.pinned ? 'text-black' : 'text-black/60 group-hover:text-black'}`
                        }, item.text),
                        // Actions
                        el('div', { className: 'flex items-center gap-1 shrink-0 ml-1' },
                            el('button', {
                                onClick: () => navigator.clipboard.writeText(item.text),
                                title: 'Copy',
                                className: 'p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black hover:text-white transition-all active:scale-90'
                            }, Copy ? el(Copy, { size: 10 }) : '📋'),
                            el('button', {
                                onClick: () => togglePin(idx),
                                title: item.pinned ? 'Unpin' : 'Pin',
                                className: `p-1 rounded-full transition-all active:scale-90 ${item.pinned ? 'hover:bg-black hover:text-white' : 'opacity-0 group-hover:opacity-100 hover:bg-black hover:text-white'}`
                            }, Pin ? el(Pin, { size: 10 }) : '📌'),
                            !item.pinned && el('button', {
                                onClick: () => removeItem(idx),
                                title: 'Delete',
                                className: 'p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-[#ef4444] hover:text-white transition-all active:scale-90'
                            }, X ? el(X, { size: 10 }) : '×')
                        )
                    ))
            )
        )
    );
};
