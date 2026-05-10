# Photo Manager - 鏋舵瀯璁捐瑙勮寖

## 涓€銆佸綋鍓嶆灦鏋勫垎鏋?
### 1.1 鐜扮姸

```
frontend/                          backend/
  App.jsx     (550琛? god缁勪欢)       routers/images.py (688琛? 鍗曚竴鏂囦欢)
  鈹溾攢 璇勫垎鐘舵€?                        鈹溾攢 鏂囦欢澶笴RUD
  鈹溾攢 鏂囨鐘舵€?                        鈹溾攢 鍥剧墖CRUD
  鈹溾攢 妯″瀷绠＄悊                         鈹溾攢 璇勫垎浠诲姟 + 绾跨▼
  鈹溾攢 鍥剧墖閫夋嫨                         鈹溾攢 缂╃暐鍥?浠ｇ悊
  鈹溾攢 棰勮/涓嬭浇                        鈹溾攢 鎵弿杩涘害
  鈹斺攢 鎵€鏈変簨浠朵紶閫?                    鈹斺攢 ...
  components/
    layout/
      SideMenu.jsx (鑿滃崟纭紪鐮?      routers/daily.py
      TopToolbar.jsx                 routers/models.py
    modals/                         services/
    image/                            image_scanner.py
    score/                            llm_scorer.py
    caption/                          daily_theme.py
  hooks/                            main.py (璺敱娉ㄥ唽)
    useImages.js (300琛?
    useScore.js
    useCaption.js
    useSearch.js
  api/imageApi.js (鎵€鏈堿PI闆嗕腑)
```

### 1.2 娣诲姞鏂板姛鑳介渶瑕佹敼鐨勬枃浠?
| 褰撳墠闇€瑕佹敼 | 鏂囦欢 |
|-----------|------|
| 1. 鑿滃崟椤?| `SideMenu.jsx` - 纭紪鐮?Menu.Item |
| 2. 鑿滃崟鐘舵€?| `App.jsx` - `activeMenu` state |
| 3. 缁勪欢娓叉煋 | `App.jsx` - 鏉′欢娓叉煋 `{activeMenu==='xxx' && <XxxPanel/>}` |
| 4. 鏁版嵁鐘舵€?| `App.jsx` - `useXxx()` hook |
| 5. 浜嬩欢浼犻€?| `App.jsx` - props drilling 灞傚眰浼犻€?|
| 6. API 鍑芥暟 | `imageApi.js` - 杩藉姞 export |
| 7. 鍚庣璺敱 | 鍙兘鎸よ繘 `images.py` 鎴栨柊鏂囦欢 |
| 8. 璺敱娉ㄥ唽 | `main.py` - `app.include_router(...)` |

**缁撹锛氭瘡鍔犱竴涓姛鑳借鍔?8 涓湴鏂癸紝App.jsx 鏈€鏍稿績浣嗚€﹀悎鏈€閲嶃€?*

### 1.3 鏍稿績闂

| 闂 | 琛ㄧ幇 |
|------|------|
| App.jsx 鏄摱棰?| 鎵€鏈夌姸鎬併€佷簨浠躲€佹覆鏌撻泦涓湪涓€涓枃浠?|
| 鑿滃崟纭紪鐮?| SideMenu 閲屽啓姝?`<Menu.Item key="scores">` |
| Props 灞傚眰浼犻€?| `handleScore` 浠?App 鈫?ImageGrid 鈫?ImageCard |
| API 闆嗕腑绠＄悊 | `imageApi.js` 鍖呭惈鎵€鏈夋帴鍙ｏ紝鏃犳ā鍧楀垝鍒?|
| 鍚庣璺敱娣锋潅 | `images.py` 688 琛岋紝鏂囦欢澶?鍥剧墖+璇勫垎鍏ㄥ湪涓€璧?|
| 鏃犵粺涓€鐘舵€佺鐞?| useState 鏁ｈ惤鍚勫锛岃法缁勪欢鍏变韩闈?props |

