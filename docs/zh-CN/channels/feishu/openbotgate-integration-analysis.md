# OpenClaw 飞书扩展与 openbotgate 集成可行性分析

## 概述

本文档分析了 OpenClaw 的飞书扩展是否能使用 openbotgate 项目提供的网关服务进行连接。

## 项目架构对比

### OpenClaw 飞书扩展架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                             │
├─────────────────────────────────────────────────────────────────┤
│  extensions/feishu/src/monitor.ts                               │
│  ├── Lark.WSClient (直接连接飞书 WebSocket)                      │
│  ├── EventDispatcher (事件分发)                                  │
│  └── botOpenId 解析                                              │
├─────────────────────────────────────────────────────────────────┤
│  extensions/feishu/src/bot.ts                                   │
│  ├── 消息解析与上下文构建                                         │
│  ├── 策略执行 (allowFrom, dmPolicy, groupPolicy)                │
│  ├── Agent 路由 (resolveAgentRoute)                             │
│  ├── Session 管理 (groupSessionScope, topicSessionMode)         │
│  ├── 历史记录管理                                                 │
│  ├── 配对流程 (pairing)                                          │
│  ├── 动态 Agent 创建 (dynamicAgentCreation)                      │
│  └── 媒体处理                                                     │
└─────────────────────────────────────────────────────────────────┘
```

**关键特点：**
- 深度集成到 OpenClaw 的内部 Agent 系统
- 复杂的策略执行（DM 策略、群组策略、访问控制）
- 会话路由（peerId, sessionKey）
- 历史记录管理
- 配对流程
- 动态 Agent 创建（为每个 DM 用户创建独立工作区）

### openbotgate 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    openbotgate                                  │
├─────────────────────────────────────────────────────────────────┤
│  src/gateway/feishu.ts                                          │
│  ├── Lark.WSClient (连接飞书 WebSocket)                          │
│  └── 简单事件监听器                                              │
├─────────────────────────────────────────────────────────────────┤
│  src/handler/index.ts                                           │
│  ├── 消息解析 (parseFeishuEvent)                                 │
│  ├── 命令路由 (/code, /sessions, 等)                             │
│  └── 响应发送                                                   │
├─────────────────────────────────────────────────────────────────┤
│  src/runtime/tools/openclaw.ts                                  │
│  ├── OpenClaw CLI 适配器                                         │
│  ├── 执行: openclaw agent --message "xxx" --session-id <id>     │
│  └── 输出流式处理                                                 │
├─────────────────────────────────────────────────────────────────┤
│  src/runtime/sessionManager.ts                                  │
│  └── 用户会话管理 (tool, sessionId, model, agent)                │
└─────────────────────────────────────────────────────────────────┘
```

**关键特点：**
- 独立的网关服务
- 将 OpenClaw CLI 作为外部工具调用
- 命令式交互（用户输入命令 → 执行 → 返回结果）
- 多工具支持（OpenClaw, Cursor Code, Gemini Code 等）
- 简单的会话管理

## 集成可行性分析

### 结论：**不能直接集成**

### 原因分析

#### 1. 通信方向相反

| 组件 | 通信方向 | 用途 |
|------|----------|------|
| OpenClaw 飞书扩展 | 飞书 → Agent 系统 | 将外部消息推送到内部 Agent |
| openbotgate | 飞书 → CLI 工具 | 将 CLI 作为外部工具调用 |

OpenClaw 的飞书扩展是**推入式**设计（push），将外部消息转换为 Agent 的内部消息并分发给 Agent。
openbotgate 是**调用式**设计（invoke），将 OpenClaw CLI 作为一个子进程工具来执行。

#### 2. 架构层次不同

```
OpenClaw:
飞书 ──[深度集成]──> Agent 系统 (内部调度、路由、历史记录)
                      ↑
                      └── extensions/feishu 是 Agent 系统的一部分

openbotgate:
飞书 ──[网关层]──> 命令路由 ──[调用]──> OpenClaw CLI (独立进程)
                                ↑
                                └── OpenClaw 是外部工具
```

#### 3. 功能复杂度差异

OpenClaw 飞书扩展的功能远超 openbotgate 的网关层：
- 动态 Agent 创建（为每个用户创建独立工作区）
- 群组会话作用域（group, group_sender, group_topic, group_topic_sender）
- 主题会话模式
- 历史记录管理
- 配对流程
- 媒体处理
- 复杂的策略执行（allowFrom, dmPolicy, groupPolicy）

这些功能深度集成到 OpenClaw 的 Agent 系统中，无法简单地"委托"给外部网关。

#### 4. 会话管理方式不同

- **OpenClaw**: 通过 `peerId`, `sessionKey`, `accountId` 在内部路由消息
- **openbotgate**: 通过 `sessionManager` 管理用户级别的配置（tool, sessionId, model）

两者的会话概念不同，无法直接映射。

## 替代方案

### 方案 A：使用 OpenClaw 内置的多租户功能（推荐）

OpenClaw 已经具备实现多租户隔离的能力：

#### 1. 动态 Agent 创建

```yaml
# openclaw.yml
channels:
  feishu:
    accounts:
      default:
        appId: "cli_xxx"
        appSecret: "xxx"
        dmPolicy: "allowlist"
        allowFrom:
          - "ou_xxx1"
          - "ou_xxx2"
        # 动态 Agent 创建：为每个 DM 用户创建独立工作区
        dynamicAgentCreation:
          enabled: true
          # 每个 Agent 有独立的:
          # - 工作目录 (~/.openclaw/agents/feishu_dm_{openId}/)
          # - 配置 (model, agent, 等)
          # - 会话历史
```

