## v0.9.20

✨ Features
- Release v0.9.20 to test and verify the Windows auto-update feature

---

✨ 新特性
- 发布 v0.9.20，用于测试并验证 Windows 客户端的自动更新机制是否恢复正常

## v0.9.19

🐛 Fixes
- Fix Windows builds being incorrectly signed with macOS certificates causing auto-update failures

---

🐛 修复
- 修复 Windows 安装包被错误打上苹果开发者签名，导致自动更新组件校验失败崩溃的问题

## v0.9.18

✨ Features
- Add `readWorkflowDir` IPC method for AIToolkit to read workflow JSONs

---

✨ 新特性
- 增加 `readWorkflowDir` IPC 方法，支持 AIToolkit 读取本地工作流 JSON 文件

## v0.9.17

✨ Features
- Add temperature adjustment slider to image editor

🐛 Fixes
- Fix color wheel aspect ratio deformation in small screens

---

✨ 新功能
- 图像编辑器新增色温调节滑块

🐛 修复
- 修复小屏幕下色彩分级面板中的色轮拉伸变形问题

## v0.9.16

馃悰 Fixes
- Fix severe offset and aspect ratio distortion bugs in the Crop tool caused by CSS layout constraints

---
馃悰 淇
- 褰诲簳淇鐢变簬CSS甯冨眬绾︽潫瀵艰嚧鐨勮鍒囧伐鍏蜂弗閲嶅亸绉诲拰姣斾緥鍙樺舰Bug

# CHANGELOG

## v0.9.15

鉁?Features
- Add Mac app icon and hardened runtime entitlements for Notarization

---

鉁?鏂扮壒鎬?- 娣诲姞 Mac 鐗堝簲鐢ㄥ浘鏍囧強鐢ㄤ簬鍏瘉鐨勫己鍖栬繍琛屾椂閰嶇疆


## v0.9.14

鉁?Features
- Clear V8 Code Cache and HTTP Cache on startup to avoid plugin code contamination
- Clear stale localStorage keys on plugin OTA swap
- Reorder startup sequence to ensure correct OTA plugin initialization and cache busting

馃悰 Fixes
- Fix OTA file swap EBUSY locks on Windows
- Fix potential duplicate plugin folder watcher registration

---

鉁?鏂扮壒鎬?- 鍚姩鏃惰嚜鍔ㄦ竻鐞?V8 瀛楄妭鐮佺紦瀛樹笌 HTTP 缂撳瓨锛岄槻姝㈡棫鎻掍欢浠ｇ爜娈嬬暀姹℃煋
- 鎻掍欢鐑洿鏂帮紙OTA锛夊悗鑷姩娓呯悊鏈湴 localStorage 瀛樺偍
- 閲嶆帓鍚姩鍒濆鍖栭『搴忥紝纭繚 OTA 妯″潡鍏堟浛鎹㈠悗娓呯┖缂撳瓨

馃悰 淇
- 淇 Windows 绯荤粺涓?OTA 鏂囦欢鏇挎崲鏃?EBUSY 鍗犵敤閿佹闂
- 淇鎻掍欢鐩綍鍙兘閲嶅娉ㄥ唽鐩戝惉鍣ㄧ殑闂


## v0.9.13

馃悰 Fixes
- Fix residual ReactCrop shadow mask persisting when switching to brush or adjust tools

---

馃悰 淇
- 淇浜嗗湪瑁佸垏妯″紡涓嬪垏鎹㈠埌鐢荤瑪鎴栬皟鑺傚伐鍏锋椂锛岃鍒囨鐨勫崐閫忔槑闃村奖閬僵渚濈劧娈嬬暀鍦ㄧ晫闈笂鐨勪綋楠岄棶棰?

## v0.9.12

馃悰 Fixes
- Fixed crop tool visual and coordinate offset bugs caused by ReactCrop layout nesting
- Fixed GitHub Actions release build missing plugins by using `build:extra`

---

