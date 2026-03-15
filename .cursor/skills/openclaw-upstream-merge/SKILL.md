---
name: openclaw-upstream-merge
description: |
  合并上游 openclaw/openclaw 源码到本 Fork (@ww-ai-lab/openclaw)，保留本地自定义功能（qwen/metaso web_search 供应商），
  构建、本地安装验证、发布到 npmjs 和 GitHub。适用于用户要求"合并上游"、"同步上游"、"更新上游"、"拉取上游代码"、
  "发布新版本"、"sync upstream" 等场景。此 skill 封装了完整的 8 步流程，包含历史教训和防护措施。
---

# 合并上游源码全流程

## 前置条件

- 仓库根目录为 `openclaw/openclaw` Fork，包名已改为 `@ww-ai-lab/openclaw`
- 远程 `origin` 指向上游 `openclaw/openclaw`，`myfork` 指向用户的 Fork
- 当前在 `develop` 或 `main` 分支
- 自定义保护规则详见 `AGENTS.md` 的"合并上游源码保护规则"部分

## 流程总览

```
步骤1: 拉取上游 → 步骤2: 合并解冲突 → 步骤3: 版本号 → 步骤4: 修复引用
→ 步骤5: 构建安装验证 → 步骤6: 问题修复循环 → 步骤7: 发布 npmjs → 步骤8: 推送 GitHub
```

---

## 步骤 1：拉取上游分支

```bash
git fetch origin
git log --oneline origin/main -10   # 查看上游最新提交
git log --oneline HEAD -5           # 查看本地最新提交
```

对比上游和本地的差异：
```bash
git log --oneline HEAD..origin/main | wc -l   # 上游领先多少提交
```

## 步骤 2：合并上游，保留自定义代码

### 2.1 执行合并

```bash
git merge origin/main --no-edit
```

若出现冲突，按以下优先级解决：

### 2.2 冲突解决策略

**高优先级文件（必须保留本地修改）：**

| 文件 | 策略 |
|------|------|
| `src/agents/tools/web-search.ts` | 保留本地 qwen/metaso 全部代码，同时接受上游对其他 provider 的修改 |
| `src/config/types.tools.ts` | 保留本地 qwen/metaso 类型定义 |
| `src/config/zod-schema.agent-runtime.ts` | 保留本地 qwen/metaso schema |
| `src/config/schema.help.ts` | 保留本地 qwen/metaso 帮助文本 |
| `src/config/schema.labels.ts` | 保留本地 qwen/metaso 标签 |
| `package.json` | 保留本地 `"name": "@ww-ai-lab/openclaw"` 和自定义版本号 |

**低优先级文件（接受上游）：**

| 文件 | 策略 |
|------|------|
| `AGENTS.md` / `CLAUDE.md` | 接受上游版本（本地保护规则已迁移到 `AGENTS.md`） |
| `pnpm-lock.yaml` | 接受上游版本，后续重新生成 |
| 其他无自定义修改的文件 | 接受上游版本 |

### 2.3 合并后验证

检查 merge conflict markers 残留：
```bash
grep -rn '<<<<<<\|>>>>>>\|======' src/agents/tools/web-search.ts src/config/types.tools.ts src/config/zod-schema.agent-runtime.ts
```
若有，立即清理。

检查自定义代码完整性：
```bash
grep -c 'metaso\|qwen' src/agents/tools/web-search.ts
# 预期 ≥ 70。若为 0 或显著偏低，说明代码被覆盖，需手动恢复。
```

关键函数检查清单（任一缺失则需从历史提交恢复）：
- `runMetasoSearch` / `runQwenSearch`
- `resolveMetasoConfig` / `resolveQwenConfig`
- `resolveMetasoApiKey` / `resolveQwenApiKey`
- `MetasoConfig` 类型 / `QwenConfig` 类型
- `SEARCH_PROVIDERS` 数组含 `"metaso"`, `"qwen"`

恢复方式：从最近的包含 qwen/metaso 的提交 cherry-pick 或手动应用 diff。
参见 [自定义代码参考](references/custom-code-inventory.md)。

## 步骤 3：确定版本号

```bash
# 查看当前 npmjs 上的版本
npm view @ww-ai-lab/openclaw version --userconfig "$(mktemp)"

# 确定今日日期版本
# 格式: YYYY.M.D（如 2026.3.10）
# 若 npmjs 已有相同版本，追加子版本号: YYYY.M.D-N（如 2026.3.10-1）
```

修改 `package.json` 中的 `version` 字段。

## 步骤 4：修复引用和依赖

### 4.1 修复工作区引用

