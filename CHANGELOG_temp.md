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
