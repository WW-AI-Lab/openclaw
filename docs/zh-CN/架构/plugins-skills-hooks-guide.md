# OpenClaw 扩展机制：插件、Skills 与 Hooks

本文档详细分析 OpenClaw 中三个核心扩展机制的概念、作用、工作原理和使用场景。

## 目录

1. [概述](#概述)
2. [插件 (Plugins)](#插件-plugins)
3. [Skills](#skills)
4. [Hooks](#hooks)
5. [三者的关系与对比](#三者的关系与对比)
6. [使用场景](#使用场景)
7. [开发指南](#开发指南)

---

## 概述

OpenClaw 采用三层扩展架构，每层解决不同的扩展需求：

| 层级     | 组件           | 作用粒度 | 典型用途                           |
| -------- | -------------- | -------- | ---------------------------------- |
| **宏观** | 插件 (Plugins) | 系统级   | 添加新渠道、新提供商、核心功能扩展 |
| **中观** | Skills         | 功能级   | AI 可调用的工具函数、业务能力      |
| **微观** | Hooks          | 事件级   | 生命周期事件响应、AOP 切面         |

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenClaw Core                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │   Plugins   │  │   Skills    │  │       Hooks         │    │
│  │  (系统扩展)  │  │  (AI工具)   │  │    (事件响应)       │    │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘    │
│         │                │                     │               │
│    新渠道/提供商      工具注册             生命周期回调          │
│    CLI命令           函数实现              消息拦截             │
│    HTTP处理器        外部命令              数据变换             │
│    后台服务                                       │             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 插件 (Plugins)

### 定义

插件是 OpenClaw 的**系统级扩展机制**，允许向核心系统注入新功能。插件在 Gateway 进程内加载，可以访问完整的 OpenClaw API。

### 核心能力

插件通过 `OpenClawPluginApi` 提供以下注册能力：

| API 方法                | 功能                  | 示例                      |
| ----------------------- | --------------------- | ------------------------- |
| `registerChannel`       | 注册消息渠道          | Telegram, Discord, 飞书   |
| `registerProvider`      | 注册模型提供商        | OpenAI, Anthropic, Ollama |
| `registerTool`          | 注册 AI 工具          | 文件操作、API 调用        |
| `registerCommand`       | 注册自定义命令        | `/status`, `/search`      |
| `registerHook`          | 注册生命周期钩子      | 消息拦截、会话控制        |
| `registerHttpHandler`   | 注册 HTTP 处理器      | Webhook 接收              |
| `registerCli`           | 注册 CLI 命令         | `openclaw my-plugin`      |
| `registerService`       | 注册后台服务          | 定时任务、消息队列        |
| `registerGatewayMethod` | 注册 Gateway RPC 方法 | 自定义网关 API            |

### 插件结构

```bash
my-plugin/
├── openclaw.plugin.json    # 插件清单文件
├── package.json             # npm 包配置
├── src/
│   ├── index.ts            # 插件入口
│   ├── channels/           # 渠道实现（可选）
│   ├── tools/              # 工具实现（可选）
│   └── skills/             # Skills 目录（可选）
├── hooks/                  # 内置 Hooks（可选）
└── README.md
```

### 插件清单 (openclaw.plugin.json)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "kind": "memory",
  "channels": ["my-channel"],
  "skills": ["./skills"],
  "configSchema": {
    "jsonSchema": {
      "type": "object",
      "properties": {
        "apiKey": { "type": "string" }
      }
    }
  }
}
```

### 插件注册示例

```typescript
// src/index.ts
import type { OpenClawPluginApi } from "@openclaw/plugin-sdk";

const plugin = {
  id: "my-plugin",
  name: "My Plugin",
  description: "A sample plugin",
  register(api: OpenClawPluginApi) {
    // 注册工具
    api.registerTool({
      name: "my_tool",
      description: "Does something useful",
      parameters: { type: "object", properties: {} },
      handler: async (params) => {
        return { result: "success" };
      },
    });

    // 注册钩子
    api.registerHook("message_received", async (event, ctx) => {
      console.log("Message received:", event.content);
    });

    // 注册自定义命令
    api.registerCommand({
      name: "mycommand",
      description: "My custom command",
      handler: async (ctx) => {
        return { text: "Command executed!" };
      },
    });
  },
};

export default plugin;
```

### 插件生命周期

```
┌──────────────┐
│  Gateway 启动 │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  扫描插件目录 │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 加载 openclaw.│
│ plugin.json  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 验证配置 Schema│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 调用 register()│
│  注册功能     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 插件运行中... │
└──────────────┘
```

### 插件类型

#### 1. 渠道插件

添加新的消息渠道，如 Telegram、Discord、飞书。

**示例**: `extensions/feishu`

#### 2. 提供商插件

添加新的 LLM 提供商，如 OpenAI、Anthropic、Qwen。

**示例**: 内置的提供商配置

#### 3. 工具插件

提供一组相关的工具函数。

**示例**: `extensions/agent-tools`

#### 4. Memory 插件

自定义记忆存储实现。

**标记**: `kind: "memory"`

### CLI 命令

```bash
# 列出所有插件
openclaw plugins list

# 查看插件详情
openclaw plugins info <id>

# 启用/禁用插件
openclaw plugins enable <id>
openclaw plugins disable <id>

# 安装插件
openclaw plugins install <path-or-spec>

# 卸载插件
openclaw plugins uninstall <id>

# 更新插件
openclaw plugins update <id>
openclaw plugins update --all

# 诊断插件
openclaw plugins doctor
```

---

## Skills

### 定义

Skills 是 AI Agent 可调用的**工具函数**。它们是 OpenClaw 与外部世界交互的基本单元，类似于 OpenAI 的 Function Calling 或 MCP (Model Context Protocol) 的 Tools。

### 核心概念

| 概念              | 说明                                            |
| ----------------- | ----------------------------------------------- |
| **Skill**         | 可被 AI 调用的工具，包含名称、描述、参数 schema |
| **SKILL.md**      | Skill 的文档文件，包含 frontmatter 元数据       |
| **Eligibility**   | Skill 的可用性检查（二进制、环境变量、配置等）  |
| **Skill Command** | 用户可直接调用的 Skill 快捷方式                 |

### Skill 结构

```bash
skills/
├── my-skill/
│   ├── SKILL.md          # Skill 文档 + 元数据
│   └── handler.ts        # 实现（可选，内置 skill 不需要）
└── another-skill/
    ├── SKILL.md
    └── script.sh         # Shell 脚本形式的 skill
```

### SKILL.md 格式

```markdown
---
name: web-search
description: "Search the web for current information"
emoji: "🔍"
homepage: https://docs.openclaw.ai/tools/skills#web-search
requires:
  bins: ["curl"]
  env: ["SEARCH_API_KEY"]
install:
  - kind: brew
    formula: curl
---

# Web Search

Search the web for current information using the search API.

## Usage

The agent can use this skill to search for:

- Current events
- Factual information
- Latest updates

## Parameters

- `query`: The search query string
- `limit`: Maximum number of results (optional)
```

### 元数据字段

```typescript
type OpenClawSkillMetadata = {
  always?: boolean; // 始终可用，跳过检查
  skillKey?: string; // 唯一标识符
  primaryEnv?: string; // 主要运行环境
  emoji?: string; // 显示图标
  homepage?: string; // 文档链接
  os?: string[]; // 支持的操作系统
  requires?: {
    bins?: string[]; // 必需的二进制文件
    anyBins?: string[]; // 至少需要一个
    env?: string[]; // 必需的环境变量
    config?: string[]; // 必需的配置项
  };
  install?: SkillInstallSpec[]; // 安装方法
};
```

### Skill 发现顺序

```
1. Workspace Skills (工作区技能)
   ~/.openclaw/workspace/skills/
   ↓
2. Managed Skills (托管技能)
   ~/.openclaw/skills/
   ↓
3. Bundled Skills (内置技能)
   <openclaw>/dist/skills/bundled/
```

### 内置 Skills 示例

| Skill        | 功能         | 触发方式       |
| ------------ | ------------ | -------------- |
| `web-search` | 网络搜索     | AI 自动调用    |
| `browser`    | 浏览器操作   | AI 自动调用    |
| `llm-task`   | LLM 任务委托 | AI 自动调用    |
| `commit`     | Git 提交     | `/commit` 命令 |

### Skill 调用流程

```
┌─────────────┐
│  用户消息    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ AI 决策     │
│ "需要搜索"  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  工具调用    │
│ web-search  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  参数验证    │
│ Eligibility │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  执行 Skill │
│ Handler     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  返回结果    │
└─────────────┘
```

### CLI 命令

```bash
# 列出所有 skills
openclaw skills list

# 只显示可用的
openclaw skills list --eligible

# 查看 skill 详情
openclaw skills info <name>

# 检查 eligibility
openclaw skills check
```

### Skill 安装规范

```typescript
type SkillInstallSpec = {
  kind:
    | "brew" // Homebrew
    | "node" // npm/yarn/pnpm/bun
    | "go" // go install
    | "uv" // Python uv
    | "download"; // 直接下载
  formula?: string; // brew formula
  package?: string; // npm/go package
  url?: string; // 下载 URL
  bins?: string[]; // 安装的二进制
  os?: string[]; // 目标系统
};
```

---

## Hooks

### 定义

Hooks 是**事件驱动的回调机制**，允许在特定生命周期点插入自定义逻辑。OpenClaw 有两种 Hook 系统：

1. **内部 Hooks (Internal Hooks)**: 用于命令事件和自动化
2. **插件 Hooks (Plugin Hooks)**: 用于细粒度的生命周期控制

### 内部 Hooks

用于响应命令和生命周期事件，如 `/new`、`/reset`、`gateway:startup`。

#### 支持的事件

| 事件类型           | 触发时机               |
| ------------------ | ---------------------- |
| `command:new`      | 用户发送 `/new` 命令   |
| `command:reset`    | 用户发送 `/reset` 命令 |
| `command:stop`     | 用户发送 `/stop` 命令  |
| `agent:bootstrap`  | Agent bootstrap 阶段   |
| `gateway:startup`  | Gateway 启动后         |
| `message:received` | 收到消息               |
| `message:sent`     | 消息发送成功           |

#### Hook 结构

```bash
my-hook/
├── HOOK.md           # 元数据 + 文档
└── handler.ts        # 处理函数
```

#### HOOK.md 示例

```markdown
---
name: session-memory
description: "Save session context to memory when /new is issued"
emoji: "💾"
events: ["command:new"]
requires:
  config: ["workspace.dir"]
---

# Session Memory Hook

Saves the last 15 lines of conversation to memory when you reset the session.
```

#### Handler 示例

```typescript
const handler: HookHandler = async (event) => {
  // 只处理 new 命令
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  console.log("[session-memory] Saving session...");

  // 获取会话信息
  const { sessionEntry, workspaceDir } = event.context;

  // 保存到 memory
  // ... 自定义逻辑

  // 可选：发送消息给用户
  event.messages.push("💾 Session saved to memory!");
};

export default handler;
```

### 插件 Hooks

插件可以注册更细粒度的生命周期钩子，用于拦截和修改各种操作。

#### 插件 Hook 类型

| Hook 名称              | 触发时机         | 用途                |
| ---------------------- | ---------------- | ------------------- |
| `before_model_resolve` | 解析模型前       | 动态切换模型/提供商 |
| `before_prompt_build`  | 构建 Prompt 前   | 注入额外上下文      |
| `llm_input`            | LLM 请求前       | 记录/修改请求       |
| `llm_output`           | LLM 响应后       | 记录/修改响应       |
| `message_sending`      | 发送消息前       | 修改/阻止消息       |
| `message_sent`         | 消息发送后       | 记录发送结果        |
| `before_tool_call`     | 工具调用前       | 修改参数/阻止调用   |
| `after_tool_call`      | 工具调用后       | 记录结果            |
| `tool_result_persist`  | 持久化工具结果前 | 清理敏感数据        |
| `session_start`        | 会话开始         | 初始化状态          |
| `session_end`          | 会话结束         | 清理资源            |
| `subagent_spawning`    | 子 Agent 生成前  | 控制生成            |
| `subagent_spawned`     | 子 Agent 生成后  | 记录状态            |
| `gateway_start`        | Gateway 启动时   | 初始化服务          |
| `gateway_stop`         | Gateway 停止时   | 清理资源            |

#### 插件 Hook 示例

```typescript
api.registerHook("before_tool_call", async (event, ctx) => {
  // 阻止敏感工具调用
  if (event.toolName === "delete_files") {
    const userHasPermission = await checkPermission(ctx.sessionKey);
    if (!userHasPermission) {
      return {
        block: true,
        blockReason: "User does not have permission to delete files",
      };
    }
  }

  // 修改参数
  if (event.toolName === "search") {
    return {
      params: {
        ...event.params,
        safeSearch: "strict", // 强制开启安全搜索
      },
    };
  }
});
```

### Hook 发现顺序

```
1. Workspace Hooks
   <workspace>/hooks/
   ↓
2. Managed Hooks
   ~/.openclaw/hooks/
   ↓
3. Bundled Hooks
   <openclaw>/dist/hooks/bundled/
```

### CLI 命令

```bash
# 列出所有 hooks
openclaw hooks list

# 只显示可用的
openclaw hooks list --eligible

# 详细信息
openclaw hooks info <name>

# 检查状态
openclaw hooks check

# 启用/禁用
openclaw hooks enable <name>
openclaw hooks disable <name>

# 安装 hook 包
openclaw hooks install <path-or-spec>
```

---

## 三者的关系与对比

### 功能对比

| 特性         | 插件             | Skills        | Hooks        |
| ------------ | ---------------- | ------------- | ------------ |
| **粒度**     | 系统级           | 功能级        | 事件级       |
| **注册方式** | `register()` API | SKILL.md 文件 | HOOK.md 文件 |
| **执行时机** | 持续运行         | AI 调用时     | 事件触发时   |
| **主要作用** | 扩展系统能力     | AI 工具集     | 响应生命周期 |
| **API 访问** | 完整 API         | 受限          | 事件上下文   |
| **可以包含** | Skills, Hooks    | -             | -            |

### 依赖关系

```
┌─────────────────────────────────────────────┐
│              Plugin (插件)                   │
│  ┌─────────────────────────────────────┐   │
│  │  可以注册:                           │   │
│  │  - Channels (新渠道)                │   │
│  │  - Skills (AI 工具)                 │   │
│  │  - Hooks (生命周期)                 │   │
│  │  - Commands (自定义命令)            │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    │
                    │ 可以包含
                    ▼
        ┌───────────────────────┐
        │    Skills + Hooks     │
        └───────────────────────┘
```

### 选择指南

| 场景                | 使用         | 示例              |
| ------------------- | ------------ | ----------------- |
| 添加新消息渠道      | 插件         | 添加微信支持      |
| 添加新的 LLM 提供商 | 插件         | 添加本地模型      |
| 创建 AI 可调用工具  | Skill        | 天气查询 API      |
| 自动化命令响应      | Hook         | `/new` 时保存记忆 |
| 拦截/修改消息       | 插件 Hook    | 敏感词过滤        |
| 添加后台任务        | 插件 Service | 定时同步          |

---

## 使用场景

### 场景 1: 添加新消息渠道

使用 **插件** 创建新的消息渠道。

```typescript
// channels/mychannel/plugin.ts
const plugin = {
  id: "mychannel",
  name: "My Channel",
  register(api: OpenClawPluginApi) {
    api.registerChannel({
      plugin: {
        id: "mychannel",
        name: "My Channel",
        // 渠道实现...
      },
    });
  },
};
```

### 场景 2: 创建 AI 工具

使用 **Skill** 让 AI 能够执行特定操作。

**SKILL.md**:

```markdown
---
name: weather
description: "Get current weather for a location"
---

# Weather Tool

Fetches current weather data for any location.

## Parameters

- `location`: City name or coordinates
```

### 场景 3: 会话记忆自动化

使用 **Hook** 在会话重置时自动保存记忆。

**handler.ts**:

```typescript
const handler = async (event) => {
  if (event.action === "new") {
    const context = extractContext(event.context.messages);
    await saveToMemory(context);
  }
};
```

### 场景 4: 消息内容过滤

使用 **插件 Hook** 拦截和修改消息。

```typescript
api.registerHook("message_sending", async (event) => {
  // 移除敏感信息
  const clean = redactSensitive(event.content);
  return { content: clean };
});
```

### 场景 5: 自定义命令

使用 **插件** 创建用户可直接调用的命令。

```typescript
api.registerCommand({
  name: "status",
  description: "Show system status",
  handler: async (ctx) => {
    return { text: "All systems operational" };
  },
});
```

---

## 开发指南

### 插件开发步骤

1. **创建插件结构**

   ```bash
   mkdir my-plugin && cd my-plugin
   npm init -y
   npm install @openclaw/plugin-sdk
   ```

2. **创建清单文件**

   ```json
   {
     "id": "my-plugin",
     "name": "My Plugin",
     "configSchema": { "jsonSchema": {...} }
   }
   ```

3. **实现注册函数**

   ```typescript
   import type { OpenClawPluginApi } from "@openclaw/plugin-sdk";

   export default {
     id: "my-plugin",
     register(api: OpenClawPluginApi) {
       // 注册功能
     },
   };
   ```

4. **本地测试**
   ```bash
   openclaw plugins install -l ./my-plugin
   openclaw plugins enable my-plugin
   ```

### Skill 开发步骤

1. **创建 Skill 目录**

   ```bash
   mkdir -p ~/.openclaw/skills/my-skill
   ```

2. **创建 SKILL.md**

   ```markdown
   ---
   name: my-skill
   description: "Does something useful"
   ---

   # My Skill

   Description here...
   ```

3. **验证发现**
   ```bash
   openclaw skills list | grep my-skill
   ```

### Hook 开发步骤

1. **创建 Hook 目录**

   ```bash
   mkdir -p ~/.openclaw/hooks/my-hook
   ```

2. **创建 HOOK.md**

   ```markdown
   ---
   name: my-hook
   description: "My custom hook"
   events: ["command:new"]
   ---

   # My Hook

   Runs when /new is issued.
   ```

3. **实现 handler**

   ```typescript
   const handler = async (event) => {
     if (event.action === "new") {
       console.log("Hook triggered!");
     }
   };
   export default handler;
   ```

4. **启用 Hook**
   ```bash
   openclaw hooks enable my-hook
   ```

### 最佳实践

#### 插件开发

- 保持单一职责
- 提供清晰的配置 schema
- 使用 TypeScript 类型安全
- 实现健壮的错误处理

#### Skill 设计

- 确保 SKILL.md 描述准确
- 参数验证要完整
- 考虑幂等性
- 提供使用示例

#### Hook 编写

- 尽早返回不相关的事件
- 使用 fire-and-forget 处理耗时操作
- 始终捕获错误，避免影响其他 hooks
- 记录足够的调试信息

---

## 参考

- [CLI: plugins](/cli/plugins)
- [CLI: skills](/cli/skills)
- [CLI: hooks](/cli/hooks)
- [Plugins 深度文档](/tools/plugin)
- [Hooks 深度文档](/automation/hooks)
- [创建 Skills](/tools/creating-skills)
- [插件清单规范](/plugins/manifest)

---

**文档版本**: 1.0
**最后更新**: 2026-02-25
