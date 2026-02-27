---
name: sync-upstream-release
description: 同步上游 OpenClaw 最新代码，合并本地自定义（qwen、秘塔搜索等），构建并发布到 npm 和 GitHub。适用于每次上游发布新版本后需要同步更新本地 fork 的场景。
license: MIT
metadata:
  author: WW-AI-Lab
  version: "1.0"
---

# 同步上游 OpenClaw 并发布

将上游 openclaw/openclaw 的最新代码合并到本地 fork (WW-AI-Lab/openclaw)，保留本地自定义功能（qwen、秘塔搜索等），构建、发布到 npm，安装更新本地环境并重启 gateway，最后发布 GitHub release。

---

## 前置信息

- 上游仓库: `origin` -> `git@github.com:openclaw/openclaw.git`
- Fork 仓库: `myfork` -> `git@github.com:WW-AI-Lab/openclaw.git`
- npm 包名: `@ww-ai-lab/openclaw`
- npm registry: `https://registry.npmjs.org/`（发布时必须指定，因为默认 registry 是 npmmirror 镜像）
- 本地自定义功能（合并时必须保留）:
  - `src/agents/tools/web-search.ts` — metaso (秘塔搜索) 和 qwen 搜索提供商
  - `src/config/types.tools.ts` — metaso/qwen 配置类型定义
  - `src/config/schema.labels.ts` — metaso/qwen 配置标签
  - `src/config/zod-schema.agent-runtime.ts` — metaso/qwen zod schema
  - `src/config/config.web-search-provider.test.ts` — metaso/qwen 测试
  - `src/config/schema.help.ts` — metaso/qwen 帮助文本
  - `package.json` — 包名改为 `@ww-ai-lab/openclaw`
  - `src/infra/openclaw-root.ts` — 添加 `@ww-ai-lab/openclaw` 到 CORE_PACKAGE_NAMES
  - `src/cli/update-cli/shared.ts` — 添加 `@ww-ai-lab/openclaw` 到更新包名

---

## 执行步骤

### 步骤 1: 了解当前状态

```bash
git remote -v                     # 确认 origin 和 myfork 配置
git branch --show-current         # 确认在 main 分支
git log --oneline -5              # 查看本地最近提交
node -e "const p=require('./package.json'); console.log(p.name, p.version)"
```

检查上游最新版本和 release：
```bash
git fetch origin --tags
gh release list --repo openclaw/openclaw --limit 3
git log --oneline origin/main -5
git tag --sort=-v:refname | head -5
```

### 步骤 2: 合并上游代码

```bash
git merge origin/main
```

- 如果没有冲突，直接进入下一步
- 如果有冲突，逐文件解决：
  - **保留本地自定义**的文件（web-search.ts、types.tools.ts 等）以本地版本为主
  - **依赖版本同步**：`package.json` 中的 dependencies/devDependencies 应使用上游版本，但保留以下本地专属项:
    - `name: "@ww-ai-lab/openclaw"`
    - `@larksuiteoapi/node-sdk`（飞书 SDK）
    - `google-auth-library`
    - `@ww-ai-lab/openclaw` 相关的包名引用
  - 可使用脚本合并 package.json 依赖：从上游取 dependencies/devDependencies/pnpm/scripts，叠加本地自定义项

**注意**：检查 `zod-schema.agent-runtime.ts` 是否有重复的 metaso/qwen 定义（之前出现过），如有则删除重复项。

### 步骤 3: 确定版本号

版本号格式: `YYYY.M.D`（与上游一致），使用当前日期。
如果当日已有版本，则使用 `YYYY.M.D-N` 格式（N 从 1 递增）。

```bash
# 检查当天是否已有版本
git tag -l "v$(date +%Y.%-m.%-d)*"
npm view @ww-ai-lab/openclaw version --userconfig "$(mktemp)" --registry https://registry.npmjs.org/
```

在 `package.json` 中更新版本号。

### 步骤 4: 安装依赖并构建

```bash
pnpm install --no-frozen-lockfile  # 更新 lockfile
pnpm build                         # 构建项目
```

