# Yizi-studio-AIstudio 插件全量代码审计与架构评估报告

## 一、 架构总览与“第一性原理”遵守情况

总体而言，本插件采用了一种**“免构建（Buildless）、高便携”**的极简 React 挂载架构。该架构直接将 `React.createElement` 封装为 `el` 并在浏览器运行时执行，彻底摆脱了 Webpack/Vite 捆绑和 `node_modules` 的包袱。

**✅ 符合第一性原理的优秀设计：**
1. **0 依赖分发**：以最纯粹的 `.js` 文本发送给宿主 (YiziView)，没有额外的解释成本。
2. **STS直签上传** (`utils.js`)：放弃让服务器做中转站，直接利用 STS 换取临时 Token，让前端直连阿里云 OSS，降低了服务器带宽和延时，这是最原教旨主义的云存储用法。
3. **推拉结合的智能轮询** (`backgroundPoller.js`)：抛弃了重量级的 WebSocket 维持，针对微信小程序体系后端打造了 `Coarse Fp` (粗粒度对比) + `Deep Fp Map` (图片树对比) 的二维极简对比法，能以极低代价准确捕捉微小状态（如新增重绘图）。
4. **事件总线解耦**：通过原生的 `CustomEvent` 实现非 React 树通信，符合跨窗口扩展件的标准隔离做法。

---

## 二、 模块化严重失衡诊断 (重度警告)

目前项目虽然已经拆分出了 `tabs` (HistoryTab, OrderDetailTab, SettingsTab) 和 `components` (FullScreenViewer)，完成了视图层的第一波抽象，但**核心入口依然是个“上帝对象”**。

**🚨 `OrderCenterWidget.js` 巨石阵现象：**
- 文件长度达到 **1160余行**，文件体积 62KB。
- 该文件内聚集了超过 **30 个 `useState`** 钩子。
- 虽然外部抽离了其他 Tab，但 `renderCreateTab`（即主“创建”界面）内的全流程：“上传(renderUploadZone) -> 模型(renderModelSelection) -> 模板(renderTemplateSelection) -> 提交” 全都在这一文件内。
- **违背解耦原则**：随着模型过滤、标签交互的增加，该文件在未来更新时牵一发而动全身。当组件内部任何一个微小的 State 改变时，整个 DOM 树面临重绘风险。

---

## 三、 冗余代码与废弃物审查

1. **废弃无用文件**：
   - 根目录下存在一个 `API_Dump_Results.json` (25.4KB)，这是一个数据快照/缓存文件。在生产环境发布的插件中毫无作用，徒增沙盒体积要求。
2. **状态管理迂回补丁**：
   - 在 `OrderCenterWidget.js` 中有大量的 `let active = true; return () => { active = false; };` 。这是防内存泄漏的临时打补丁做法，但在同一组件发生数十次同样的挂载清理，十分冗长迂回。
3. **入口热更残留**：
   - `renderer.js` 内部大段针对 `window.__OrderCenterWidget` 的热备清理代码。在进入生产更新模式后，这种防全局污染的神奇写法应该用规范的作用域切断，而不是依赖全局覆盖。

---

## 四、 核心优化与重构路线图 (Roadmap)

建议按以下路线对代码进行“排毒”，使其长期可维护性达到顶级商业插件水平：

### 第 1 步：大动脉拆解（降低圈复杂度）
- 将 `renderUploadZone`、`renderModelSelection`、`renderTemplateSelection` 彻底剥离出 `OrderCenterWidget.js`，移至新的子组件目录（如 `tabs/CreateTab/`）。
- 将散落的 30 多个 `useState` 收拢为 `useReducer` 或 `Context Provider`，以统一的 Reducer 字典模式流转“当前订单配置”。

### 第 2 步：剥离 `utils.js` 并发职责
- 目前工具集兼顾业务接口(`getPoints`)与 SDK 直传。应一分为二为：`api/services.js` (业务请求) 和 `core/ossClient.js` (文件直传)，使网络模块严格符合单一职责。

### 第 3 步：强生命周期闭环
- 在与 YiziView 的 `addEventListener` 通讯中，因为部分事件挂载在 Window，为避免闭包泄漏，应实现通用的 `useEventListener` Hook，在卸载时执行无死角的精准内存回收。