---

## 浜屻€佺洰鏍囨灦鏋?
### 2.1 鏍稿績鍘熷垯

1. **鍔熻兘鍗虫ā鍧?* 鈥?姣忎釜鍔熻兘鏄竴涓嫭绔嬫枃浠跺す锛屽寘鍚嚜宸辩殑璺敱/hook/缁勪欢
2. **鑿滃崟鏁版嵁椹卞姩** 鈥?鑿滃崟閰嶇疆鏄暟鎹紝鍔犲姛鑳?= 鍔犻厤缃」 + 鍔犳枃浠跺す
3. **Context 鏇夸唬 Props** 鈥?鍏ㄥ眬鐘舵€佺敤 React Context锛屾秷闄?drilling
4. **鍚庣鎸夎亴璐ｆ媶鍒?* 鈥?姣忎釜 router 鏂囦欢 鈮?200 琛?5. **娣诲姞鏂板姛鑳藉彧鏀?2 涓湴鏂?* 鈥?鑿滃崟閰嶇疆 + 鏂板姛鑳芥枃浠跺す

### 2.2 鐩爣鐩綍缁撴瀯

```
frontend/src/
  App.jsx                  鈫?鏋佺畝锛屽彧鍋氬竷灞€ + Context Provider
  config/
    menu.js                鈫?鑿滃崟閰嶇疆锛堟暟鎹┍鍔級
    routes.js              鈫?璺敱閰嶇疆锛堝彲閫夛紝閰嶅悎 react-router锛?  context/
    AppContext.jsx          鈫?鍏ㄥ眬鐘舵€?(selectedFolder, selectedImages...)
    ScoreContext.jsx        鈫?璇勫垎浠诲姟鐘舵€?    CaptionContext.jsx      鈫?鏂囨鐘舵€?  pages/
    folder/                 鈫?鍔熻兘妯″潡锛氭枃浠跺す娴忚
      index.jsx             鈫?椤甸潰鍏ュ彛
      components/
        ImageGrid.jsx
        ImageCard.jsx
        PreviewModal.jsx
      hooks/
        useFolder.js
        useImageList.js
        usePagination.js
        useSelection.js
      api.js                鈫?妯″潡涓撳睘 API
    scores/                 鈫?鍔熻兘妯″潡锛氳瘎鍒嗚褰?      index.jsx
      components/ScoreList.jsx
      hooks/useScoreTasks.js
      api.js
    captions/               鈫?鍔熻兘妯″潡锛氭枃妗堣褰?      index.jsx
      ...
    settings/               鈫?鍔熻兘妯″潡锛氳缃?      index.jsx
      ...
    upload/                 鈫?鏈潵妯″潡锛氫笂浼犺瘎鍒?      index.jsx
      ...
  components/
    layout/
      AppLayout.jsx         鈫?甯冨眬澹?      Sidebar.jsx           鈫?浠庨厤缃敓鎴愯彍鍗?      TopBar.jsx
  shared/
    ImageThumbnail.jsx      鈫?鍏变韩缁勪欢
    useApi.js               鈫?鍏变韩 hook
    constants.js

backend/
  main.py                   鈫?鏋佺畝锛屽彧娉ㄥ唽璺敱
  routers/
    folders.py              鈫?鏂囦欢澶?API (鈮?50琛?
    images.py               鈫?鍥剧墖 CRUD + 缂╃暐鍥?(鈮?00琛?
    scoring.py              鈫?璇勫垎浠诲姟 (鈮?00琛?
    caption.py              鈫?鏂囨 + 涓婚 (鈮?00琛?
    models.py               鈫?妯″瀷绠＄悊 (鈮?00琛?
    upload.py               鈫?鏈潵妯″潡
    scan.py                 鈫?鎵弿寮傛浠诲姟
  services/
    image_scanner.py        鈫?鎵弿閫昏緫
    llm_service.py          鈫?缁熶竴 LLM 璋冪敤 (鏈湴/浜戠璺敱)
    score_service.py        鈫?璇勫垎绾跨▼绠＄悊
  core/
    config.py               鈫?閰嶇疆
    database.py             鈫?鏁版嵁搴?    models/                 鈫?Pydantic schemas
```

