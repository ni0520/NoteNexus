---
name: Drizzle Session 表
description: Drizzle schema push 與 connect-pg-simple Session 表共存時的資料庫同步限制。
---

使用 `connect-pg-simple` 儲存 Express Session 時，Session 表由 session store 管理，不應放進 Drizzle schema push 的同步範圍；Drizzle 設定需明確排除它。

**Why:** 若 Drizzle push 將 Session 表視為 schema 中不存在的表，可能在同步時提出刪除表及現有 Session 的資料遺失警告，導致使用者被登出或登入流程看似失效。

**How to apply:** 修改使用者、筆記或備份 schema 前，保留 Drizzle 的表格篩選設定，只同步應用程式自己的資料表；遇到既有資料新增必填欄位時，先以可為空欄位同步、補齊資料，再收緊為必填。