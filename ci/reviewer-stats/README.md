# Reviewer stats

统计 `calculator-interview` 的 PR Review，并维护 `reviewers` **进退花名册**。

## 口径

- 只统计某人在 `reviewers` **在册期间**的动作  
- **计**：正式 Submit review；讨论区普通评论（**同一 PR 同一人多条 → 1 次**）；帮忙关他人 PR  
- **不计**：作者自评/自关、PENDING、机器人  
- **加入**：出现在 team → 记 `joined`，从此开始计  
- **退出**：从 team 消失 → 记 `left`，注明退出时间，**此后不计**  
- 花名册状态存在 Issue #173 的 `<!-- reviewer-roster-state -->` 评论里（可跨 run 持久化）  
- 种子文件：`roster.json`（首次 / 无 Issue 状态时用）

## 触发

- 有人提交 PR Review → 更新总表 + 同步花名册  
- 每天北京 **21:00** → 再发一条日报  
- Actions 手动 `workflow_dispatch`

## 本地

```bash
export GH_TOKEN=$(gh auth token)
export STATS_ISSUE=173
export STATS_UPDATE_ISSUE=1
# export STATS_POST_DIGEST=1   # 同时发日报
python ci/reviewer-stats/collect.py
```