- 如果构建失败，检查类型错误（常见问题：`@mariozechner/pi-agent-core` 版本不一致）
- 确保 `package.json` 中的 `@mariozechner/pi-*` 相关包版本与上游一致

### 步骤 5: 提交改动

```bash
git add package.json pnpm-lock.yaml src/config/zod-schema.agent-runtime.ts
git commit -m "chore: bump version to YYYY.M.D, sync upstream deps"
```

包含所有变更的文件（版本号变更、lockfile 更新、schema 修复等）。

### 步骤 6: 发布到 npm

```bash
npm publish --access public --registry https://registry.npmjs.org/
```

验证发布成功：
```bash
npm view @ww-ai-lab/openclaw version --userconfig "$(mktemp)" --registry https://registry.npmjs.org/
```

### 步骤 7: 安装到本地全局环境

```bash
pnpm add -g @ww-ai-lab/openclaw@YYYY.M.D --registry https://registry.npmjs.org/
openclaw --version  # 确认版本更新
```

### 步骤 8: 重启 Gateway

```bash
# 方式 1: 通过 launchd 重启
launchctl kickstart -k gui/$UID/ai.openclaw.gateway

# 方式 2: 完整重启流程
openclaw gateway stop
openclaw gateway install --force
openclaw daemon restart
```

等待 gateway 启动完成（约 5-10 秒）。

### 步骤 9: 验证服务正常

```bash
# 检查 gateway 状态
openclaw doctor

# 检查通道状态（可能需要指定 token）
OPENCLAW_GATEWAY_TOKEN="<token>" openclaw channels status --probe

# 检查 gateway 日志
tail -30 ~/.openclaw/logs/gateway.log
```

预期结果：
- Feishu: enabled, configured, running, works
- DingTalk: enabled, configured, running, works
- 日志中无 error

如果 `channels status` 显示 token mismatch，使用以下命令获取 token：
```bash
python3 -c "import json; d=json.load(open('$HOME/.openclaw/openclaw.json')); print(d['gateway']['auth']['token'])"
```
然后通过环境变量传入验证。

### 步骤 10: 推送到 GitHub 并创建 Release

```bash
# 推送代码
git push myfork main --force  # fork 仓库使用 force push 同步

# 创建 tag
git tag vYYYY.M.D
git push myfork vYYYY.M.D

# 获取上游 release notes
gh release view <upstream-latest-tag> --repo openclaw/openclaw --json body -q .body > /tmp/upstream-release-notes.md

# 创建 release
gh release create vYYYY.M.D --repo WW-AI-Lab/openclaw --title "openclaw YYYY.M.D" --notes-file /tmp/upstream-release-notes.md
```

---

## 故障排除

### 构建失败：pi-agent-core 类型不兼容
- 原因：`@mariozechner/pi-agent-core` 版本与上游不一致
- 修复：将 `package.json` 中所有 `@mariozechner/pi-*` 包版本改为与上游一致

### npm publish 报 ENEEDAUTH
- 原因：默认 registry 指向 npmmirror 镜像
- 修复：发布时指定 `--registry https://registry.npmjs.org/`
- 确认登录状态：`npm whoami --registry https://registry.npmjs.org/`

### Gateway token mismatch
- CLI status 命令显示 token mismatch，但实际通道正常
- 使用 `OPENCLAW_GATEWAY_TOKEN=<token> openclaw channels status --probe` 验证
- 或检查 gateway 日志确认通道连接正常

### zod schema 重复定义
- 合并后检查 `src/config/zod-schema.agent-runtime.ts` 中 metaso 和 qwen 是否出现两次
- 如有重复，删除多余的定义块

---

## 回滚方案

如果发布的版本有问题：
1. `npm unpublish @ww-ai-lab/openclaw@YYYY.M.D --registry https://registry.npmjs.org/`（24小时内）
2. 回退本地全局安装：`pnpm add -g @ww-ai-lab/openclaw@<previous-version> --registry https://registry.npmjs.org/`
3. 重启 gateway
