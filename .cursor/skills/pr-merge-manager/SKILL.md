---
name: pr-merge-manager
description: 分析仓库中待处理的 Pull Request，评估合并风险、判断来源（dependabot/bot/人工），自动执行合并或关闭，并生成处理报告。适用于批量处理 dependabot PR、审查外部贡献者 PR、持续监控 PR 队列等场景。
license: MIT
metadata:
  author: WW-AI-Lab
  version: "1.0"
---

# PR 合并管理器

分析指定仓库的 Pull Request 队列，对每个 PR 进行风险评估和来源判断，按策略自动合并或关闭，最后输出处理报告。

---

## 输入参数

执行前需确认以下信息：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `repo` | 当前仓库 | 目标仓库 `owner/repo` |
| `state` | `open` | PR 状态筛选 |
| `auto_merge` | `true` | 是否自动合并低风险 PR |
| `dry_run` | `false` | 仅分析不执行 |

---

## 执行流程

### 步骤 1: 获取 PR 列表

```bash
gh pr list --repo <repo> --state open \
  --json number,title,author,labels,createdAt,headRefName,mergeable,reviewDecision,checksPassedCount,checksFailingCount,body \
  --limit 50
```

### 步骤 2: 逐个分析每个 PR

对每个 PR 执行以下分析，填写分析矩阵：

#### 2.1 来源分类

| 来源类型 | 判断条件 | 默认信任度 |
|----------|----------|------------|
| `dependabot` | `author.login` 为 `app/dependabot` 或 `dependabot[bot]` | 高 |
| `renovate` | `author.login` 为 `app/renovate` 或 `renovate[bot]` | 高 |
| `github-bot` | `author.login` 包含 `[bot]` 且非上述 | 中 |
| `team-member` | author 在仓库 collaborators 列表中 | 高 |
| `external` | 以上都不是 | 低 — 需人工审查 |

#### 2.2 变更类型分类

通过 PR 标题、labels 和变更文件判断：

| 变更类型 | 判断依据 | 风险等级 |
|----------|----------|----------|
| `github-actions` | label 含 `github_actions`，或文件在 `.github/workflows/` | 低 |
| `docker` | label 含 `docker`，或文件为 `Dockerfile`/`docker-compose` | 低 |
| `npm-deps-minor` | label 含 `dependencies`，标题含 `bump`，版本为 minor/patch | 低 |
| `npm-deps-major` | label 含 `dependencies`，版本为 major 升级 | 中 |
| `swift-deps` | label 含 `swift_package_manager` | 低-中 |
| `source-code` | 变更涉及 `src/`、`apps/`、`extensions/` | 高 |
| `config-infra` | 变更涉及配置/CI 但非上述 | 中 |

#### 2.3 版本跳跃分析（针对依赖更新 PR）

从 PR 标题提取版本变更信息：
- **patch** (`x.y.1` → `x.y.2`): 风险低
- **minor** (`x.1.z` → `x.2.0`): 风险低-中
- **major** (`1.x.y` → `2.0.0`): 风险中 — 可能有破坏性变更

#### 2.4 综合风险评分

```
风险 = f(来源信任度, 变更类型风险, 版本跳跃幅度, CI 状态)
```

| 综合评分 | 条件 | 建议操作 |
|----------|------|----------|
| `AUTO_MERGE` | 来源信任=高 且 变更风险=低 且 无 CI 失败 | 自动合并 |
| `REVIEW_MERGE` | 来源信任=高 且 (变更风险=中 或 CI 未运行) | 提示后合并 |
| `MANUAL_REVIEW` | 来源信任=低 或 变更风险=高 | 需人工审查 |
| `AUTO_CLOSE` | PR 已过期(>90天) 或 与已合并 PR 重复 | 自动关闭 |

### 步骤 3: 执行操作

对每个 PR 按评分执行对应操作：

**AUTO_MERGE:**
```bash
gh pr merge <number> --repo <repo> --merge --auto
```
如果 `--auto` 不可用（无 branch protection），使用：
```bash
gh pr merge <number> --repo <repo> --merge
```

**REVIEW_MERGE:**
先输出分析结论和风险点，等待确认后执行合并。

**MANUAL_REVIEW:**
仅输出分析报告，不执行任何操作。

**AUTO_CLOSE:**
```bash
gh pr close <number> --repo <repo> --comment "Closing: <reason>"
```

### 步骤 4: 生成报告

输出 markdown 格式的处理报告：

```markdown
# PR 处理报告

**仓库**: owner/repo
**时间**: YYYY-MM-DD HH:MM
**处理数量**: N 个 PR

## 处理结果汇总

| PR | 标题 | 来源 | 变更类型 | 风险 | 操作 | 状态 |
|----|------|------|----------|------|------|------|
| #N | ... | dependabot | github_actions | 低 | 合并 | ✅ |

## 详细分析

### PR #N: <title>
- **来源**: dependabot (信任度: 高)
- **变更类型**: github_actions (风险: 低)
- **版本跳跃**: minor (7.1.0 → 8.0.0)
- **CI 状态**: 通过/未运行/失败
- **决策**: AUTO_MERGE
- **执行结果**: ✅ 已合并 / ❌ 失败 (原因)

## 需要人工关注的 PR

(如有需要人工审查的 PR，在此列出详细原因)
```

---

## 风险控制规则

1. **永远不自动合并**来源为 `external` 的 PR
2. **永远不自动合并**涉及 `src/` 核心代码的 PR
3. `major` 版本升级的依赖 PR 标记为 `REVIEW_MERGE`，需确认后合并
4. CI 失败的 PR 不自动合并，标记为 `MANUAL_REVIEW`
5. 单次批量合并上限为 20 个 PR，超出时分批处理
6. 合并前检查 PR 是否仍然处于 `open` 状态（防止并发冲突）
7. 合并后如有后续 PR 因冲突变为 unmergeable，记录但不自动处理

---

## 常见场景

### 场景 A: dependabot 批量更新
最常见场景。dependabot 创建的 CI/docker/依赖小版本更新通常可安全自动合并。

### 场景 B: 外部贡献者 PR
标记为 `MANUAL_REVIEW`，输出变更文件列表和风险分析，由人工决定。

### 场景 C: 定期清理
关闭超过 90 天未活动的 PR，附带关闭原因。

---

## 故障处理

### 合并冲突
```bash
# 如果 PR 显示有合并冲突
gh pr view <number> --repo <repo> --json mergeable --jq .mergeable
```
冲突的 PR 标记为 `MANUAL_REVIEW`，不自动处理。

### API 限流
如果 GitHub API 返回 429，等待 60 秒后重试，最多 3 次。

### 权限不足
检查当前 token 是否有 `repo` 和 `write:discussion` 权限。