馃悰 淇
- 褰诲簳淇浜嗙敱浜?ReactCrop 搴曞眰宓屽缁撴瀯鏀瑰彉瀵艰嚧鐨勪弗閲嶈鍒囧潗鏍囧亸绉婚棶棰橈紝骞朵紭鍖栦簡鐢荤瑪宸ュ叿鐨勬棤缂濆垏鎹綋楠?- 淇浜嗚繙绔嚜鍔ㄦ墦鍖呭彂鐗堟椂閬楁紡鎵撳寘澶栭儴鎻掍欢鐨勯棶棰橈紝宸插垏鎹㈣嚦 `build:extra` 寮曟搸


## v0.9.11

鉁?Features
- Fully integrated AI Background Remover into YiziView (Sidebar & right-click Context Menu)
- Support for BRIA RMBG-1.4 model with WebGPU/CPU switching
- Added Alpha Cutoff slider for edge defringing and letterbox padding for distortion-free extraction
- Implemented global queue manager with floating progress UI for batch background removal

馃悰 Fixes
- Fixed plugin dropdown menu duplicate actions bug
- Fixed model inference distortion on non-square images

---

鉁?鏂扮壒鎬?- 鍏ㄩ潰闆嗘垚 AI 鎶犲浘鎻掍欢鑷充富鐣岄潰锛堜晶杈规爮涓庡彸閿彍鍗曪級
- 鏂板 BRIA RMBG-1.4 椤跺皷妯″瀷鏀寔锛屽苟鎻愪緵 WebGPU/CPU 鏃犵紳鍒囨崲
- 鏂板 Alpha 鍒囨柇锛堣竟缂樺噣鍖栵級婊戝潡涓庨槻鐣稿彉绠楁硶锛屽疄鐜扮煝閲忕骇骞虫粦杈圭紭
- 澧炲姞鍏ㄥ眬闃熷垪绠＄悊鍣ㄤ笌鎮诞杩涘害鏉★紝鏀寔鏃犳劅鎵归噺鎶犲浘

馃悰 淇
- 淇浜嗛《閮ㄦ彃浠朵笅鎷夎彍鍗曚腑閫夐」閲嶅鍔犺浇鐨?Bug
- 淇浜嗘ā鍨嬫帹鐞嗘椂闈炴鏂瑰舰鍥剧墖浜х敓鍑犱綍鐣稿彉鐨勯棶棰?

## v0.9.10

鉁?Features
- Add dynamic aspect ratio locking for free mode crop
- Full Chinese localization for the image viewer tools and settings

馃悰 Fixes
- Fix settings modal UI toggles failing to visually update 
- Prevent bottom panel flickering during image switching
- Fix syntax error with useTranslation import causing black screen

馃Ч Cleanup
- Refactor SettingRow component to prevent React unmounting

---

鉁?鏂扮壒鎬?- 鍦ㄨ嚜鐢辫鍒囨ā寮忎笅澧炲姞鍔ㄦ€佹瘮渚嬮攣瀹氬姛鑳?- 涓哄叏鍥鹃瑙堝伐鍏锋爮鍙婅缃〉闈㈡彁渚涘畬鏁翠腑鏂囨眽鍖?
馃悰 淇
- 淇璁剧疆闈㈡澘寮€鍏崇偣鍑诲悗鐣岄潰鐘舵€佹湭鏇存柊鐨勯棶棰?- 闃叉鍦ㄥ垏鎹㈠浘鐗囨椂搴曢儴淇℃伅闈㈡澘鍙戠敓闂儊
- 淇鍥?useTranslation 瀵煎叆璇硶閿欒瀵艰嚧鐨勯粦灞忛棶棰?
馃Ч 娓呯悊
- 閲嶆瀯 SettingRow 缁勪欢浠ラ槻姝?React 閲嶅鍗歌浇鍙婂鑷寸殑鍔ㄧ敾澶辨晥


## v0.9.9