**优点：**
- 用户数据完全隔离（独立的 Agent 工作区）
- 配置灵活（每个 Agent 可以有不同模型）
- 原生集成，无需外部服务
- 与 OpenClaw 的所有功能兼容

**限制：**
- 所有 Agent 运行在同一个 OpenClaw Gateway 进程中
- 共享系统资源
- 适合中小规模部署（< 50 用户）

#### 2. 多实例 + allowList 过滤

```yaml
# 实例 1: user1 的机器
channels:
  feishu:
    accounts:
      default:
        allowFrom: ["ou_user1"]

# 实例 2: user2 的机器
channels:
  feishu:
    accounts:
      default:
        allowFrom: ["ou_user2"]
```

**优点：**
- 完全隔离（独立机器/进程）
- 简单配置

**限制：**
- 每个实例需要独立部署
- 飞书连接数限制（估计 100-500）

### 方案 B：openbotgate 作为独立网关

如果企业规模较大（50+ 用户），可以使用 openbotgate 作为独立的飞书网关：

```
┌─────────────┐
│   飞书应用   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│      openbotgate 网关            │
│  (单点连接飞书 WebSocket)         │
├─────────────────────────────────┤
│  用户识别 (sender_id)             │
│  路由策略 (per-user mapping)      │
└──────┬──────────────┬───────────┘
       │              │
       ▼              ▼
┌─────────────┐  ┌─────────────┐
│ OpenClaw #1 │  │ OpenClaw #2 │
│  (user1)    │  │  (user2)    │
└─────────────┘  └─────────────┘
```

**部署方式：**
```bash
# 1. 部署 openbotgate
cd extensions/openbotgate
npm install
npm run build

# 2. 配置 openbotgate.yml
gateway:
  type: feishu
feishu:
  appId: "cli_xxx"
  appSecret: "xxx"
allowedCodeTools: ["openclaw"]

# 3. 配置用户路由 (可扩展为数据库)
# openbotgate 内部通过 sessionManager 管理用户会话
# 可以扩展实现 per-user OpenClaw 实例路由
```

**优点：**
- 单点连接飞书（避免连接数限制）
- 灵活的路由策略
- 支持大规模部署

**限制：**
- 需要额外部署服务
- 需要扩展 openbotgate 的路由逻辑（当前是 per-user session，不是 per-user instance）

### 方案 C：扩展 OpenClaw 飞书扩展（不推荐）

理论上可以修改 OpenClaw 的飞书扩展，使其能够调用外部 OpenClaw CLI：
- 在 `bot.ts` 的 `handleFeishuMessage` 中添加外部实例路由
- 将消息通过 HTTP API 转发给目标 OpenClaw 实例

但这样做：
- 与 OpenClaw 的架构设计相悖
- 会丢失大量内置功能（历史记录、配对、媒体处理等）
- 开发成本高，维护复杂

## 推荐方案

根据用户规模选择：

| 用户规模 | 推荐方案 | 配置复杂度 | 隔离级别 |
|----------|----------|------------|----------|
| < 10 用户 | 单实例 + allowList | 简单 | 会话级 |
| 10-50 用户 | 动态 Agent 创建 | 中等 | Agent 级（独立工作区） |
| 50-200 用户 | 多实例 + allowList | 复杂 | 进程级 |
| 200+ 用户 | openbotgate 网关 | 非常复杂 | 实例级 |

## openbotgate 的参考价值

虽然不能直接集成，但 openbotgate 有以下参考价值：

1. **命令式交互模式**: 可以考虑在 OpenClaw 中添加类似的命令模式（当前主要是对话模式）
2. **多工具支持**: 可以考虑支持多个 AI 编码工具的切换（OpenClaw 目前支持 `openaiCodeProvider`）
3. **YAML 配置**: 可以参考 openbotgate 的简洁 YAML 配置

## 技术细节对比

### WebSocket 连接

两者都使用 `@larksuiteoapi/node-sdk`:

```typescript
// OpenClaw (extensions/feishu/src/client.ts)
const wsClient = new Lark.WSClient({
  appId,
  appSecret,
  domain: domain === 'lark' ? Lark.Domain.Lark : Lark.Domain.Feishu,
});

// openbotgate (src/gateway/feishu.ts)
const wsClient = new Lark.WSClient({
  appId: config.feishu.appId,
  appSecret: config.feishu.appSecret,
  domain: config.feishu.domain === 'lark' ? Lark.Domain.Lark : Lark.Domain.Feishu,
});
```

SDK 使用完全相同，但事件处理方式不同。

### 消息处理流程

```typescript
// OpenClaw: 内部 Agent 路由
const route = core.channel.routing.resolveAgentRoute({
  cfg,
  channel: "feishu",
  accountId: account.accountId,
  peer: { kind: isGroup ? "group" : "direct", id: peerId },
});
await core.channel.reply.dispatchReplyFromConfig({
  ctx: ctxPayload,
  cfg,
  dispatcher,
  replyOptions,
});

// openbotgate: 调用外部 CLI
const command = adapter.buildCommand(prompt, runOpts);
const result = await adapter.execute(prompt, runOpts);
await ctx.reply(result.stdout);
```

## 结论

OpenClaw 飞书扩展与 openbotgate 的网关服务**不能直接集成**，因为两者的架构设计和通信模式完全不同。

对于多租户企业部署，推荐优先使用 OpenClaw 内置的功能：
1. **动态 Agent 创建** (`dynamicAgentCreation.enabled: true`) - 为每个用户创建独立工作区
2. **allowList 过滤** (`allowFrom`, `dmPolicy`) - 控制访问权限

对于超大规模部署（200+ 用户），可以考虑将 openbotgate 作为独立网关进行二次开发，实现 per-user OpenClaw 实例路由。
