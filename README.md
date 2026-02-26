# YiziView - AI Photography Image Viewer

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## English Version

A high-performance Windows desktop image viewer built with Electron, React, and Vite, optimized for AI photography and prompt management.

### 🖼️ Key Features

#### Immersive Image Viewer
- **Full-Screen Adaptation**: Images and videos automatically scale to fit the entire screen while maintaining their original aspect ratio.
- **Auto-Play Slideshow**: Conveniently cycle through images with an automatic, timed slideshow feature.

#### Enhanced Image Grid
- **Dynamic Aspect Ratio Switcher**: Support for 1:1, 16:9, 9:16, 4:3, and 3:4 ratios.
- **Custom CSS Shape Icons**: Visual representation of aspect ratios in the UI.
- **Precise Selection System**: Support for single click, shift-click range selection, and drag-to-select.
- **Shortcut Support**: `Ctrl+A` for selecting all, `Delete` for trashing files.

#### Performance Optimization
- **High-Performance Thumbnails**: Backend generation using `Sharp` with disk caching to `userData`.
- **Intelligent Lazy Loading**: Zero-lag scrolling using `IntersectionObserver` to generate thumbnails on-demand.
- **Smooth Transitions**: Integrated loading states and smooth transitions for image cells.

#### AI & Tag Management
- **Prompt Display**: View AI generation prompts (ComfyUI/A1111) directly in the app.
- **Tag Indexing**: Powerful tag management with keyword search and batch tagging.
- **Drag-and-Drop Tagging**: Drag images to sidebar tags for organization.

#### File System Integration
- **Smart Sidebar**: Automatic UI refresh on folder creation, deletion, or renaming.
- **Native Context Menu**: System-level integration for Explorer actions.
- **OS Drag & Drop**: Drag files directly from YiziView into Other applications.

#### Premium UI/UX
- **Custom Modal System**: Themed confirmation dialogs replacing native browser prompts.
- **Glassmorphism Design**: Modern, dark-themed interface with subtle blurs and transitions.
- **Responsive Layout**: Resizable sidebar and fluid grid.

### 🛠️ Development

#### Install Dependencies
```bash
npm install
```

#### Run Locally (Dev)
```bash
npm run dev
```

#### Build for Windows
```bash
npm run build
```

### 📂 Structure
- `electron/`: Main process code (File API, Sharp processing)
- `src/`: Renderer process (React components, UI logic)
- `storage/`: Local data (Tags, Favorites)
- `userData/thumbnails`: Cached image previews

### ⚖️ License

This project is licensed under the **YiziView Non-Commercial EULA** - see the [LICENSE](LICENSE) file for details.

**Key Restrictions:**
*   **Non-Commercial Use Only (不可商用)**: You may not use this software or its source code for any commercial purposes.
*   **No Redistribution (禁止二次分发与倒卖)**: You may not sell or redistribute this software.
*   **No Derivative Works for commercialization**: You may not modify and release this software as your own commercial product.

Copyright (c) 2026 YiziView Contributors. All rights reserved.

---

<a name="中文"></a>
## 中文说明

一款基于 Electron、React 和 Vite 构建的高性能 Windows 桌面图像浏览器，专门为 AI 摄影和提示词管理而优化。

### 🖼️ 核心功能

#### 沉浸式图像查看
- **全屏自适应**：图片和视频自动缩放以填满屏幕，同时保持原始纵横比。
- **自动播放幻灯片**：方便地循环浏览图片，支持定时自动切换功能。

#### 增强型图像网格
- **动态比例切换**：支持 1:1, 16:9, 9:16, 4:3 和 3:4 比例。
- **自定义比例图标**：UI 中直观展示纵横比的 CSS 图形图标。
- **精准选择系统**：支持单选、Shift/Ctrl 连选以及拖拽多选。
- **快捷键支持**：`Ctrl+A` 全选，`Delete` 移至回收站。

#### 性能优化
- **高性能缩略图**：后端使用 `Sharp` 生成并缓存至 `userData`，极大提升加载速度。
- **智能懒加载**：使用 `IntersectionObserver` 实现零延迟滚动，按需生成缩略图。
- **平滑过渡**：深度集成的加载状态和图像单元格平滑过渡动画。

#### AI 与标签管理
- **提示词显示**：直接在应用内查看 AI 生成提示词（支持 ComfyUI/A1111）。
- **标签索引**：强大的标签管理，支持关键词搜索和批量贴标。
- **拖拽贴标**：直接将图片拖拽至侧边栏标签进行快速归类。

#### 文件系统集成
- **智能侧边栏**：文件夹创建、删除或重命名时 UI 自动实时刷新。
- **原生右键菜单**：深度集成系统级文件操作。
- **系统级拖拽**：支持将图片从 YiziView 直接拖拽至其他第三方应用。

#### 高端 UI/UX 设计
- **自定义模态框**：深度定制的主题化确认对话框，取代原生浏览器弹窗。
- **毛玻璃设计**：现代暗色系界面，融合细腻的模糊效果和过渡动画。
- **响应式布局**：可调节大小的侧边栏和响应式网格流。

### 🛠️ 开发指南

#### 安装依赖
```bash
npm install
```

#### 本地运行 (开发模式)
```bash
npm run dev
```

#### 构建 Windows 安装包
```bash
npm run build
```

### 📂 项目结构
- `electron/`: 主进程代码（文件 API 处理、Sharp 图像处理）
- `src/`: 渲染进程（React 组件、UI 逻辑）
- `storage/`: 本地数据存储（标签、收藏夹）
- `userData/thumbnails`: 缓存的图像预览缩略图

### ⚖️ 许可协议

本项目采用 **YiziView Non-Commercial EULA** 协议保护 - 详见 [LICENSE](LICENSE) 文件。

**核心限制：**
*   **仅限非商业用途 (Non-Commercial Use Only)**：禁止将本软件或源码用于任何商业目的。
*   **禁止二次分发 (No Redistribution)**：禁止售卖或分发本软件的安装包或源码。
*   **禁止商业性衍生品**：禁止修改本软件并将其作为商业产品发布。

Copyright (c) 2026 YiziView Contributors. All rights reserved.
