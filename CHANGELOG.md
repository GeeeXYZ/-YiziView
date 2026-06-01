# CHANGELOG

## v0.9.15

✨ Features
- Add Mac app icon and hardened runtime entitlements for Notarization

---

✨ 新特性
- 添加 Mac 版应用图标及用于公证的强化运行时配置


## v0.9.14

✨ Features
- Clear V8 Code Cache and HTTP Cache on startup to avoid plugin code contamination
- Clear stale localStorage keys on plugin OTA swap
- Reorder startup sequence to ensure correct OTA plugin initialization and cache busting

🐛 Fixes
- Fix OTA file swap EBUSY locks on Windows
- Fix potential duplicate plugin folder watcher registration

---

✨ 新特性
- 启动时自动清理 V8 字节码缓存与 HTTP 缓存，防止旧插件代码残留污染
- 插件热更新（OTA）后自动清理本地 localStorage 存储
- 重排启动初始化顺序，确保 OTA 模块先替换后清空缓存

🐛 修复
- 修复 Windows 系统下 OTA 文件替换时 EBUSY 占用锁死问题
- 修复插件目录可能重复注册监听器的问题


## v0.9.13

🐛 Fixes
- Fix residual ReactCrop shadow mask persisting when switching to brush or adjust tools

---

🐛 修复
- 修复了在裁切模式下切换到画笔或调节工具时，裁切框的半透明阴影遮罩依然残留在界面上的体验问题


## v0.9.12

🐛 Fixes
- Fixed crop tool visual and coordinate offset bugs caused by ReactCrop layout nesting
- Fixed GitHub Actions release build missing plugins by using `build:extra`

---

🐛 修复
- 彻底修复了由于 ReactCrop 底层嵌套结构改变导致的严重裁切坐标偏移问题，并优化了画笔工具的无缝切换体验
- 修复了远端自动打包发版时遗漏打包外部插件的问题，已切换至 `build:extra` 引擎


## v0.9.11

✨ Features
- Fully integrated AI Background Remover into YiziView (Sidebar & right-click Context Menu)
- Support for BRIA RMBG-1.4 model with WebGPU/CPU switching
- Added Alpha Cutoff slider for edge defringing and letterbox padding for distortion-free extraction
- Implemented global queue manager with floating progress UI for batch background removal

🐛 Fixes
- Fixed plugin dropdown menu duplicate actions bug
- Fixed model inference distortion on non-square images

---

✨ 新特性
- 全面集成 AI 抠图插件至主界面（侧边栏与右键菜单）
- 新增 BRIA RMBG-1.4 顶尖模型支持，并提供 WebGPU/CPU 无缝切换
- 新增 Alpha 切断（边缘净化）滑块与防畸变算法，实现矢量级平滑边缘
- 增加全局队列管理器与悬浮进度条，支持无感批量抠图

🐛 修复
- 修复了顶部插件下拉菜单中选项重复加载的 Bug
- 修复了模型推理时非正方形图片产生几何畸变的问题


## v0.9.10

✨ Features
- Add dynamic aspect ratio locking for free mode crop
- Full Chinese localization for the image viewer tools and settings

🐛 Fixes
- Fix settings modal UI toggles failing to visually update 
- Prevent bottom panel flickering during image switching
- Fix syntax error with useTranslation import causing black screen

🧹 Cleanup
- Refactor SettingRow component to prevent React unmounting

---

✨ 新特性
- 在自由裁切模式下增加动态比例锁定功能
- 为全图预览工具栏及设置页面提供完整中文汉化

🐛 修复
- 修复设置面板开关点击后界面状态未更新的问题
- 防止在切换图片时底部信息面板发生闪烁
- 修复因 useTranslation 导入语法错误导致的黑屏问题

🧹 清理
- 重构 SettingRow 组件以防止 React 重复卸载及导致的动画失效


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
