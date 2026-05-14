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
