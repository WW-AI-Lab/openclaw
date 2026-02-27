# PR 预处理报告 — WW-AI-Lab/openclaw

**生成日期:** 2026-03-05
**仓库:** https://github.com/WW-AI-Lab/openclaw
**Open PR 总数:** 10（#1 ~ #11，#9 已关闭）
**提交者:** 全部为 Dependabot 自动依赖更新

---

## 一、总览

| PR | 标题 | 类型 | 影响文件 | +/- | 可合并 | 建议操作 |
|----|------|------|----------|-----|--------|----------|
| #1 | Docker images 更新 (node + debian) | Docker 基础镜像 | 3 | +3/-3 | MERGEABLE | **合并** |
| #2 | swift-testing 0.99.0 → 6.2.4 (Swabble) | Swift 依赖 + **混入本地变更** | 12 | +6490/-1757 | **冲突** | **关闭** |
| #3 | setup-java v4 → v5 | GitHub Actions | 1 | +1/-1 | MERGEABLE | **合并** |
| #4 | setup-node 4.4.0 → 6.2.0 | GitHub Actions | 2 | +2/-2 | MERGEABLE | **合并** |
| #5 | MenuBarExtraAccess 1.2.2 → 1.3.0 (macOS) | Swift 依赖 + **混入本地变更** | 26 | +2104/-32 | **冲突** | **关闭** |
| #6 | upload-artifact v4 → v7 | GitHub Actions | 1 | +2/-2 | MERGEABLE | **合并** |
| #7 | download-artifact v4 → v8 | GitHub Actions | 1 | +1/-1 | MERGEABLE | **合并** |
| #8 | gradle/actions v4 → v5 | GitHub Actions | 1 | +1/-1 | MERGEABLE | **合并** |
| #10 | uiautomator 2.4.0-alpha06 → 2.4.0-beta01 | Android 依赖 | 1 | +1/-1 | MERGEABLE | **合并** |
| #11 | Android deps 分组更新 (8 依赖) | Android 依赖 | 7 | +20/-20 | MERGEABLE | **合并** |

---

## 二、逐 PR 详细分析

### PR #1 — Docker 基础镜像更新
- **URL:** https://github.com/WW-AI-Lab/openclaw/pull/1
- **变更:** 更新 3 个 Dockerfile 中的基础镜像 SHA
  - `node:22-bookworm` SHA 更新
  - `debian:bookworm-slim` SHA 更新（影响 sandbox + sandbox-browser）
- **风险:** ⬇ **低** — 仅更新镜像 SHA digest，不改变镜像 tag，属于安全补丁
- **注意:** `upload-artifact`/`download-artifact` 升级（#6/#7）可能影响 CI 使用这些 Dockerfile 的流程，建议先合并此 PR
- **建议:** ✅ 合并

---

### PR #2 — swift-testing 0.99.0 → 6.2.4 (Swabble) ⚠️
- **URL:** https://github.com/WW-AI-Lab/openclaw/pull/2
- **变更:** 表面上是 Swabble 目录的 swift-testing 依赖升级，但 diff 内混入了大量本地自定义变更：
  - `.gitignore` 新增 `OpenClaw-Office/`
  - `README.md` 新增 Web Search (Metaso / Qwen) 文档
  - `docs/zh-CN/架构/plugins-skills-hooks-guide.md` 新增 850 行中文文档
  - `pnpm-lock.yaml` 变更
  - `src/agents/tools/web-search.ts`、`src/config/*` 等核心代码变更
- **风险:** ⬆ **高**
  - 版本跨度极大 (0.99.0 → 6.2.4)，可能有 API 不兼容
  - 混入了与 Dependabot 无关的本地改动，说明 Dependabot 分支基于了一个包含本地变更的 base
  - **存在合并冲突**
- **建议:** ❌ **关闭** — 依赖升级部分可手动处理；混入的本地变更应通过独立 PR 管理

---

### PR #3 — setup-java v4 → v5
- **URL:** https://github.com/WW-AI-Lab/openclaw/pull/3
- **变更:** `.github/workflows/ci.yml` 中 `actions/setup-java@v4` → `@v5`
- **风险:** ⬇ **低** — 主要是升级到 Node 24 运行时，需要 runner v2.327.1+（GitHub hosted runners 已支持）
- **注意:** 包含安全修复（form-data 漏洞修复、undici 升级）
- **建议:** ✅ 合并

---

### PR #4 — setup-node 4.4.0 → 6.2.0
- **URL:** https://github.com/WW-AI-Lab/openclaw/pull/4
- **变更:**
  - `.github/workflows/ci.yml` — setup-node pinned hash 更新
  - `.github/workflows/install-smoke.yml` — 同上
- **风险:** ⬇ **低** — 标准 GitHub Actions 升级，功能向后兼容
- **注意:** 版本跳跃较大 (4.x → 6.x)，但 setup-node 的主要功能（安装 Node.js）没有 breaking change 影响本仓库
- **建议:** ✅ 合并

---

### PR #5 — MenuBarExtraAccess 1.2.2 → 1.3.0 (macOS) ⚠️
- **URL:** https://github.com/WW-AI-Lab/openclaw/pull/5
- **变更:** 表面是 macOS 应用 Swift 依赖升级，但 diff 内混入了大量本地变更（与 PR #2 类似）：
  - `.gitignore`、`README.md` (npm 包名替换 + Web Search 文档)
  - `docs/*` 多处 `openclaw@latest` → `@ww-ai-lab/openclaw@latest`
  - `package.json`、`src/config/*`、`src/agents/tools/web-search.ts` 等核心代码
  - `src/infra/openclaw-root.ts`、`src/infra/update-runner.ts` 等基础设施代码