### 2.3 鑿滃崟閰嶇疆锛堟暟鎹┍鍔級

```javascript
// frontend/src/config/menu.js
import { 
  FolderOutlined, StarOutlined, FileTextOutlined, 
  SettingOutlined, UploadOutlined 
} from '@ant-design/icons';

export const menuConfig = [
  {
    key: 'folder',
    icon: FolderOutlined,
    label: '鏂囦欢澶?,
    type: 'submenu',         // 瀛愯彍鍗曪紙鍚枃浠跺す鏍戯級
    badge: null,             // 鍙€夊窘鏍?  },
  {
    key: 'scores',
    icon: StarOutlined,
    label: '璇勫垎璁板綍',
    type: 'page',
    badge: 'failedScores',   // 浠?context 鍙栧窘鏍囨暟
  },
  {
    key: 'captions',
    icon: FileTextOutlined,
    label: '鏂囨璁板綍',
    type: 'page',
    badge: null,
  },
  { type: 'divider' },
  {
    key: 'settings',
    icon: SettingOutlined,
    label: '璁剧疆',
    type: 'modal',           // 寮圭獥绫诲瀷
  },
  // === 鍔犳柊鍔熻兘鍙渶鍔犱竴椤?===
  // {
  //   key: 'upload',
  //   icon: UploadOutlined,
  //   label: '涓婁紶璇勫垎',
  //   type: 'page',
  // },
];
```

### 2.4 娣诲姞鏂板姛鑳界殑鏍囧噯姝ラ锛堢洰鏍囷級

```
1. 鍦?menu.js 鍔犱竴椤归厤缃?         鈫?1 琛?2. 鍦?pages/ 涓嬪垱寤哄姛鑳芥枃浠跺す      鈫?鏍囧噯妯℃澘
   pages/xxx/
     index.jsx        鈫?椤甸潰鍏ュ彛
     hooks/useXxx.js  鈫?鏁版嵁 hook
     api.js           鈫?API 璋冪敤
     components/      鈫?鍔熻兘缁勪欢锛堝彲閫夛級
3. 鍦?backend/routers/ 鍔犺矾鐢辨枃浠讹紙濡傞渶鏂?API锛?4. 鍦?main.py 娉ㄥ唽璺敱锛堝闇€锛?```

**鏀瑰姩鐐癸細2-4 涓枃浠?vs 鐜板湪鐨?8 涓€?*

---

## 涓夈€侀噸鏋勬楠?
### 绗竴姝ワ細鍚庣鎷嗗垎锛堜綆椋庨櫓锛屽墠绔棤鎰燂級

```
1. routers/images.py 鎷嗗垎涓?
   鈫?routers/folders.py    (鏂囦欢澶规帴鍙?
   鈫?routers/images.py     (鍥剧墖鎺ュ彛)
   鈫?routers/scoring.py    (璇勫垎鎺ュ彛)
   鈫?routers/scan.py       (鎵弿鎺ュ彛)
   
2. llm_scorer.py 鐨勬ā鍨嬭矾鐢辨娊璞′负 core/model_router.py
3. daily_theme.py 鈫?llm_service.py (Chat API 缁熶竴鍏ュ彛)
```

### 绗簩姝ワ細鍓嶇 Context 鍖?
```
1. 鍒涘缓 AppContext    鈥?selectedFolder, selectedImages, displayImages
2. 鍒涘缓 ScoreContext  鈥?scoreTasks, failedScores, scoringIds
3. 鍒涘缓 CaptionContext鈥?captionHistory, generatedCaption
4. App.jsx 鍙樻垚绾?Provider 澹?```

