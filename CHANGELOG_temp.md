## v0.9.12

🐛 Fixes
- Fixed crop tool visual and coordinate offset bugs caused by ReactCrop layout nesting
- Fixed GitHub Actions release build missing plugins by using `build:extra`

---

🐛 修复
- 彻底修复了由于 ReactCrop 底层嵌套结构改变导致的严重裁切坐标偏移问题，并优化了画笔工具的无缝切换体验
- 修复了远端自动打包发版时遗漏打包外部插件的问题，已切换至 `build:extra` 引擎