馃悰 Fixes
- Fix local plugin asset loading by directly reading files to bypass cache and MIME type issues

---

馃悰 淇
- 淇鏈湴鎻掍欢璧勬簮鍔犺浇锛岄€氳繃鐩存帴璇诲彇鏂囦欢鏉ョ粫杩囩紦瀛樺拰 MIME 绫诲瀷闂


## v0.9.8

鉁?Features
- Add PluginManager for dynamic electron plugin loading
- Update ImageViewer and usePanelState for better rendering stability

馃Ч Cleanup
- Remove obsolete legacy yizi-studio embedded plugin
- Clean up workspace and ignored file handling

---

鉁?鏂扮壒鎬?- 澧炲姞 PluginManager 鏀寔鍔ㄦ€佸姞杞?Electron 鎻掍欢
- 浼樺寲 ImageViewer 鍙婂叾鐘舵€侀挬瀛愪互淇濊瘉娓叉煋绋冲畾鎬?
馃Ч 娓呯悊
- 褰诲簳绉婚櫎鏃х増鐨勫唴缃?yizi-studio 绛夊啑浣欐彃浠朵唬鐮?- 娓呯悊澶氫綑鐨勫伐浣滃尯涓庡拷鐣ユ枃浠?

## v0.9.7

鉁?Features
- Redesigned penetration mode UI to a minimalist hollow wireframe
- Penetration mode sub-folders now natively pin to the top when sorting

鈿?Perf
- Rebuilt recursive folder scanner using BFS engine to solve `EMFILE` limits and enable instant massive deep-tree loading

馃悰 Fixes
- Fixed React duplicate key crash when sorting images in penetration mode
- Fixed selection box highlighting drift when spacer grids are injected
- Prevented accidental file flattening when dropping an image inside the same penetrated grid

---

鉁?鏂扮壒鎬?- 灏嗙┛閫忔ā寮忕殑鐣岄潰瑙嗚閲嶆瀯涓烘瀬绠€閫忔槑閲戝睘缃戞牸
- 绌块€忔ā寮忎笅鐨勫瓙鏂囦欢澶规爣棰樼幇鍦ㄤ細鍦ㄦ帓搴忔椂鑷姩缃《

鈿?鎬ц兘
- 褰诲簳浣跨敤骞垮害浼樺厛鎼滅储鏋舵瀯閲嶆瀯閫掑綊鎺㈤拡锛岃В鍐崇郴缁熺骇 EMFILE 骞跺彂涓婇檺宕╂簝锛屽疄鐜版捣閲忔繁灞傛枃浠剁灛鏃跺姞杞?
馃悰 淇
- 淇浜嗗湪绌块€忔ā寮忎笅瑙﹀彂鎺掑簭寮曟搸鏃跺鑷寸殑 React UI 濂楀▋鍏嬮殕涓庡穿婧冮棶棰?- 淇浜嗗洜涓哄鍔犲崰浣嶇綉鏍兼椂瀵艰嚧鐨勫簳灞傝瑙夌偣浜潗鏍囧亸绉婚棶棰?- 鎷︽埅浜嗗皢鍥剧墖涓㈠叆鎵€灞炲悓涓€涓┛閫忕綉缁滆嚜韬椂鐨勬墎骞冲寲鐮村潖鐜拌薄

## v0.9.6

鉁?Features
- Add global deep folder search with fast backend execution
- Enable zoom and pan in 'crop' editing mode
- Add "collapse all folders" shortcut to the sidebar
- Redesign sidebar layout, renaming "Quick Access" to "Folders"

馃悰 Fixes
- Prevent recursive tree expansion bloat during folder searches

---

