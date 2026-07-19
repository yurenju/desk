# Desk

個人儀表板（Mail / Calendar / Todo）。此檔為 domain 詞彙表，只放語彙定義，不放實作細節。

## Language

### Focus（專注鏡頭）

**焦點日（focus day）**：
Focus 鏡頭中間 hero 欄位所顯示、由使用者專注的那一天。決定中間顯示哪一天的任務。
_Avoid_: selectedDate（程式變數名，非對話用語）、current day

**週檢視（week view）**：
Focus 左側 week rail 目前翻到的那一週。是使用者「瀏覽」用的鏡頭，與焦點日互相獨立，翻週不改變焦點日。
_Avoid_: 當週、current week（會與焦點日所在週混淆）