### 绗笁姝ワ細椤甸潰妯″潡鍖?
```
1. 姣忎釜鍔熻兘鍙樻垚 pages/ 涓嬬殑鐙珛妯″潡
2. Sidebar 浠?menu.js 閰嶇疆鐢熸垚
3. 鏍稿績娓叉煋锛歿activeKey === 'folder' && <FolderPage/>}
```

### 绗洓姝ワ細鍙€変紭鍖?
```
- TypeScript 杩佺Щ锛堟笎杩涘紡锛?- React Router锛堝鏋滈渶瑕?URL 瀵艰埅锛?- 鍚庣 Service 灞傛娊璞?- 缁熶竴閿欒澶勭悊
```

---

## 鍥涖€佸奖鍝嶈瘎浼?
| 鏂归潰 | 閲嶆瀯鍓?| 閲嶆瀯鍚?|
|------|--------|--------|
| 鍔犳柊鑿滃崟 | 鏀?8 涓枃浠?| 鏀?2-4 涓枃浠?|
| App.jsx 琛屾暟 | 550+ | ~80 |
| 鍗曟枃浠舵渶澶ц鏁?| 688 (鍚庣) | 鈮?00 |
| 璺ㄧ粍浠堕€氫俊 | props drilling | Context |
| 鍚庣璺敱 | 3 涓ぇ鏂囦欢 | 6+ 灏忔枃浠?|
| 鑿滃崟閰嶇疆 | 纭紪鐮?JSX | 鏁版嵁椹卞姩 |

---

## 浜斻€佹槸鍚﹀惎鍔紵

閲嶆瀯鍒嗘杩涜锛屾瘡涓€姝ョ嫭绔嬪彲娴嬨€傚缓璁粠**鍚庣鎷嗗垎**寮€濮嬶紙瀵瑰鏃犲奖鍝嶏級锛岀劧鍚?*鍓嶇 Context 鍖?*锛屾渶鍚?*椤甸潰妯″潡鍖?*銆?
---

## 鍏€佹湭鏉ュ姛鑳介€傞厤鍒嗘瀽

### 6.1 瑙勫垝鍔熻兘娓呭崟鍙婃灦鏋勯€傞厤

| 鍔熻兘 | 鍓嶇妯″潡 | 鍚庣璺敱 | 渚濊禆 | 鏋舵瀯鑳藉惁鏀拺 |
|------|---------|---------|------|------------|
| 涓婁紶鍥剧墖璇勫垎 | `pages/upload/` | `routers/upload.py` | 鏂囦欢涓婁紶 + AI璇勫垎 | 鉁?鐙珛妯″潡 |
| 涓婁紶璁板綍鏌ョ湅 | `pages/upload/` 瀛愰〉闈?| 鍚屼笂 | 涓婁紶鍘嗗彶琛?| 鉁?鍚屾ā鍧?|
| 鏂囦欢澶圭鐞?澧炲垹鏀? | `pages/folders/` | `routers/folders.py` | 鏂囦欢绯荤粺鎿嶄綔 | 鉁?鎵╁睍鐜版湁 |
| 鐓х墖璇︽儏缂栬緫 | `pages/detail/` | `routers/images.py` | 鍏冩暟鎹鍐?| 鉁?鐙珛妯″潡 |
| 鐓х墖缂栬緫(瑁佸壀/璋冭壊) | `pages/editor/` | 鏃?绾墠绔? 鎴?`routers/image_process.py` | Canvas/PIL | 鉁?鐙珛妯″潡 |
| LUT 鐢熸垚 | `pages/lut/` | `routers/lut.py` | AI + 鍥惧儚澶勭悊 | 鉁?鐙珛妯″潡 |
| AI 瀵硅瘽璇勫垎 | `pages/ai/` | `routers/ai.py` | LLM Service | 鉁?鐙珛妯″潡 |

### 6.2 鑿滃崟閰嶇疆棰勮锛堟湭鏉ユ€侊級