鉁?鏂扮壒鎬?- 澧炲姞鍏ㄥ眬娣卞眰鐩綍妫€绱㈠姛鑳斤紝搴曞眰楂橀€熸壂鎻?- 鏀寔鍦ㄢ€滆鍓?Crop)鈥濇ā寮忎笅閫氳繃婊氳疆缂╂斁涓庝腑閿钩绉荤敾闈?- 渚ц竟鏍忓鍔犫€滀竴閿姌鍙犳墍鏈夋枃浠跺す鈥濆揩鎹锋寜閽?- 浼樺寲渚ц竟鏍忓竷灞€锛屽皢鈥滃揩鎹疯闂€濇洿鍚嶄负鈥淔olders鈥濆苟璋冩暣浣嶇疆

馃悰 淇
- 淇鍥犳悳绱㈠鑷寸殑 DOM 鏍戣寮哄埗閫掑綊 10 灞傚睍寮€鐨勬€ц兘鍗￠】闂


## v0.9.5

馃悰 Fixes
- Fix toolbar not resetting to center position when toggled
- Remove extraneous bottom border line on collapsed edit toolbar

---

馃悰 淇
- 淇宸ュ叿鏍忛噸鏂版縺娲绘椂鏈仮澶嶅埌灞忓箷涓績浣嶇疆鐨勯棶棰?- 绉婚櫎鏈睍寮€鐨勫浘鐗囧伐鍏锋爮搴曢儴澶氫綑鐨勭嚎鏉?
## v0.9.4

鉁?Features
- Add a silent payload to test blockmap differential update system speed

馃悰 Fixes
- Validate zero-delta updater pipeline functionality

---

鉁?馃啎 鏂扮壒鎬?- 娉ㄥ叆鏋佸皬娴嬭瘯杞借嵎锛岀敤浜庨獙璇佸苟浣撻獙鍏ㄦ柊鍩轰簬鍧楀浘鐨勬瀬閫熷樊閲忔洿鏂扮郴缁?
馃悰 淇
- 纭繚浠?0.9.3 璺冭縼鐨勫悗缁増鏈笉鍐嶈繘琛岀櫨鍏嗙骇鍒笅杞?
## v0.9.3

鉁?Features
- Enable differential NSIS Blockmap compression to radically reduce delta update sizes in the future

馃悰 Fixes
- Fix electron-builder artifact naming variables to correctly sanitize executable filenames
- Remove orphaned temporary release documentation from repository tree

---

鉁?馃啎 鏂扮壒鎬?- 姝ｅ紡瑙ｅ皝搴曞眰鍩虹瀛楀吀鍘嬬缉锛屽叏闈㈡縺娲?NSIS Blockmap 鏃犵紳宸噺鏇存柊寮曟搸锛屾瀬澶у寲缂╁噺鏈潵鏇存柊涓嬭浇浣撶Н

馃悰 淇
- 淇骞惰鑼冧簡鎵撳寘搴曞眰鐨勫叏灞€鐗╃悊鍛藉悕瑙勫垯锛屾秷闄や簡璺ㄧ郴缁熶笅杞藉洜绌烘牸绛夌壒娈婂瓧绗﹀鑷寸殑鍋跺彂 404 涓柇
- 鍏ㄩ潰娓呴櫎浜嗕笂涓懆鏈熼仐鐣欏湪浠ｇ爜鏍戜腑鐨勫绔嬩复鏃跺彂甯冩枃绋?

## v0.9.2

鉁?Features
- Add native lightbox preview integration for YiziStudio generated imagery
- Global TopBar architecture for flawless window dragging and window controls stability

馃悰 Fixes
- Fix YiziStudio preview grids to respect native aspect-ratio instead of forced squares
- Fix UI layout bug where opening right dock squished the top menu

鈿?Perf
- Upgrade file processing to buffered memory to completely eliminate NTFS lock issues
- Streamline generation UX by removing blocking alert popups

---

鉁?馃啎 鏂扮壒鎬?- 鏀寔 YiziStudio 鎻掍欢鐢熸垚缁撴灉鐩存帴璋冪敤鍘熺敓绾у叏灞忓ぇ鐏
- 閲嶆瀯鍏ㄥ眬椤堕儴鏍忔灦鏋勶紝纭繚鏍囬鏍忓拰鍙充晶鑿滃崟鍦ㄧ缉鏀惧拰鍞ゅ嚭鎻掍欢鍧炴椂鍧氳嫢纾愮煶

