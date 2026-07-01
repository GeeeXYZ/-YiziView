export const { React, YiziAPI, lucide } = window;
export const createElement = React.createElement;
export const el = (tag, props = {}, ...children) => createElement(tag, props, ...children);

// Export commonly used icons gracefully
export const { 
    Settings, Play, Image, ImageIcon, Check, RefreshCw, Folder, Sliders, Layers, 
    ChevronDown, ChevronLeft, Trash2, X, Download, Server, Cpu, CpuIcon, ImagePlus, Copy, Save, 
    Sparkles, FolderOpen, Plus, Crown, Zap, Clock, Pin, PinOff, Star, Scissors, Frame,
    Workflow, LayoutTemplate, LayoutGrid, Wand2
} = lucide || {};