```javascript
export const menuConfig = [
  // === 娴忚 ===
  { key: 'folder',   icon: FolderOutlined,    label: '鏂囦欢澶?,   type: 'submenu' },
  { key: 'upload',   icon: UploadOutlined,    label: '涓婁紶璇勫垎', type: 'page' },
  
  // === 绠＄悊 ===
  { key: 'folders',  icon: FolderAddOutlined, label: '鏂囦欢澶圭鐞?, type: 'page' },
  { key: 'history',  icon: HistoryOutlined,   label: '涓婁紶璁板綍', type: 'page' },
  
  // === 璁板綍 ===
  { key: 'scores',   icon: StarOutlined,      label: '璇勫垎璁板綍', type: 'page', badge: 'failedScores' },
  { key: 'captions', icon: FileTextOutlined,  label: '鏂囨璁板綍', type: 'page' },
  
  // === 宸ュ叿 ===
  { key: 'editor',   icon: EditOutlined,      label: '鐓х墖缂栬緫', type: 'page' },
  { key: 'lut',      icon: BgColorsOutlined,  label: 'LUT鐢熸垚',  type: 'page' },
  { key: 'ai',       icon: RobotOutlined,     label: 'AI鍔╂墜',   type: 'page' },
  
  { type: 'divider' },
  { key: 'settings', icon: SettingOutlined,   label: '璁剧疆',     type: 'modal' },
];
```

### 6.3 鍏抽敭鍐崇瓥鐐?
| 闂 | 寤鸿 | 鐞嗙敱 |
|------|------|------|
| 鍓嶇璺敱鐢?React Router锛?| **鏆備笉闇€瑕?* | 褰撳墠鍩轰簬 key 鐨勬潯浠舵覆鏌撳鐢紝绛夐〉闈?> 8 涓啀寮曞叆 |
| 鐘舵€佺鐞嗙敤 Redux/Zustand锛?| **React Context 鍗冲彲** | 褰撳墠鐘舵€侀噺涓嶅ぇ锛孋ontext 鎬ц兘瓒冲 |
| TypeScript 杩佺Щ锛?| **鍚庢湡娓愯繘** | 鍏堢ǔ瀹氭灦鏋勫啀杩佺被鍨嬶紝涓嶅奖鍝嶅姛鑳?|
| 鐓х墖缂栬緫绾墠绔繕鏄悗绔紵 | **杞婚噺绾墠绔紝閲嶉噺绾у悗绔?* | 瑁佸壀/璋冭壊鐢?Canvas锛孡UT 鐢熸垚鐢ㄥ悗绔?PIL |
| 鏂囦欢绯荤粺 vs 鏁版嵁搴撳瓨鍌紵 | **褰撳墠娣峰悎锛屽悗鏈熺粺涓€ DB 鍏冩暟鎹?* | 鍥剧墖瀛樻枃浠剁郴缁燂紝鍏冩暟鎹瓨 DB锛屼繚鎸佺幇鐘?|

### 6.4 鏋舵瀯璇勪环

> 褰撳墠鏋舵瀯瀵广€屾枃浠跺す娴忚 + 璇勫垎 + 鏂囨銆嶄笁涓姛鑳藉凡缁忔崏瑗熻鑲橈紙App.jsx 550 琛岋級銆?> 鍔犱笂涓婁紶銆佺紪杈戙€丩UT銆丄I 绛?5+ 涓姛鑳藉悗锛屽鏋滀笉閲嶆瀯锛孉pp.jsx 浼氳啫鑳€鍒?2000+ 琛岋紝瀹屽叏涓嶅彲缁存姢銆?> 
> **鐜板湪閲嶆瀯鏄繀椤荤殑锛屼笉鏄彲閫夌殑銆?* 鐩爣鏋舵瀯鐨勬ā鍧楀寲璁捐鑳借交鏉炬壙杞?10+ 涓姛鑳斤紝
> 姣忎釜鍔熻兘浜掍笉骞叉壈锛屽姞鏂板姛鑳藉彧闇€鍒涘缓鏂囦欢澶?+ 閰嶈彍鍗曘€?
---

