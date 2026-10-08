#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Collect PR review counts with reviewer join/leave windows; update Issue #173."""
from __future__ import annotations

import collections
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

REPO = os.environ.get("STATS_REPO", "GXMZU-AITECC/calculator-interview")
TZ = dt.timezone(dt.timedelta(hours=8))
CUTOFF = dt.datetime.fromisoformat(
    os.environ.get("STATS_CUTOFF", "2026-10-04T00:00:00+08:00")
)
ISSUE_NUMBER = os.environ.get("STATS_ISSUE", "173")
MARKER = "<!-- reviewer-stats-bot -->"
DIGEST_MARKER = "<!-- reviewer-stats-daily-digest -->"
ROSTER_MARKER = "<!-- reviewer-roster-state -->"
GH_TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
POST_DIGEST = os.environ.get("STATS_POST_DIGEST", "0") == "1"
SCRIPT_DIR = Path(__file__).resolve().parent
ROSTER_PATH = Path(os.environ.get("STATS_ROSTER", str(SCRIPT_DIR / "roster.json")))

# 不计：机器人；PENDING 未提交；自己关/评自己的 PR
# 计：正式 Submit review + 讨论区评论（同 PR 多人多次→每人计 1）+ 帮忙关他人 PR
BOT_SUFFIXES = ("[bot]",)
BOT_LOGINS = {
    "github-actions",
    "github-actions[bot]",
    "dependabot",
    "dependabot[bot]",
    "copilot",
    "copilot-pull-request-reviewer",
    "cursor",
    "cursor[bot]",
}


def is_bot_login(login: str) -> bool:
    if not login:
        return True
    low = login.lower()
    if low in BOT_LOGINS:
        return True
    return any(low.endswith(s) for s in BOT_SUFFIXES)

REVIEWS_QUERY = """
query($owner:String!, $name:String!, $cursor:String) {
  repository(owner:$owner, name:$name) {
    pullRequests(first: 40, after:$cursor, orderBy:{field:UPDATED_AT, direction:DESC}, states:[OPEN, CLOSED, MERGED]) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        author { login }
        reviews(first: 100) {
          nodes {
            state
            submittedAt
            author { login }
          }
        }
        comments(first: 100) {
          nodes {
            createdAt
            author { login }
          }
        }
        timelineItems(first: 30, itemTypes: [CLOSED_EVENT]) {
          nodes {
            ... on ClosedEvent {
              createdAt
              actor { login }
            }
          }
        }
      }
    }
  }
}
"""


class GhApiError(RuntimeError):
    pass


def now_tz() -> dt.datetime:
    return dt.datetime.now(TZ)


def parse_ts(value: Optional[str]) -> Optional[dt.datetime]:
    if not value:
        return None
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(TZ)


def iso(ts: dt.datetime) -> str:
    return ts.astimezone(TZ).isoformat()


def fmt_cn(value: Any) -> str:
    """Human-readable Beijing time with 时分秒, e.g. 2026-10-07 21:35:52."""
    if isinstance(value, dt.datetime):
        ts = value
    else:
        ts = parse_ts(str(value) if value else None)
    if not ts:
        return "-"
    return ts.astimezone(TZ).strftime("%Y-%m-%d %H:%M:%S")


def gh_request(
    url: str,
    method: str = "GET",
    body: Dict[str, Any] | None = None,
    token: Optional[str] = None,
) -> Any:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    auth = token if token is not None else GH_TOKEN
    if auth:
        req.add_header("Authorization", f"Bearer {auth}")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise GhApiError(f"{method} {url} -> {e.code}: {err}") from e


def gh_api(
    path: str,
    method: str = "GET",
    body: Dict[str, Any] | None = None,
    token: Optional[str] = None,
) -> Any:
    return gh_request(f"https://api.github.com{path}", method, body, token=token)


def gh_graphql(query: str, variables: Dict[str, Any] | None = None) -> Any:
    return gh_request(
        "https://api.github.com/graphql",
        method="POST",
        body={"query": query, "variables": variables or {}},
    )


def gh_paginate(path: str, token: Optional[str] = None) -> List[Any]:
    items: List[Any] = []
    page = 1
    while True:
        sep = "&" if "?" in path else "?"
        chunk = gh_api(f"{path}{sep}per_page=100&page={page}", token=token)
        if not chunk:
            break
        if not isinstance(chunk, list):
            raise GhApiError(f"expected list from {path}")
        items.extend(chunk)
        if len(chunk) < 100:
            break
        page += 1
    return items


