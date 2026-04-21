# CHANGELOG

## v0.9.9

🐛 Fixes
- Fix local plugin asset loading by directly reading files to bypass cache and MIME type issues

---

🐛 修复
- 修复本地插件资源加载，通过直接读取文件来绕过缓存和 MIME 类型问题


## v0.9.8

✨ Features
- Add PluginManager for dynamic electron plugin loading
- Update ImageViewer and usePanelState for better rendering stability

🧹 Cleanup
- Remove obsolete legacy yizi-studio embedded plugin
- Clean up workspace and ignored file handling

---

✨ 新特性
- 增加 PluginManager 支持动态加载 Electron 插件
- 优化 ImageViewer 及其状态钩子以保证渲染稳定性

🧹 清理
- 彻底移除旧版的内置 yizi-studio 等冗余插件代码
- 清理多余的工作区与忽略文件


## v0.9.7

✨ Features
- Redesigned penetration mode UI to a minimalist hollow wireframe
- Penetration mode sub-folders now natively pin to the top when sorting

⚡ Perf
- Rebuilt recursive folder scanner using BFS engine to solve `EMFILE` limits and enable instant massive deep-tree loading

🐛 Fixes
- Fixed React duplicate key crash when sorting images in penetration mode
- Fixed selection box highlighting drift when spacer grids are injected
- Prevented accidental file flattening when dropping an image inside the same penetrated grid

---

✨ 新特性
- 将穿透模式的界面视觉重构为极简透明金属网格
- 穿透模式下的子文件夹标题现在会在排序时自动置顶

⚡ 性能
- 彻底使用广度优先搜索架构重构递归探针，解决系统级 EMFILE 并发上限崩溃，实现海量深层文件瞬时加载

🐛 修复
- 修复了在穿透模式下触发排序引擎时导致的 React UI 套娃克隆与崩溃问题
- 修复了因为增加占位网格时导致的底层视觉点亮坐标偏移问题
- 拦截了将图片丢入所属同一个穿透网络自身时的扁平化破坏现象

## v0.9.6

✨ Features
- Add global deep folder search with fast backend execution
- Enable zoom and pan in 'crop' editing mode
- Add "collapse all folders" shortcut to the sidebar
- Redesign sidebar layout, renaming "Quick Access" to "Folders"

🐛 Fixes
- Prevent recursive tree expansion bloat during folder searches

---

✨ 新特性
- 增加全局深层目录检索功能，底层高速扫描
- 支持在“裁剪(Crop)”模式下通过滚轮缩放与中键平移画面
- 侧边栏增加“一键折叠所有文件夹”快捷按钮
- 优化侧边栏布局，将“快捷访问”更名为“Folders”并调整位置

🐛 修复
- 修复因搜索导致的 DOM 树被强制递归 10 层展开的性能卡顿问题


## v0.9.5

🐛 Fixes
- Fix toolbar not resetting to center position when toggled
- Remove extraneous bottom border line on collapsed edit toolbar

---

🐛 修复
- 修复工具栏重新激活时未恢复到屏幕中心位置的问题
- 移除未展开的图片工具栏底部多余的线条

## v0.9.4

✨ Features
- Add a silent payload to test blockmap differential update system speed

🐛 Fixes
- Validate zero-delta updater pipeline functionality

---

✨ 🆕 新特性
- 注入极小测试载荷，用于验证并体验全新基于块图的极速差量更新系统

🐛 修复
- 确保从 0.9.3 跃迁的后续版本不再进行百兆级别下载

## v0.9.3

✨ Features
- Enable differential NSIS Blockmap compression to radically reduce delta update sizes in the future

🐛 Fixes
- Fix electron-builder artifact naming variables to correctly sanitize executable filenames
- Remove orphaned temporary release documentation from repository tree

---

✨ 🆕 新特性
- 正式解封底层基础字典压缩，全面激活 NSIS Blockmap 无缝差量更新引擎，极大化缩减未来更新下载体积

🐛 修复
- 修复并规范了打包底层的全局物理命名规则，消除了跨系统下载因空格等特殊字符导致的偶发 404 中断
- 全面清除了上个周期遗留在代码树中的孤立临时发布文稿


## v0.9.2

✨ Features
- Add native lightbox preview integration for YiziStudio generated imagery
- Global TopBar architecture for flawless window dragging and window controls stability

🐛 Fixes
- Fix YiziStudio preview grids to respect native aspect-ratio instead of forced squares
- Fix UI layout bug where opening right dock squished the top menu

⚡ Perf
- Upgrade file processing to buffered memory to completely eliminate NTFS lock issues
- Streamline generation UX by removing blocking alert popups

---

✨ 🆕 新特性
- 支持 YiziStudio 插件生成结果直接调用原生级全屏大灯箱
- 重构全局顶部栏架构，确保标题栏和右侧菜单在缩放和唤出插件坞时坚若磐石

🐛 修复
- 修复并放开了 YiziStudio 生成结果被迫压缩为正方形的正交限制，按原比例展示
- 修复了侧边插件坞呼出时，顶部全局菜单栏被挤压偏移的问题

⚡ 性能
- 底层强切 Buffer 内存读取策略，从源头上粉碎 Windows 文件锁定导致无法读写的死锁漏洞
- 移除了生成结束时的阻断式弹窗，带来行云流水般的跑图体验


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