## 涓冦€佽彍鍗曠郴缁熸灦鏋勶紙宸插疄鐜帮級

### 7.1 鑿滃崟閰嶇疆 (`config/menu.js`)

鑿滃崟閰嶇疆鏄暟鎹┍鍔ㄧ殑锛屾墍鏈夎彍鍗曢」瀹氫箟鍦ㄤ竴涓暟缁勪腑锛?
```javascript
export const menuItems = [
  {
    key: 'folder',       // 鍞竴鏍囪瘑
    icon: FolderOutlined,
    label: '鏂囦欢澶?,
    type: 'submenu',     // submenu | page | modal | divider
    primary: true,       // true 鈫?鍚屾椂鏄剧ず鍦ㄧЩ鍔ㄧ搴曢儴 tab
    // children: [...]   // 鍙€夛紝浜岀骇瀛愯彍鍗曪紙浠?type='submenu' 鐢熸晥锛?  },
  { type: 'divider' },  // 鍒嗛殧绾?  {
    key: 'settings',
    icon: SettingOutlined,
    label: '璁剧疆',
    type: 'submenu',
    children: [
      { key: 'settings-general', label: '閫氱敤璁剧疆' },
      { key: 'settings-models',  label: '妯″瀷绠＄悊' },
      { key: 'settings-theme',   label: '涓婚鍒囨崲' },
    ],
  },
];
```

**瀛楁璇存槑锛?*

