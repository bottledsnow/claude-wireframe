# Layout Tool

## 檔案位置

```
src/WireframeEditor.jsx   # 編輯器主體
src/WireframeEditor.css   # 樣式
layouts/                  # 儲存的 JSON 佈局
LayoutTest/               # 測試佈局
local/                    # 本地筆記／討論紀錄（不上傳，已加入 .gitignore）
```

## 快捷鍵

| 操作 | 說明 |
|---|---|
| Click canvas | 新增方塊 |
| Drag | 移動 |
| Shift+drag | 軸鎖定移動 |
| Ctrl+Shift+drag | 複製並移動複本 |
| Drag 右下角 | 縮放 |
| Double-click | 編輯標籤 |
| Delete / Backspace | 刪除選取方塊 |
| `` ` `` | 切換顯示/隱藏 toolbar 與 sidebar |
| `1` | 文字靠上（valign top） |
| `2` | 文字置中（valign center） |
| `3` | 文字靠下（valign bottom） |
| `4` | 縮小檢視字體（label font size −1） |
| `5` | 放大檢視字體（label font size +1） |

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

## layout.md 語法

```
# {name}
viewport: {label} {W}×{H}

- full-width bar        top:{%}  height:{%}
- {N} equal columns     top:{%}  height:{%}
- columns [{A}% | {B}%] top:{%}  height:{%}
- "{label}" block       left:{%} top:{%} width:{%} height:{%}
```

## HTML 生成原則

- flex layout，不用 absolute positioning
- equal columns → `flex: 1`（自動等寬）
- full-width bar → `width: 100%`
- 樣式：深色背景 `#13141a`，方塊加淡色邊框