上游合并可能将 `"@ww-ai-lab/openclaw": "workspace:*"` 重置为 `"openclaw": "workspace:*"`。

```bash
# 检查并修复
grep '"openclaw": "workspace' packages/clawdbot/package.json packages/moltbot/package.json
```

若发现 `"openclaw": "workspace:*"`，替换为 `"@ww-ai-lab/openclaw": "workspace:*"`。

### 4.2 重新安装依赖

```bash
pnpm install --no-frozen-lockfile
```

验证关键依赖版本：
```bash
node -e "console.log(require('./node_modules/@mariozechner/pi-ai/package.json').version)"
# 必须 ≥ 0.57.1（含 ./oauth 子路径导出）
```

## 步骤 5：构建、安装、验证

### 5.1 构建（必须同时包含 TypeScript + UI）

```bash
# 清除旧构建产物，避免残留 chunk 干扰
rm -rf dist/

# 构建 TypeScript（优先 pnpm build，失败则 fallback 到 esbuild）
pnpm build || node scripts/tsdown-build.mjs

# 【关键】构建 Control UI — pnpm build 不包含此步骤，必须单独执行
pnpm ui:build
```

> **⚠️ 教训 (2026.3.11)**：`pnpm build` 仅构建 TypeScript 和 A2UI，**不构建 Control UI**。
> 若跳过 `pnpm ui:build`，`dist/control-ui/` 将不存在，安装后 gateway 没有 Web 管理界面。
> 只有 `prepack`（npm publish 触发）才会自动串联 `build` + `ui:build`。

### 5.1.1 构建产物验证（必须全部通过）

```bash
# 验证 dist/control-ui 存在（UI 界面）
ls dist/control-ui/index.html || echo "FAIL: Control UI 未构建！运行 pnpm ui:build"

# 验证 metaso/qwen schema 在 dist 中完整
grep -c 'metaso\|qwen' dist/*.js | awk -F: '{s+=$2} END{print "metaso/qwen 总引用:", s, (s>=30?"OK":"FAIL: schema 可能不完整")}'

# 验证 dist/index.js 存在
ls dist/index.js || echo "FAIL: dist/index.js 不存在"
```

### 5.2 本地安装

```bash
# 清除 npm install 可能产生的 package-lock.json（pnpm 工作区不需要）
rm -f package-lock.json

npm install -g .
```

### 5.3 重启 Gateway 并验证

```bash
openclaw gateway restart
sleep 5
openclaw gateway status
# 确认: "RPC probe: ok"
```

### 5.4 验证配置完整性

```bash
openclaw config get tools.web.search
# 确认输出包含:
#   "provider": "qwen"（或用户设定的值）
#   "qwen": { "apiKey": "...", "model": "...", ... }
#   "metaso": { "apiKey": "...", ... }
```

```bash
# 【关键】运行 openclaw doctor，确认不再出现 "Invalid config" / "Unrecognized keys" 错误
openclaw doctor 2>&1 | grep -i 'invalid config\|unrecognized key'
# 预期：无输出。若有 "Unrecognized keys: metaso, qwen"，说明 dist 中 schema 不完整，需要重新清理构建。
```

```bash
# 验证 UI 界面可访问
curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:18789/
# 预期：200。若非 200，确认 dist/control-ui/ 已正确构建。
```

若 qwen/metaso 配置丢失，从备份恢复：
```bash
# 查找包含 qwen 配置的备份
for f in ~/.openclaw/openclaw.json.bak* ~/.openclaw/openclaw.json-bak*; do
  echo "=== $f ==="
  python3 -c "
import json
with open('$f') as fh:
    cfg = json.load(fh)
search = cfg.get('tools',{}).get('web',{}).get('search',{})
print(f'  qwen: {json.dumps(search.get(\"qwen\",\"(not set)\"))}')
print(f'  metaso: {json.dumps(search.get(\"metaso\",\"(not set)\"))}')
" 2>/dev/null
done
```

然后用 `openclaw config set` 逐个恢复配置项。

### 5.5 运行相关测试

```bash
npx vitest run src/config/config.web-search-provider.test.ts --no-coverage
npx vitest run src/agents/tools/web-search.test.ts --no-coverage
```

## 步骤 6：问题修复循环

若步骤 5 中任何验证失败，按以下顺序排查：

1. **模块找不到（ERR_MODULE_NOT_FOUND）** → 检查工作区引用（步骤 4.1）和依赖版本（步骤 4.2）
2. **配置被剥离** → 确认代码中 zod schema 包含 qwen/metaso（步骤 2.3），重新构建安装
3. **Gateway 启动失败** → 检查 `openclaw gateway install` 是否需要重新执行
4. **搜索功能不工作** → 确认 `web-search.ts` 包含 `runQwenSearch`/`runMetasoSearch` 运行时代码