| 瀛楁 | 绫诲瀷 | 璇存槑 |
|------|------|------|
| `key` | string | 鍞竴鏍囪瘑锛屽瓙鑿滃崟 key 寤鸿鐢?`parent-child` 鍛藉悕绌洪棿 |
| `icon` | ReactNode | antd 鍥炬爣缁勪欢 |
| `label` | string | 鏄剧ず鏂囨湰 |
| `type` | 'submenu' \| 'page' \| 'modal' \| 'divider' | 鑿滃崟椤圭被鍨?|
| `primary` | boolean (鍙€? | 涓?true 鏃跺湪绉诲姩绔簳閮?tab 鏍忔樉绀?|
| `children` | array (鍙€? | 浜岀骇瀛愯彍鍗曢」锛屾瘡椤瑰惈 `{ key, label }` |

**鑿滃崟椤圭被鍨嬶細**

| 绫诲瀷 | 琛屼负 |
|------|------|
| `submenu` | 鍙睍寮€鐨勫瓙鑿滃崟锛涙湁 children 鏃舵覆鏌撲负 antd SubMenu锛屾棤 children 鐨勭壒娈?key 鍙嚜瀹氫箟鍐呴儴锛堝 folder 鏄剧ず鐩綍鏍戯級 |
| `page` | 鐐瑰嚮鍚庡垏鎹㈠埌瀵瑰簲椤甸潰/闈㈡澘 |
| `modal` | 鐐瑰嚮鍚庡脊鍑?Modal锛堝凡寮冪敤锛屾敼涓?submenu + children 鏂瑰紡鏇寸伒娲伙級 |
| `divider` | 鍒嗛殧绾?|

### 7.2 娓叉煋閾捐矾

```
menuItems (config/menu.js)
  鈹溾攢鈹€ SideMenu.jsx       鈫?妗岄潰绔晶杈规爮锛堟敮鎸?SubMenu锛?  鈹溾攢鈹€ MobileDrawers.jsx  鈫?绉诲姩绔彍鍗曟娊灞夛紙閫掑綊鏋勫缓 SubMenu锛?  鈹斺攢鈹€ BottomTabs.jsx     鈫?绉诲姩绔簳閮?tab锛堝彧鍙?primary: true 鐨勯」锛?```

**`SideMenu.jsx`** 鈥?妗岄潰渚ц竟鏍忥細
- 閬嶅巻 `menuItems`锛宍type: 'submenu'` 涓旀湁 `children` 鐨勮嚜鍔ㄦ覆鏌撲负 antd `SubMenu`
- `key: 'folder'` 鐗规畩澶勭悊锛屽瓙鏍戞覆鏌撲负鐩綍鏍戯紙Tree 缁勪欢锛?- 鍏朵粬鍗曞眰椤癸紙`type: 'page'/'modal'`锛夋覆鏌撲负 `Menu.Item`

**`MobileDrawers.jsx`** 鈥?绉诲姩绔彍鍗曟娊灞夛細
- `buildMenuTree()` 閫掑綊鏋勫缓鍚瓙鑿滃崟鐨勬爲
- antd `Menu` 鍘熺敓鏀寔宓屽 `SubMenu`
- 鐐瑰嚮瀛愰」鍚庤嚜鍔ㄥ叧鎶藉眽

**`BottomTabs.jsx`** 鈥?绉诲姩绔簳閮?tab锛?- 浠?`menuItems` 鍙?`primary: true` 鐨勯」鍔ㄦ€佺敓鎴愭寜閽?- 涓嶉渶瑕侀澶栨敞鍐屾柊 tab

### 7.3 缁熶竴鑿滃崟鍒囨崲 (`App.jsx handleMenuClick`)

妗岄潰绔拰绉诲姩绔蛋鍚屼竴濂?handler锛屾寜 `isMobile` 鍒嗘祦锛?
```javascript
const handleMenuClick = (key) => {
  // 1. settings-* 瀛愰」 鈫?寮圭獥锛堥€氱敤 / 妯″瀷 / 涓婚锛?  if (key.startsWith('settings-')) { ... }

  // 2. 妗岄潰绔細鍒囨崲 activeMenu
  if (!isMobile) { setActiveMenu(key); return; }

  // 3. 绉诲姩绔細鎸?key 澶勭悊锛堟墦寮€鎶藉眽/闈㈡澘/椤甸潰锛?  if (key === 'folder')      鈫?toggle 鍐呰仈鏂囦欢澶规爲
  if (key === 'scores')      鈫?鎵撳紑璇勫垎鎶藉眽
  if (key === 'captions')    鈫?鎵撳紑鏂囨鎶藉眽
  if (key === 'lut')         鈫?鏄剧ず LUT 鍏ㄥ睆椤甸潰
  else                       鈫?榛樿琛屼负
};
```

**单层页面（如加一个"历史记录"tab）：**
1. 在 `menu.js` 的 `menuItems` 数组加一项
2. 在 `App.jsx` 渲染对应组件 `{activeMenu === 'history' && <HistoryPage/>}`
3. （可选）在 `handleMenuClick` 的移动端分支加对应处理

**带子菜单的设置项（如"设置"→"通用设置"）：**
1. 在 `menu.js` 配置 `type: 'submenu'` 和 `children` 数组
2. 桌面/手机端菜单自动渲染为 SubMenu
3. 在 `App.jsx` 的 `handleMenuClick` 加 `key.startsWith('settings-')` 分支处理弹窗
4. 创建对应的弹窗组件（或复用现有弹窗 + `initialTab`）

**关键原则：**
- 菜单配置即界面，`menu.js` 改完，桌面和手机自动同步
- 不需要改 `BottomTabs.jsx`、`SideMenu.jsx`、`MobileDrawers.jsx`
- 子菜单 key 用 `parent-child` 命名空间防冲突

### 7.5 相关文件清单

| 文件 | 职责 |
|------|------|
| `frontend/src/config/menu.js` | 菜单数据配置（唯一入口） |
| `frontend/src/components/layout/SideMenu.jsx` | 桌面侧边栏渲染器 |
| `frontend/src/components/layout/BottomTabs.jsx` | 移动端底部 tab 渲染器 |
| `frontend/src/components/layout/MobileDrawers.jsx` | 移动端菜单抽屉渲染器 |
| `frontend/src/App.jsx` | `handleMenuClick` 统一路由 |
| `frontend/src/components/modals/SettingsModal.jsx` | 设置弹窗（子菜单目标页） |
