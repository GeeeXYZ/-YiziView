# YiziView 全球推广与变现物料库

> 老板专属文档！随时备用，复制即发。

## 📍 1. 软件内赞助入口 & GitHub 配置 (已完成)

已在 `src/components/Sidebar.jsx` 底部自动添加了精美的玻璃质感“赞助”按钮。
如果不小心删掉了，或者还要配置 GitHub 主页右上角的 Sponsor 按钮，只需在代码库根目录新建 `.github/FUNDING.yml` 并填入一行字：
```yaml
github: GeeeXYZ
```

---

## 👽 2. Reddit (发在 r/StableDiffusion) - “暴躁炼丹师”风格

**标题 (Title):** 
`Got sick of paying for slow image viewers, so I built YiziView: A blazing fast, free alternative to Eagle that actually reads ComfyUI prompts.`

**正文 (Body):**
Yo. If your SSD is currently crying under the weight of 50,000+ AI generations and scattered prompts like mine was, hear me out. 

Standard OS image viewers choke and die when you open a massive folder. Paid tools like Eagle are okay, but I hate paying for stuff and they absolutely suck at AI workflows. So I got mad, drank too much coffee, and built **YiziView**. It’s open-source, and it's stupid fast. 

**The TL;DR of why you might want to try it:**
1. **Reads your AI spaghetti:** Click an image, and it immediately extracts and displays the ComfyUI or SD webui prompts/seeds in the sidebar. No more dragging PNGs back into the browser just to see what prompt you used 3 weeks ago.
2. **Smooth as butter:** It pre-caches thumbnails via `sharp`. You can scroll through a 100k image folder without your PC sounding like a jet engine. 
3. **Color Tags:** I just added Mac-style color tagging because visually grouping good seeds by color makes my monkey brain happy.

It's completely free for personal use. Throw your bloated viewers in the trash and give it a spin. 

**Repo here:** https://github.com/GeeeXYZ/-YiziView

Let me know if you run into bugs or what features I should add next!

---

## 🚀 3. Product Hunt - “直击痛点的高效 Maker”风格

**Name:** YiziView
**Tagline:** The free, blazing-fast Eagle alternative that reads AI prompts.

**Description:**
Let's be real: your current image viewer probably lags when you open a folder with 50,000+ AI generations. And it definitely doesn't know what a ComfyUI prompt is. 

I built YiziView out of pure frustration. It's a high-performance, open-source image browser designed for the AI workflow era.

- 🚀 **Zero-lag scrolling** (even with 100k+ images) thanks to aggressive background caching.
- 🤖 **Instant Prompt Extraction**: It reads your hidden Stable Diffusion/ComfyUI parameters from PNG metadata instantly.
- 🎨 **Premium UI**: Beautiful glassmorphism design with a new Color-Tagging system for ultimate organization.

Save your money, ditch the bloated software, and organize your chaotic asset folders elegantly. Free for personal use. I'd love to hear your roasts and feedback!

---

## 🔥 4. V2EX / 掘金 发帖文案 (国内引流吸 Star 神器)

**标题:** [造轮子发布] 苦恼已有看图软件又重又收费？我手搓了一个极其丝滑的 Eagle 开源平替，专为 AI 创作者设计！

**正文:**
大家好，我是 YiziView 的开发者。

平时玩 AI 绘画和做设计，本地囤了十几万张参考图。传统看图工具面对海量图片常常卡顿，且完全不懂 AI（没法直接看图片里隐藏的 ComfyUI 提示词）。
于是我用 Electron + React 手撸了 **YiziView**。初衷很简单：**要快、要好看、要懂 AI。**

**核心亮点：**
- 🏎️ **离谱的性能体验**：底层用 `Sharp` 预生成缩略图+磁盘缓存，前端智能懒加载。亲测拉起 5 万张图的文件夹，顺滑滚动毫无压力。
- 🔮 **原生提示词解析**：选中图片，侧边栏直接显示这批图的 ComfyUI / SD 提示词配置（魔法师看图必备）。
- 🎨 **高级感拉满的 UI**：暗黑毛玻璃风格，以及类似 macOS 理念的颜色标签 (Color Tagging) 管理系统。

完全免费（个人非商用），欢迎下载体验，轻喷~ 有任何想要的功能可以直接留言，我肝给你！

**开源地址（欢迎 Star 🌟 & 提 Issue）：**
🔗 https://github.com/GeeeXYZ/-YiziView
