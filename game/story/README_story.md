# 鹿雨森 Story｜預留骨架 v1

這個 ZIP **只新增 `game/story/`**，不含也不覆蓋現有 `game/index.html`、`game.js` 或任何 Demo。

## 結構
- `index.html`：劇情目錄及閱讀頁的固定結構
- `story.css` / `story.js`：核心布局／唯一劇情狀態與流程管理
- `story_style.css` / `story_style.js`：鹿雨森外觀／UI 事件（不另做劇情流程）
- `data/chapters.json`：主線順序、每節檔案及是否開放、番外目錄
- `data/prologue/prologue.json`：序章
- `data/chapter_01/01_01.json` ～ `data/chapter_10/10_10.json`：十章各十小節，共 100 份
- `data/epilogue/epilogue.json`：尾聲
- `data/extras/extra_01.json`、`extra_02.json`：番外

劇情檔共 104，另加章節索引 1，共 105 個 JSON。

## 寫一節劇情的順序
1. 找到對應的 JSON，例如 `data/chapter_01/01_01.json`。
2. 保持 `id` 不變，在 `events` 內依序填上劇情事件，每個事件推薦有**穩定、唯一的 ID**。
3. 修改 `data/chapters.json` 對應小節的 `enabled` 為 `true`。沒有實際文字的預留檔保持 `false`。
4. 使用 GitHub Pages 或本機 HTTP 伺服器開啟 `game/story/`；直接雙擊 `file://` HTML 會被瀏覽器的 fetch 安全限制擋下。

### JSON 的劇情事件例子（僅文件說明，未寫進預留劇情）

```json
{
  "id": "01_01",
  "title": "第一章第一節",
  "events": [
    { "id": "01_01_001", "type": "narration", "text": "雨聲漸近。" },
    { "id": "01_01_002", "type": "dialogue", "speaker": "璐瑤", "text": "這裡是哪裡？" },
    { "id": "01_01_003", "type": "choice", "prompt": "要怎麼回答？", "options": [
      { "text": "靜靜觀察", "goto": "01_01_004" },
      { "text": "繼續前進", "goto": "01_01_004" }
    ] },
    { "id": "01_01_004", "type": "narration", "text": "他向前踏出一步。" }
  ]
}
```

`choice.options[].goto` 是**當前小節內**的事件 ID，不是陣列第幾筆，也不是網頁 URL。
跨頁網頁跳轉交由軍火庫 `https://lib.stillnessbyslowly.com/state/navigation/navigation.js`；劇情內的進退由唯一 `story.js` 管理。

## 解鎖規則
- 第一次只可能閱讀已發表的序章，預留檔不算已發表。
- 每一章中已啟用的小節按順序初次閱讀；讀過的可以從目錄任意重看。
- 完成一章所有**已啟用**小節，解鎖下一章（下一章仍需有已發表小節才能進去）。
- 讀完第十章才解鎖尾聲；序章與尾聲是獨立篇章。
- 番外不影響主線；`enabled: true` 才能進入，`unlockAfter` 預設 `null` 表示公開後即可看；未來可設定 `chapter_03` 等已完成章節 ID。
- 進度用 localStorage 儲存在**玩家自己裝置及瀏覽器**，不會跨裝置同步。
- 目前 `challenge` 只是**接口預留**，並不實際啟動卡牌／三消／合成；未接入時會停在該事件，不會假裝通關。
- 正式故事稿尚未加入；目前所有 `enabled: false`，這是刻意保留的安全狀態。

**注意：** 如果已發表的一章後來再啟用新小節，既有玩家已解鎖的章節不會自動收回（已解鎖狀態保持單調），但新節仍要依規則閱讀才會被記為完成。若後續要更精細的版本控制和存檔遷移，應另外設計。

## 發布備註
- 本 ZIP 不修改正式遊戲入口的「踏入霧中」按鈕連結，也不影響既有 Demo。
- 部署後可以直接造訪 `/game/story/` 看預留目錄。要從遊戲入口進 Story，等確認入口流程後再接。
- 軍火庫元件仍從 HTTPS 絕對網址讀取，沒有複製 JS。