馃悰 淇
- 淇骞舵斁寮€浜?YiziStudio 鐢熸垚缁撴灉琚揩鍘嬬缉涓烘鏂瑰舰鐨勬浜ら檺鍒讹紝鎸夊師姣斾緥灞曠ず
- 淇浜嗕晶杈规彃浠跺潪鍛煎嚭鏃讹紝椤堕儴鍏ㄥ眬鑿滃崟鏍忚鎸ゅ帇鍋忕Щ鐨勯棶棰?
鈿?鎬ц兘
- 搴曞眰寮哄垏 Buffer 鍐呭瓨璇诲彇绛栫暐锛屼粠婧愬ご涓婄矇纰?Windows 鏂囦欢閿佸畾瀵艰嚧鏃犳硶璇诲啓鐨勬閿佹紡娲?- 绉婚櫎浜嗙敓鎴愮粨鏉熸椂鐨勯樆鏂紡寮圭獥锛屽甫鏉ヨ浜戞祦姘磋埇鐨勮窇鍥句綋楠?

## v0.9.1

馃悰 Fixes
- Fix expanded folders never persisting to disk (empty save function)
- Fix thumbnail quality setting ignored (preload bridge dropped size param)
- Fix fileTagsPath local shadowing in move-items handler
- Harden PowerShell clipboard command against special chars

鈿?Perf
- Read thumbnail cache dir once instead of per-file during folder clear
- Use ref for grid zoom wheel handler to avoid re-registering on selection change

馃Ч Cleanup
- Remove debug logs, stale comments, unused props, orphaned test files
- Remove Sponsor button from sidebar

---

馃悰 淇
- 淇灞曞紑鐘舵€佷粠鏈啓鍏ョ鐩橈紙save 鍑芥暟浣撲负绌猴級
- 淇缂╃暐鍥捐川閲忚缃棤鏁堬紙preload 妗ヤ涪澶?size 鍙傛暟锛?- 淇 move-items 涓?fileTagsPath 灞€閮ㄩ伄钄藉叏灞€鍙橀噺
- 鍔犲浐 PowerShell 鍓创鏉垮懡浠ら槻鐗规畩瀛楃闂

鈿?鎬ц兘
- 娓呯悊缂╃暐鍥剧紦瀛樻椂鍙涓€娆＄紦瀛樼洰褰曡€岄潪閫愭枃浠惰鍙?- 缃戞牸缂╂斁婊氳疆鏀圭敤 ref 璇诲彇閫変腑鐘舵€侊紝閬垮厤閲嶅娉ㄥ唽鐩戝惉鍣?
馃Ч 鏁寸悊
- 娓呴櫎娈嬬暀璋冭瘯鏃ュ織銆佽繃鏃舵敞閲娿€佹湭鐢ㄥ睘鎬с€侀仐鐣欐祴璇曟枃浠?- 绉婚櫎渚ц竟鏍?Sponsor 鎸夐挳


## v0.9.0 - The Color & Workflow Update

### 鉁?New Features
- **Color Tagging System**: Introduced a complete macOS-style color tagging system with high-visibility indicators on thumbnails.
- **Global Color Management**: Added a new bottom panel UI to quickly assign, filter, and clear color tags globally.
- **Sponsor Module**: Integrated an elegant Sponsor button in the sidebar to support open-source development.

### 馃帹 UX & Interactions
- **Smart Zoom Anchoring**: The grid layout zoom focus now dynamically anchors exactly onto the user's active selection.
- **New Shortcut `P`**: Quickly toggle the AI prompt metadata view in the active panel.
- **New Shortcut `F`**: Enable multi-selection "favored/unfavored" state toggling directly in the grid view.
- **Multi-Panel Indicators**: Added blue/gray active state selection indicators for better Multi-panel clarity.