- **风险:** ⬆ **高**
  - MenuBarExtraAccess 1.3.0 有 **breaking change**: `menuBarExtraAccess(...)` 必须是 MenuBarExtra 的第一个 modifier
  - 混入了大量与依赖更新无关的本地改动
  - **存在合并冲突**
- **建议:** ❌ **关闭** — MenuBarExtraAccess 升级需要单独评估 breaking change 影响，混入的变更应独立处理

---

### PR #6 — upload-artifact v4 → v7
- **URL:** https://github.com/WW-AI-Lab/openclaw/pull/6
- **变更:** `.github/workflows/ci.yml` 中 2 处 `actions/upload-artifact@v4` → `@v7`
- **风险:** ⬇ **低** — v7 新增直接上传功能（无需 zip），ESM 升级，向后兼容现有用法
- **注意:** 建议与 #7 (download-artifact) 一起合并，保持 upload/download 版本配套
- **建议:** ✅ 合并（与 #7 配对）

---

### PR #7 — download-artifact v4 → v8
- **URL:** https://github.com/WW-AI-Lab/openclaw/pull/7
- **变更:** `.github/workflows/ci.yml` 中 1 处 `actions/download-artifact@v4` → `@v8`
- **风险:** ⬇ **低** — v8 增加了 digest 校验（默认 error），不再自动解压非 zip 文件
- **注意:** 与 #6 (upload-artifact v7) 配套，建议同时合并
- **建议:** ✅ 合并（与 #6 配对）

---

### PR #8 — gradle/actions v4 → v5
- **URL:** https://github.com/WW-AI-Lab/openclaw/pull/8
- **变更:** `.github/workflows/ci.yml` 中 `gradle/actions/setup-gradle@v4` → `@v5`
- **风险:** ⬇ **低** — 主要是升级到 Node 24，需要 runner v2.327.1+
- **建议:** ✅ 合并

---

### PR #10 — uiautomator 2.4.0-alpha06 → 2.4.0-beta01
- **URL:** https://github.com/WW-AI-Lab/openclaw/pull/10
- **变更:** `apps/android/benchmark/build.gradle.kts` 中 1 行依赖版本
- **风险:** ⬇ **低** — alpha → beta 阶段升级，API 更稳定
- **注意:** PR #11 包含了更全面的 Android 依赖更新（但不含此 uiautomator 变更），两者不冲突
- **建议:** ✅ 合并

---

### PR #11 — Android deps 分组更新 (8 依赖)
- **URL:** https://github.com/WW-AI-Lab/openclaw/pull/11
- **变更:** Android 应用的 8 个依赖批量更新：
  - Kotlin Compose/Serialization: 2.2.21 → 2.3.10
  - Compose BOM: 2026.02.00 → 2026.02.01
  - Kotest: 6.1.3 → 6.1.4
  - JUnit Vintage: 6.0.2 → 6.0.3
  - AndroidX Test Ext JUnit: 1.2.1 → 1.3.0
  - Gradle Wrapper: 9.2.1 → 9.3.1（含 gradlew 脚本更新）
- **风险:** 🔶 **中低**
  - Kotlin 2.2.x → 2.3.x 有一些编译器变更，但属于 minor 升级
  - Gradle Wrapper 9.2 → 9.3 含构建脚本格式变化（classpath → jar 方式）
  - 替代了已关闭的 PR #9
- **注意:** 与 #10 (uiautomator) 更新同一个文件 `benchmark/build.gradle.kts`，但修改不同行，不冲突
- **建议:** ✅ 合并

---

## 三、建议合并顺序

考虑到文件冲突风险和依赖关系，建议按以下顺序合并：

| 步骤 | PR | 说明 |
|------|----|------|
| 1 | #1 | Docker 基础镜像（独立，无冲突） |
| 2 | #3 | setup-java（ci.yml 行 706） |
| 3 | #8 | gradle/actions（ci.yml 行 718） |
| 4 | #6 | upload-artifact（ci.yml 行 81, 222） |
| 5 | #7 | download-artifact（ci.yml 行 105） |
| 6 | #4 | setup-node（ci.yml + install-smoke.yml） |
| 7 | #10 | uiautomator（benchmark/build.gradle.kts） |
| 8 | #11 | Android deps 分组（多个 gradle 文件） |

**关闭：**
| PR | 原因 |
|----|------|
| #2 | 混入本地变更 + 合并冲突 + 版本跨度大，建议手动处理 |
| #5 | 混入本地变更 + 合并冲突 + 含 breaking change，建议手动处理 |

---

## 四、特别风险提示

1. **PR #2 和 #5 混入了本地自定义变更**（npm 包名替换、Web Search 功能代码、中文文档等），这些变更看似是在 fork 仓库 main 分支上做了本地定制后，Dependabot 创建的分支包含了这些变更的 diff。关闭后应检查这些本地变更是否已经合入 main。

2. **CI 状态均为 UNSTABLE**（checks pending），合并后建议观察 CI 是否通过。

3. **GitHub Actions 多个 PR 都修改 `ci.yml`**（#3, #4, #6, #7, #8），虽然修改的行不同不会直接冲突，但每次合并后后续 PR 可能需要 rebase。建议快速连续合并或使用 merge queue。

4. **MenuBarExtraAccess 1.3.0 (PR #5)** 有 breaking change，即使关闭此 PR，如果需要升级该依赖，需要先确认 macOS 应用代码中 `menuBarExtraAccess(...)` 是否已经是第一个 modifier。
