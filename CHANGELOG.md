# CHANGELOG

## v0.9.1 - Code Audit & Stability Patch

### 🐛 Bug Fixes
- **Expanded Folders Persistence**: Fixed a silent data-loss bug where the `saveExpandedFolders` function body was empty, causing folder tree expanded states to never persist to disk across restarts.
- **Thumbnail Quality Setting**: Fixed the preload bridge dropping the `size` parameter for `getThumbnail`, making the user's thumbnail quality preference actually take effect.
- **Tag Path Shadowing**: Removed a local `fileTagsPath` redeclaration in the `move-items` IPC handler that shadowed and could diverge from the global definition.
- **Dead Code Cleanup**: Removed an orphaned `beforeunload` handler in `App.jsx` that was declared but never bound to the window.

### 🛡️ Security & Robustness
- **Shell Injection Hardening**: Wrapped the PowerShell clipboard command in a script block (`& { ... }`) to prevent potential interpretation issues with special characters in file paths.

### ⚡ Performance
- **Thumbnail Cache Clearing**: Optimized `clear-thumbnails-for-folder` to read the cache directory once instead of once-per-file, dramatically reducing I/O for large folders.
- **Wheel Listener Stability**: Refactored the grid zoom wheel handler to read selection state via a ref, eliminating unnecessary listener re-registration on every selection change.
- **Top-Level Imports**: Moved `require('url')` and deduplicated `require('crypto')` to the file header for consistent module resolution.

### 🧹 Housekeeping
- Removed residual debug `console.log` statements from `BottomPanel`, `main.cjs` clipboard handler.
- Removed duplicate comments and ~40 lines of stale design-process notes from `ImageGrid.jsx`.
- Removed unused `onDelete` prop from `Panel.jsx`.
- Removed leftover `Sponsor` button from `Sidebar.jsx`.
- Deleted orphaned test files (`hsl_test.js`, `electron/test.jpg`, `electron/test2.jpg`).

---
*(中文版更新日志)*

### 🐛 缺陷修复
- **展开状态持久化修复**: 修复了一个严重的静默数据丢失 Bug —— `saveExpandedFolders` 函数体为空，导致文件夹树的展开状态在重启后从未被写入磁盘。
- **缩略图质量设置生效**: 修复了 preload 桥接层丢失 `size` 参数的问题，现在用户在设置中调整的缩略图质量会实际生效。
- **标签路径遮蔽**: 移除了 `move-items` IPC 处理器中局部重声明的 `fileTagsPath`，统一使用全局变量。
- **清理死代码**: 移除了 `App.jsx` 中声明但从未绑定到窗口的 `beforeunload` 处理器。

### 🛡️ 安全与健壮性
- **Shell 注入防护**: 将 PowerShell 剪贴板命令包裹在脚本块 (`& { ... }`) 中，防止文件路径中的特殊字符被错误解析。

### ⚡ 性能优化
- **缩略图缓存清理**: 优化了文件夹缩略图缓存清理逻辑，从"每个文件读一次缓存目录"降为"只读一次"，大幅减少大文件夹下的 I/O 次数。
- **滚轮监听稳定性**: 重构了网格缩放的滚轮事件处理，改用 ref 读取选中状态，避免每次选中变化时重复注册/注销监听器。
- **顶层模块引入**: 将 `require('url')` 和重复的 `require('crypto')` 统一移至文件顶部。

### 🧹 代码整理
- 清除了 `BottomPanel`、`main.cjs` 剪贴板处理器中残留的调试日志。
- 清除了 `ImageGrid.jsx` 中 ~40 行过时的设计思考注释和重复注释行。
- 移除了 `Panel.jsx` 中未使用的 `onDelete` 属性。
- 移除了 `Sidebar.jsx` 中的 Sponsor 按钮。
- 删除了遗留的测试文件（`hsl_test.js`、`electron/test.jpg`、`electron/test2.jpg`）。

## v0.9.0 - The Color & Workflow Update

### ✨ New Features
- **Color Tagging System**: Introduced a complete macOS-style color tagging system with high-visibility indicators on thumbnails.
- **Global Color Management**: Added a new bottom panel UI to quickly assign, filter, and clear color tags globally.
- **Sponsor Module**: Integrated an elegant Sponsor button in the sidebar to support open-source development.

### 🎨 UX & Interactions
- **Smart Zoom Anchoring**: The grid layout zoom focus now dynamically anchors exactly onto the user's active selection.
- **New Shortcut `P`**: Quickly toggle the AI prompt metadata view in the active panel.
- **New Shortcut `F`**: Enable multi-selection "favored/unfavored" state toggling directly in the grid view.
- **Multi-Panel Indicators**: Added blue/gray active state selection indicators for better Multi-panel clarity.

### 💾 Persistence & Maintenance
- **State Memory**: YiziView now persists main window dimensions, positions, maximization state, and specific folder grid aspect ratios across app restarts.
- **Enhanced Backups**: The backup payload now exports all custom UI states (sidebar width, viewer split dimensions).

---
*(中文版更新日志)*

### ✨ 全新功能
- **颜色标签系统**: 引入全新系统级高级颜色标签，高可视度指示器彻底改变图片视觉管理体验。
- **全局色彩管理**: 底部新增颜色全局调度面板，支持一键快捷分配、筛选和全量清空标签。
- **赞助支持模块**: 在侧边栏底部优雅地加入打赏入口，为独立开发者和开源事业充能。

### 🎨 交互与体验优化
- **智能缩放跟随**: 彻底重写网格缩放逻辑，在滚轮缩放时焦点将完美锚定在当前选中的图片上。
- **全新快捷键 `P`**: 选中图片后按 `P`，可在主视图极速开关 AI 生成提示词信息面板。
- **全新快捷键 `F`**: 网格模式下选中多张图片后按 `F`，可一键批量将它们标记为心形收藏/取消收藏。
- **多面板状态指示**: 为分屏模式加入清晰的蓝/灰主副焦点高亮边框，大幅增强复杂操作下的指向明确性。

### 💾 记忆与稳定性增强
- **状态持久化**: 加强了程序的肌肉记忆，重启应用后会无缝恢复主窗口尺寸布局、最大化状态，以及不同文件夹单独设定的纵横比例。
- **超强备份恢复**: 本地项目备份包得到了底层增强，现在打包数据时会完整包含并恢复用户的自定义界面配置（如侧边栏分割宽度、主副面板尺寸）。
