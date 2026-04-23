# Layout Tool

## 檔案位置

```
src/WireframeEditor.jsx   # 編輯器主體
src/WireframeEditor.css   # 樣式
src/utils.js              # ASCII 匯出邏輯
src/hooks/useDrag.js      # 拖拉 + 格點吸附
layouts/                  # 儲存的 JSON 佈局
LayoutTest/               # 測試佈局
local/                    # 本地筆記／討論紀錄（不上傳，已加入 .gitignore）
```

## 快捷鍵

| 操作 | 說明 |
|---|---|
| Click canvas / 視窗框內 | 新增方塊（吸附 20px 格點） |
| Drag | 移動（吸附 20px 格點） |
| Shift+drag | 軸鎖定移動 |
| Ctrl+drag 視窗框 | 移動視窗框 |
| Ctrl+Shift+drag | 複製並移動複本 |
| Drag 右下角 | 縮放（吸附 20px 格點） |
| Double-click | 編輯標籤 |
| Delete / Backspace | 刪除選取方塊 |
| `` ` `` | 切換顯示/隱藏 toolbar 與 sidebar |
| `1` | 文字靠上（valign top） |
| `2` | 文字置中（valign center） |
| `3` | 文字靠下（valign bottom） |
| `4` | 縮小檢視字體（label font size −1） |
| `5` | 放大檢視字體（label font size +1） |

## 與 Claude 協作的設計流程

### 推薦工作流程

1. **畫大區域**：在視窗框內放幾個大 block（Header、Sidebar、Main 等）
2. **複製完整文件** → 貼給 Claude → Claude 生成骨架 HTML，雙方確認
3. **畫細節**：在每個大 block 內放子 block
4. **再次複製完整文件** → Claude 依各區細節補完

### 匯出格式說明

Sidebar「複製完整文件」輸出一份 markdown，包含：

- **整體架構**：只顯示頂層 block 的 ASCII 圖 + 尺寸描述
- **各區細節**：每個有子 block 的區域，各自一張 ASCII 圖

```markdown
# Dashboard

> 環境：Desktop 1280×720

---

## 整體架構

┌────────────────────────────────────────────────────────────┐
│                        Header                              │
├───────────┬────────────────────────────────────────────────┤
│  Sidebar  │                  Main                         │
└───────────┴────────────────────────────────────────────────┘

Header          full-width  height: 9%
Sidebar         width: 19%  height: 91%
Main            width: 81%  height: 91%  left: 19%

---

## Main

┌────────────────────────────────────────────────────────────┐
│                       KPI Bar                              │
├──────────────────┬──────────────────┬──────────────────────┤
│      Chart       │      Table       │        Feed          │
└──────────────────┴──────────────────┴──────────────────────┘
```

這份文件任何 Claude 不需要額外 context 就能讀懂並實作。

### 動態行為用自然語言補充

ASCII 表達靜態骨架，動態行為直接在對話中描述：
> 「Main 區垂直 scroll，Feed 欄獨立 scroll，點擊 Card 開 modal」

## Live Mode（Claude Code 協作流程）

1. 在 app 點「○ Live」按鈕啟動（變成「● Live」）
2. 告訴 Claude 你要的佈局
3. Claude 寫入 `layouts/live.json`
4. 畫布每秒自動更新，不需手動載入
5. 繼續描述修改 → 循環

> 前提：本地執行 `npm run dev`，並用 Claude Code 開啟此資料夾。

## Layout JSON 格式

```json
[
  { "id": 1, "label": "Header", "x": 0, "y": 0, "w": 800, "h": 60, "type": "frame" },
  { "id": 2, "label": "Sidebar", "x": 0, "y": 60, "w": 200, "h": 400, "valign": "center" }
]
```

> 注意：移動和縮放皆吸附至 20px 格點，確保 ASCII 匯出整齊。

---

## 同步上游更新（Fork 用戶）

上游倉庫：`https://github.com/bottledsnow/claude-wireframe`

如果你不熟悉 git，直接告訴 Claude：「幫我同步最新版本」，Claude 會自動處理。

手動步驟：
```bash
# 第一次執行（加入上游）
git remote add upstream https://github.com/bottledsnow/claude-wireframe.git

# 之後每次同步
git fetch upstream
git merge upstream/main
```

---

## LayoutTest

每個 layout 由兩個部分組成：

```
LayoutTest/
  {name}.json       ← 座標（工具產生，勿直接解析）
  {name}/
    layout.md       ← 結構描述（先讀這個）
    index.html      ← 輸出 HTML
```

**處理步驟**：讀 `layout.md` → 依描述生成 HTML → 存至 `index.html`，不需解析 JSON 座標。

## HTML 生成原則

- flex / grid layout，不用 absolute positioning
- full-width → `width: 100%`
- 等寬欄位 → `flex: 1`
- 樣式：深色背景 `#13141a`，方塊加淡色邊框