### 馃捑 Persistence & Maintenance
- **State Memory**: YiziView now persists main window dimensions, positions, maximization state, and specific folder grid aspect ratios across app restarts.
- **Enhanced Backups**: The backup payload now exports all custom UI states (sidebar width, viewer split dimensions).

---
*(涓枃鐗堟洿鏂版棩蹇?*

### 鉁?鍏ㄦ柊鍔熻兘
- **棰滆壊鏍囩绯荤粺**: 寮曞叆鍏ㄦ柊绯荤粺绾ч珮绾ч鑹叉爣绛撅紝楂樺彲瑙嗗害鎸囩ず鍣ㄥ交搴曟敼鍙樺浘鐗囪瑙夌鐞嗕綋楠屻€?- **鍏ㄥ眬鑹插僵绠＄悊**: 搴曢儴鏂板棰滆壊鍏ㄥ眬璋冨害闈㈡澘锛屾敮鎸佷竴閿揩鎹峰垎閰嶃€佺瓫閫夊拰鍏ㄩ噺娓呯┖鏍囩銆?- **璧炲姪鏀寔妯″潡**: 鍦ㄤ晶杈规爮搴曢儴浼橀泤鍦板姞鍏ユ墦璧忓叆鍙ｏ紝涓虹嫭绔嬪紑鍙戣€呭拰寮€婧愪簨涓氬厖鑳姐€?
### 馃帹 浜や簰涓庝綋楠屼紭鍖?- **鏅鸿兘缂╂斁璺熼殢**: 褰诲簳閲嶅啓缃戞牸缂╂斁閫昏緫锛屽湪婊氳疆缂╂斁鏃剁劍鐐瑰皢瀹岀編閿氬畾鍦ㄥ綋鍓嶉€変腑鐨勫浘鐗囦笂銆?- **鍏ㄦ柊蹇嵎閿?`P`**: 閫変腑鍥剧墖鍚庢寜 `P`锛屽彲鍦ㄤ富瑙嗗浘鏋侀€熷紑鍏?AI 鐢熸垚鎻愮ず璇嶄俊鎭潰鏉裤€?- **鍏ㄦ柊蹇嵎閿?`F`**: 缃戞牸妯″紡涓嬮€変腑澶氬紶鍥剧墖鍚庢寜 `F`锛屽彲涓€閿壒閲忓皢瀹冧滑鏍囪涓哄績褰㈡敹钘?鍙栨秷鏀惰棌銆?- **澶氶潰鏉跨姸鎬佹寚绀?*: 涓哄垎灞忔ā寮忓姞鍏ユ竻鏅扮殑钃?鐏颁富鍓劍鐐归珮浜竟妗嗭紝澶у箙澧炲己澶嶆潅鎿嶄綔涓嬬殑鎸囧悜鏄庣‘鎬с€?
### 馃捑 璁板繂涓庣ǔ瀹氭€у寮?- **鐘舵€佹寔涔呭寲**: 鍔犲己浜嗙▼搴忕殑鑲岃倝璁板繂锛岄噸鍚簲鐢ㄥ悗浼氭棤缂濇仮澶嶄富绐楀彛灏哄甯冨眬銆佹渶澶у寲鐘舵€侊紝浠ュ強涓嶅悓鏂囦欢澶瑰崟鐙瀹氱殑绾垫í姣斾緥銆?- **瓒呭己澶囦唤鎭㈠**: 鏈湴椤圭洰澶囦唤鍖呭緱鍒颁簡搴曞眰澧炲己锛岀幇鍦ㄦ墦鍖呮暟鎹椂浼氬畬鏁村寘鍚苟鎭㈠鐢ㄦ埛鐨勮嚜瀹氫箟鐣岄潰閰嶇疆锛堝渚ц竟鏍忓垎鍓插搴︺€佷富鍓潰鏉垮昂瀵革級銆?
