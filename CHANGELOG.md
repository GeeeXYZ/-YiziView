# CHANGELOG

## v0.9.1

🐛 Fixes
- Fix expanded folders never persisting to disk (empty save function)
- Fix thumbnail quality setting ignored (preload bridge dropped size param)
- Fix fileTagsPath local shadowing in move-items handler
- Harden PowerShell clipboard command against special chars

⚡ Perf
- Read thumbnail cache dir once instead of per-file during folder clear
- Use ref for grid zoom wheel handler to avoid re-registering on selection change

🧹 Cleanup
- Remove debug logs, stale comments, unused props, orphaned test files
- Remove Sponsor button from sidebar

---

🐛 修复
- 修复展开状态从未写入磁盘（save 函数体为空）
- 修复缩略图质量设置无效（preload 桥丢失 size 参数）
- 修复 move-items 中 fileTagsPath 局部遮蔽全局变量
- 加固 PowerShell 剪贴板命令防特殊字符问题

⚡ 性能
- 清理缩略图缓存时只读一次缓存目录而非逐文件读取
- 网格缩放滚轮改用 ref 读取选中状态，避免重复注册监听器

🧹 整理
- 清除残留调试日志、过时注释、未用属性、遗留测试文件
- 移除侧边栏 Sponsor 按钮


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