def today_bounds(now: dt.datetime | None = None) -> Tuple[dt.datetime, dt.datetime]:
    now = now or now_tz()
    start = now.astimezone(TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + dt.timedelta(days=1)


def load_roster_seed() -> Dict[str, Any]:
    if ROSTER_PATH.is_file():
        return json.loads(ROSTER_PATH.read_text(encoding="utf-8"))
    return {
        "tracking_started": iso(now_tz()),
        "note": "auto-created",
        "members": [],
        "events": [],
    }


def load_roster_from_issue() -> Optional[Dict[str, Any]]:
    try:
        comments = gh_paginate(f"/repos/{REPO}/issues/{ISSUE_NUMBER}/comments")
    except GhApiError:
        return None
    # 多条时取最后一条（可能是 Actions 新建的）
    for c in reversed(comments):
        body = c.get("body") or ""
        if ROSTER_MARKER not in body:
            continue
        # fenced json after marker
        start = body.find("```json")
        end = body.find("```", start + 7)
        if start < 0 or end < 0:
            continue
        raw = body[start + 7 : end].strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            continue
    return None


def token_actor_logins() -> Set[str]:
    """Logins whose Issue comments this token can safely PATCH."""
    actors = {"github-actions[bot]", "github-actions"}
    try:
        me = (gh_api("/user") or {}).get("login")
        if me:
            actors.add(me)
    except GhApiError:
        pass
    return actors


def save_roster_issue(roster: Dict[str, Any]) -> None:
    body = "\n".join(
        [
            ROSTER_MARKER,
            "## 🗂️ Reviewer 花名册（进退记录）",
            "",
            "机器可读状态（勿手改 JSON；加人/退人改 GitHub team 即可，脚本会同步）：",
            "",
            "```json",
            json.dumps(roster, ensure_ascii=False, indent=2),
            "```",
            "",
        ]
    )
    upsert_marked_comment(ROSTER_MARKER, body, replace=True)


def active_member_logins(roster: Dict[str, Any]) -> Set[str]:
    return {m["login"] for m in roster.get("members", []) if not m.get("left")}


def was_active_at(roster: Dict[str, Any], login: str, when: dt.datetime) -> bool:
    """True if login was on the reviewers team at `when` (any tenure interval)."""
    when = when.astimezone(TZ)
    for m in roster.get("members", []):
        if m.get("login") != login:
            continue
        joined = parse_ts(m.get("joined"))
        left = parse_ts(m.get("left"))
        if joined and when < joined:
            continue
        if left and when >= left:
            continue
        return True
    return False


def sync_roster_with_team(roster: Dict[str, Any], team_logins: Set[str]) -> List[str]:
    """Apply joins/leaves. Returns human-readable change lines."""
    changes: List[str] = []
    ts = now_tz()
    members: List[Dict[str, Any]] = list(roster.get("members", []))
    events: List[Dict[str, Any]] = list(roster.get("events", []))
    by_login = {m["login"]: m for m in members}

    # joins: in team but no open tenure
    for login in sorted(team_logins):
        open_m = next(
            (m for m in members if m["login"] == login and not m.get("left")), None
        )
        if open_m:
            continue
        # re-join creates a new tenure row
        row = {
            "login": login,
            "joined": iso(ts),
            "left": None,
            "source": "team-sync",
        }
        members.append(row)
        events.append(
            {"type": "join", "login": login, "at": iso(ts), "note": "检测到加入 reviewers team"}
        )
        changes.append(f"加入 @{login}（{fmt_cn(ts)}）")

    # leaves: open tenure but not in team
    for m in members:
        if m.get("left"):
            continue
        login = m["login"]
        if login in team_logins:
            continue
        m["left"] = iso(ts)
        events.append(
            {
                "type": "leave",
                "login": login,
                "at": iso(ts),
                "note": "检测到退出 reviewers team，此后 Review 不计",
            }
        )
        changes.append(f"退出 @{login}（{fmt_cn(ts)}）— 此后不计")

    roster["members"] = members
    roster["events"] = events[-200:]  # keep last 200 events
    roster["updated_at"] = iso(ts)
    return changes


def fetch_team_logins() -> Set[str]:
    """List reviewers team. Prefer STATS_TEAM_TOKEN (PAT can read org teams);
    Actions GITHUB_TOKEN often 404s → fall back to STATS_TEAM env."""
    owner = REPO.split("/", 1)[0]
    team_token = (
        os.environ.get("STATS_TEAM_TOKEN")
        or os.environ.get("GH_TOKEN")
        or os.environ.get("GITHUB_TOKEN")
        or ""
    )
    try:
        members = gh_paginate(
            f"/orgs/{owner}/teams/reviewers/members", token=team_token or None
        )
        logins = {m["login"] for m in members}
        print(f"team-sync: live reviewers team = {len(logins)} members", file=sys.stderr)
        return logins
    except GhApiError as exc:
        print("warn: cannot list reviewers team:", exc, file=sys.stderr)
        fallback = {
            u.strip()
            for u in os.environ.get("STATS_TEAM", "").split(",")
            if u.strip()
        }
        print(
            f"team-sync: using STATS_TEAM fallback ({len(fallback)} members)",
            file=sys.stderr,
        )
        return fallback


def collect(roster: Dict[str, Any]) -> Dict[str, Any]:
    owner, name = REPO.split("/", 1)
    before: collections.Counter = collections.Counter()
    after: collections.Counter = collections.Counter()
    total: collections.Counter = collections.Counter()
    today_c: collections.Counter = collections.Counter()
    detail: Dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    skipped_after_leave = collections.Counter()

    prs_reviewed_total: Set[int] = set()
    prs_reviewed_today: Set[int] = set()
    rows = 0
    pr_count = 0
    cursor = None
    day0, day1 = today_bounds()

    def credit(user: str, when: dt.datetime, kind: str, pr_n: int) -> None:
        nonlocal rows
        if not was_active_at(roster, user, when):
            if any(m.get("login") == user for m in roster.get("members", [])):
                skipped_after_leave[user] += 1
            return
        total[user] += 1
        detail[user][kind] += 1
        rows += 1
        prs_reviewed_total.add(pr_n)
        if when < CUTOFF:
            before[user] += 1
        else:
            after[user] += 1
        if day0 <= when.astimezone(TZ) < day1:
            today_c[user] += 1
            prs_reviewed_today.add(pr_n)

    while True:
        payload = gh_graphql(
            REVIEWS_QUERY, {"owner": owner, "name": name, "cursor": cursor}
        )
        if payload.get("errors"):
            raise GhApiError(str(payload["errors"]))
        conn = payload["data"]["repository"]["pullRequests"]
        for pr in conn["nodes"]:
            pr_count += 1
            n = pr["number"]
            pr_author = ((pr.get("author") or {}).get("login") or "")
            for r in pr["reviews"]["nodes"]:
                state = r.get("state")
                # 只计已提交的正式 Review；PENDING=写了没点 Submit
                if state in (None, "PENDING"):
                    continue
                user = (r.get("author") or {}).get("login")
                submitted = r.get("submittedAt")
                if not user or not submitted or is_bot_login(user):
                    continue
                when = dt.datetime.fromisoformat(submitted.replace("Z", "+00:00"))
                credit(user, when, state, n)

            # 讨论区普通评论：同一 PR 上同一人多条 → 只计 1（取最早一条时间）
            first_comment: Dict[str, dt.datetime] = {}
            for c in (pr.get("comments") or {}).get("nodes") or []:
                user = (c.get("author") or {}).get("login")
                created = c.get("createdAt")
                if not user or not created or is_bot_login(user):
                    continue
                if pr_author and user == pr_author:
                    continue  # 作者在自己 PR 下回复不算
                when = dt.datetime.fromisoformat(created.replace("Z", "+00:00"))
                prev = first_comment.get(user)
                if prev is None or when < prev:
                    first_comment[user] = when
            for user, when in first_comment.items():
                credit(user, when, "DISCUSSION", n)

            # 帮忙关 PR：ClosedEvent（含 merge），Closer ≠ 作者，非 bot
            for item in (pr.get("timelineItems") or {}).get("nodes") or []:
                if not item:
                    continue
                user = (item.get("actor") or {}).get("login")
                created = item.get("createdAt")
                if not user or not created or is_bot_login(user):
                    continue
                if pr_author and user == pr_author:
                    continue  # 自己关自己的不算「帮忙」
                when = dt.datetime.fromisoformat(created.replace("Z", "+00:00"))
                credit(user, when, "CLOSED_PR", n)
        if not conn["pageInfo"]["hasNextPage"]:
            break
        cursor = conn["pageInfo"]["endCursor"]

    active = sorted(active_member_logins(roster))
    alumni = sorted(
        {
            m["login"]
            for m in roster.get("members", [])
            if m.get("left")
        }
    )

    return {
        "cutoff": CUTOFF.isoformat(),
        "repo": REPO,
        "generated_at": iso(now_tz()),
        "local_date": day0.date().isoformat(),
        "team_members": active,
        "alumni": alumni,
        "roster": roster,
        "before": dict(before.most_common()),
        "after": dict(after.most_common()),
        "total": dict(total.most_common()),
        "today": dict(today_c.most_common()),
        "detail_by_state": {u: dict(detail[u]) for u in sorted(detail)},
        "skipped_after_leave": dict(skipped_after_leave.most_common()),
        "row_count": rows,
        "pr_count": pr_count,
        "prs_reviewed_total": len(prs_reviewed_total),
        "prs_reviewed_today": len(prs_reviewed_today),
        "reviews_today": int(sum(today_c.values())),
        "reviews_total": int(sum(total.values())),
    }


def md_table(counter: Dict[str, int], empty: str = "_（无数据）_") -> str:
    if not counter:
        return empty + "\n"
    lines = ["| 审核人 | 次数 |", "| --- | ---: |"]
    s = 0
    for u, c in counter.items():
        lines.append(f"| @{u} | {c} |")
        s += c
    lines.append(f"| **小计** | **{s}** |")
    return "\n".join(lines) + "\n"


def roster_tables(roster: Dict[str, Any], recent_events: int = 15) -> str:
    active_lines = [
        "| 审核人 | 加入时间（北京） | 状态 |",
        "| --- | --- | --- |",
    ]
    left_lines = [
        "| 审核人 | 加入时间（北京） | 退出时间（北京） | 说明 |",
        "| --- | --- | --- | --- |",
    ]
    has_left = False
    for m in sorted(roster.get("members", []), key=lambda x: x.get("login") or ""):
        login = m.get("login")
        joined = fmt_cn(m.get("joined"))
        left = m.get("left")
        if left:
            has_left = True
            left_lines.append(
                f"| @{login} | {joined} | {fmt_cn(left)} | 退出后 Review **不计** |"
            )
        else:
            active_lines.append(f"| @{login} | {joined} | 在册 |")
    parts = ["### 在册 reviewers", "", "\n".join(active_lines), ""]
    if has_left:
        parts += ["### 已退出（历史任期，退出后不计）", "", "\n".join(left_lines), ""]
    else:
        parts += ["### 已退出", "", "_暂无_", ""]
    # recent events
    ev = roster.get("events") or []
    if ev:
        parts += ["### 最近进退事件", ""]
        for e in ev[-recent_events:][::-1]:
            parts.append(
                f"- `{fmt_cn(e.get('at'))}` **{e.get('type')}** @{e.get('login')} — {e.get('note', '')}"
            )
        parts.append("")
    return "\n".join(parts)


def render_dashboard(data: Dict[str, Any], sync_notes: List[str]) -> str:
    zero = [u for u in data["team_members"] if u not in data["total"]]
    zero_s = " · ".join(f"@{u}" for u in zero) if zero else "_无_"
    detail_lines = [
        "| 审核人 | 合计 | APPROVED | CHANGES_REQUESTED | COMMENTED | DISCUSSION | CLOSED_PR | DISMISSED |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for u, c in data["total"].items():
        d = data["detail_by_state"].get(u, {})
        detail_lines.append(
            f"| @{u} | {c} | {d.get('APPROVED', 0)} | {d.get('CHANGES_REQUESTED', 0)} | "
            f"{d.get('COMMENTED', 0)} | {d.get('DISCUSSION', 0)} | {d.get('CLOSED_PR', 0)} | "
            f"{d.get('DISMISSED', 0)} |"
        )
    sync_block = ""
    if sync_notes:
        sync_block = "### 本次花名册变更\n\n" + "\n".join(f"- {x}" for x in sync_notes) + "\n\n"

    skipped = data.get("skipped_after_leave") or {}
    skip_block = ""
    if skipped:
        skip_block = (
            "### 退出后产生但不计入的 Review\n\n"
            + md_table(skipped)
            + "\n"
        )

    refreshed = fmt_cn(data["generated_at"])
    return "\n".join(
        [
            MARKER,
            "## 📊 审核次数自动统计",
            "",
            f"> **上次刷新（北京时间）**：`{refreshed}`",
            "",
            f"- 仓库：`{data['repo']}`",
            f"- 本地日：`{data['local_date']}`（Asia/Shanghai）",
            f"- 切割：`{fmt_cn(data['cutoff'])}`",
            f"- 生成时刻：`{refreshed}`（时分秒）",
            f"- **今日**：审核动作 **{data['reviews_today']}** 次 · 涉及 PR **{data['prs_reviewed_today']}** 个",
            f"- **累计**（在册期间）：审核动作 **{data['reviews_total']}** 次 · 涉及 PR **{data['prs_reviewed_total']}** 个",
            "",
            "<details><summary>统计口径（点开看）</summary>",
            "",
            "- **计**：Submit review（`APPROVED` / `CHANGES_REQUESTED` / Review·`COMMENTED`）",
            "- **计**：讨论区普通评论 → `DISCUSSION`（**同一 PR 上同一人多条只计 1**；作者自评不计）",
            "- **计**：帮忙关他人 PR（含 merge 关闭；Closer ≠ 作者）→ `CLOSED_PR`",
            "- **不计**：自己关自己的 PR、未 Submit 的 PENDING、机器人",
            "- 只统计 `reviewers` **在册期间**；退出后注明时间且不再计入",
            "",
            "</details>",
            "",
            sync_block + roster_tables(data["roster"]),
            "### 今日（审核动作）",
            "",
            md_table(data["today"], "_今日尚无审核动作_"),
            "### 10.4 之前",
            "",
            md_table(data["before"]),
            "### 10.4 至今",
            "",
            md_table(data["after"]),
            "### 合计（审核动作）",
            "",
            "\n".join(detail_lines),
            "",
            f"在册但还没留下审核动作（无 Review / 讨论评论 / 帮忙关 PR）：{zero_s}",
            "",
            skip_block,
            "_每天 21:00（北京时间）发日报；合入后由 Actions 更新。_",
            "",
        ]
    )


def digest_new_members(roster: Dict[str, Any], local_date: str) -> str:
    """当日新加入的成员（joined 落在 local_date 当天，Asia/Shanghai）。

    按 roster 里的 joined 时间戳统计全天，多次触发不漏报。
    """
    day0 = dt.datetime.fromisoformat(f"{local_date}T00:00:00+08:00")
    day1 = day0 + dt.timedelta(days=1)
    lines = []
    for m in sorted(roster.get("members", []), key=lambda x: x.get("joined") or ""):
        joined = parse_ts(m.get("joined"))
        if joined and day0 <= joined < day1:
            lines.append(f"- @{m.get('login')}（加入于 `{fmt_cn(joined)}`）")
    if not lines:
        return "_今日无新成员加入_"
    return "\n".join(lines)


def render_daily_digest(data: Dict[str, Any], sync_notes: List[str]) -> str:
    people = md_table(data["today"], "_今日尚无 Review_")
    sync = ""
    if sync_notes:
        sync = "### 今日花名册变更\n\n" + "\n".join(f"- {x}" for x in sync_notes) + "\n\n"
    refreshed = fmt_cn(data["generated_at"])
    return "\n".join(
        [
            DIGEST_MARKER,
            f"## 📅 审核日报 {data['local_date']}",
            "",
            f"> **本条更新（北京时间）**：`{refreshed}`",
            "",
            f"- **今日审核动作**：{data['reviews_today']}",
            f"- **今日涉及 PR 数**：{data['prs_reviewed_today']}",
            f"- **累计审核动作**：{data['reviews_total']}",
            f"- **累计涉及 PR 数**：{data['prs_reviewed_total']}",
            f"- 生成时刻：`{refreshed}`（时分秒）",
            "",
            "> 计：正式 Review + 讨论区评论（同 PR 每人 1 次）+ 帮忙关他人 PR；机器人 / 自评不计。",
            "",
            sync,
            "### 今日各审核人",
            "",
            people,
            "### 今日新加入成员",
            "",
            digest_new_members(data["roster"], data["local_date"]),
            "",
            "---",
            "",
            "## 🗂️ 当日总花名册快照",
            "",
            roster_tables(data["roster"], recent_events=5),
            "_Actions 自动发送 · 北京时间每天 21:00 · 当天重复触发只更新本条_",
            "",
        ]
    )


def upsert_marked_comment(
    marker: str, body: str, replace: bool = False, digest_date: str | None = None
) -> None:
    """Update only comments we own; otherwise POST a new one (never PATCH others')."""
    comments = gh_paginate(f"/repos/{REPO}/issues/{ISSUE_NUMBER}/comments")
    owned = token_actor_logins()
    mine = [
        c
        for c in comments
        if marker in (c.get("body") or "")
        and ((c.get("user") or {}).get("login") or "") in owned
    ]
    # 日报按天去重：当天已有 → PATCH 那条；否则 POST（一天多次触发不刷屏）
    if marker == DIGEST_MARKER and not replace:
        if digest_date:
            dated = f"审核日报 {digest_date}"
            today = next(
                (c for c in mine if dated in (c.get("body") or "")), None
            )
            if today:
                gh_api(
                    f"/repos/{REPO}/issues/comments/{today['id']}",
                    method="PATCH",
                    body={"body": body},
                )
                print(f"updated daily digest comment {today['id']} for {digest_date}")
                return
        gh_api(
            f"/repos/{REPO}/issues/{ISSUE_NUMBER}/comments",
            method="POST",
            body={"body": body},
        )
        print("created daily digest comment")
        return

    existing = mine[-1] if mine else None
    if existing and (replace or marker in (MARKER, ROSTER_MARKER)):
        try:
            gh_api(
                f"/repos/{REPO}/issues/comments/{existing['id']}",
                method="PATCH",
                body={"body": body},
            )
            print(f"updated comment {existing['id']} marker={marker}")
            return
        except GhApiError as exc:
            if "403" not in str(exc) and "404" not in str(exc):
                raise
            print(f"warn: cannot edit comment {existing['id']}, creating new: {exc}")

    gh_api(
        f"/repos/{REPO}/issues/{ISSUE_NUMBER}/comments",
        method="POST",
        body={"body": body},
    )
    print(f"created comment marker={marker}")


def main() -> None:
    roster = load_roster_from_issue() or load_roster_seed()
    team = fetch_team_logins()
    # If seed empty and team available, bootstrap
    if not roster.get("members") and team:
        ts = "2026-09-01T00:00:00+08:00"
        roster["members"] = [
            {"login": u, "joined": ts, "left": None, "source": "bootstrap"}
            for u in sorted(team)
        ]
        roster["events"] = []
        roster["tracking_started"] = iso(now_tz())

    sync_notes = sync_roster_with_team(roster, team)
    # persist seed file locally when possible
    try:
        ROSTER_PATH.write_text(
            json.dumps(roster, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    except OSError as exc:
        print("warn: cannot write roster file:", exc, file=sys.stderr)

    data = collect(roster)
    out_path = os.environ.get("STATS_OUT", "")
    if out_path:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("wrote", out_path)

    summary = (
        f"DATE={data['local_date']} "
        f"TODAY_REVIEWS={data['reviews_today']} TODAY_PRS={data['prs_reviewed_today']} "
        f"TOTAL_REVIEWS={data['reviews_total']} TOTAL_PRS={data['prs_reviewed_total']} "
        f"ACTIVE={len(data['team_members'])} ALUMNI={len(data['alumni'])} "
        f"SYNC={json.dumps(sync_notes, ensure_ascii=False)} "
        f"BY={json.dumps(data['today'], ensure_ascii=False)}"
    )
    print(summary)

    if os.environ.get("STATS_UPDATE_ISSUE", "1") == "1":
        if not GH_TOKEN:
            raise SystemExit("GH_TOKEN/GITHUB_TOKEN required to update issue")
        save_roster_issue(roster)
        upsert_marked_comment(MARKER, render_dashboard(data, sync_notes), replace=True)
        if POST_DIGEST:
            upsert_marked_comment(
                DIGEST_MARKER,
                render_daily_digest(data, sync_notes),
                replace=False,
                digest_date=data["local_date"],
            )


if __name__ == "__main__":
    main()
