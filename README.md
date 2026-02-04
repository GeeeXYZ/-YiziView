# YiziView - AI Photography Image Viewer

A high-performance Windows desktop image viewer built with Electron, React, and Vite, optimized for AI photography and prompt management.

## Key Features

### 🖼️ Enhanced Image Grid
- **Dynamic Aspect Ratio Switcher**: Support for 1:1, 16:9, 9:16, 4:3, and 3:4 ratios.
- **Custom CSS Shape Icons**: Visual representation of aspect ratios in the UI.
- **Precise Selection System**: Support for single click, shift-click range selection, and drag-to-select.
- **Shortcut Support**: `Ctrl+A` for selecting all, `Delete` for trashing files.

### 🚀 Performance Optimization
- **High-Performance Thumbnails**: Backend generation using `Sharp` with disk caching to `userData`.
- **Intelligent Lazy Loading**: Zero-lag scrolling using `IntersectionObserver` to generate thumbnails on-demand.
- **Smooth Transitions**: Integrated loading states and smooth transitions for image cells.

### 🏷️ AI & Tag Management
- **Prompt Display**: View AI generation prompts (ComfyUI/A1111) directly in the app.
- **Tag Indexing**: Powerful tag management with keyword search and batch tagging.
- **Drag-and-Drop Tagging**: Drag images to sidebar tags for organization.

### 📂 File System Integration
- **Smart Sidebar**: Automatic UI refresh on folder creation, deletion, or renaming.
- **Native Context Menu**: System-level integration for Explorer actions.
- **OS Drag & Drop**: Drag files directly from YiziView into Other applications.

### 🎨 Premium UI/UX
- **Custom Modal System**: Themed confirmation dialogs replacing native browser prompts.
- **Glassmorphism Design**: Modern, dark-themed interface with subtle blurs and transitions.
- **Responsive Layout**: Resizable sidebar and fluid grid.

## Development

### Install Dependencies
```bash
npm install
```

### Run Locally (Dev)
```bash
npm run dev
```

### Build for Windows
```bash
npm run build
```

## Structure
- `electron/`: Main process code (File API, Sharp processing)
- `src/`: Renderer process (React components, UI logic)
- `storage/`: Local data (Tags, Favorites)
- `userData/thumbnails`: Cached image previews
