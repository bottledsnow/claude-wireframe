# Layout Tool

## 檔案位置

```
renderer/src/WireframeEditor.jsx   # 編輯器主體
renderer/src/WireframeEditor.css   # 樣式
layouts/                           # 儲存的 JSON 佈局
LayoutTest/                        # 測試佈局
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

## IPC 頻道

| Channel | 方向 | 說明 |
|---|---|---|
| `save-layout` | renderer → main | 原生儲存對話框 |
| `load-layout` | renderer → main | 原生開啟對話框 |

## Layout JSON 格式

```json
[
  { "id": 1, "label": "Header", "x": 0, "y": 0, "w": 800, "h": 60, "type": "frame" },
  { "id": 2, "label": "Sidebar", "x": 0, "y": 60, "w": 200, "h": 400, "valign": "center" }
]
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