循环执行步骤 5 直到所有验证通过。

## 步骤 7：发布到 npmjs

确认步骤 5 全部通过后：

### 7.1 发布前门禁检查（全部通过才可发布）

```bash
# 1. dist/control-ui 必须存在
ls dist/control-ui/index.html || { echo "BLOCK: UI 未构建"; exit 1; }

# 2. metaso/qwen schema 必须完整
grep -c 'metaso' dist/*.js | awk -F: '{s+=$2} END{if(s<10){print "BLOCK: metaso schema 缺失"; exit 1} else print "OK:", s, "refs"}'

# 3. npm 认证可用
npm whoami || { echo "BLOCK: npm 未认证"; exit 1; }
```

### 7.2 执行发布

```bash
# 清除可能残留的 package-lock.json
rm -f package-lock.json

# 版本含 -N 后缀时，需要 --tag latest
npm publish --access public --ignore-scripts --tag latest

# 验证发布
npm view @ww-ai-lab/openclaw version --userconfig "$(mktemp)"
```

注意：
- 若版本号不含 `-N` 后缀（纯 `YYYY.M.D` 格式），不需要 `--tag latest`。
- 本地 npm 已认证，无需 1Password；发布前用 `npm whoami` 确认即可。

## 步骤 8：推送 GitHub 并创建 Release

### 8.1 提交并推送

```bash
# 确保在 main 分支（不要从 develop 发布）
git checkout main
git merge develop --ff-only   # 或 git reset --hard develop（若 main 落后太多）
git push myfork main
```

### 8.2 创建 Tag 和 Release

```bash
# 查看上游是否有新 release
gh release list --repo openclaw/openclaw --limit 5

# 创建本地 tag
VERSION=$(node -p "require('./package.json').version")
git tag "v${VERSION}"
git push myfork "v${VERSION}"

# 创建 GitHub Release
gh release create "v${VERSION}" \
  --repo <你的fork> \
  --title "@ww-ai-lab/openclaw ${VERSION}" \
  --notes "同步上游 openclaw/openclaw，保留自定义 qwen/metaso web_search 供应商。"
```

若上游有新 release，在 notes 中注明同步的上游版本。

---

## 历史教训速查

| 问题 | 根因 | 防护措施 |
|------|------|---------|
| qwen/metaso 运行时代码丢失 | 合并时 `web-search.ts` 的自定义代码被上游覆盖，且 develop 分支的 restore 提交遗漏了该文件 | 合并后必检 `grep -c 'runQwenSearch' src/agents/tools/web-search.ts`，结果须 ≥ 1 |
| 配置中 qwen/metaso 字段消失 | Zod `.strict()` 验证在旧代码（无 qwen/metaso schema）下会静默剥离未知字段 | 先安装新代码再操作配置；从备份恢复 |
| `ERR_MODULE_NOT_FOUND: @mariozechner/pi-ai/oauth` | `packages/*/package.json` 中 `"openclaw": "workspace:*"` 导致 pnpm 解析异常，安装了低版本依赖 | 合并后立即修复工作区引用为 `"@ww-ai-lab/openclaw": "workspace:*"` |
| npm publish 被拒（prerelease 版本） | 版本号含 `-N` 后缀被 npm 视为 prerelease | 使用 `--tag latest` 强制发布为稳定版 |
| 从 develop 而非 main 发布 | 忘记将 develop 合并到 main | 发布前必须切到 main 并 merge/reset |
| `openclaw doctor` 报 "Unrecognized keys: metaso, qwen" | 旧 dist 残留的 chunk 中 schema 定义不完整；tsdown 代码拆分导致不同代码路径加载不同 chunk | 构建前必须 `rm -rf dist/` 清除旧产物；构建后用 `openclaw doctor` 验证无 "Invalid config" 输出 |
| 安装后 gateway 没有 Web UI 界面 | `pnpm build` 不包含 `ui:build` 步骤，只有 `prepack` 才串联两者；手动构建后 `dist/control-ui/` 缺失 | 构建流程必须执行 `pnpm build && pnpm ui:build`；发布前检查 `dist/control-ui/index.html` 存在 |
| 包名改为 `@ww-ai-lab/openclaw` 后全局安装引用异常 | `npm install -g .` 会生成 `package-lock.json`，与 pnpm workspace 冲突；工作区引用被上游覆盖 | 安装后删除 `package-lock.json`；合并后立即检查 `packages/*/package.json` 引用是否为 `@ww-ai-lab/openclaw` |
