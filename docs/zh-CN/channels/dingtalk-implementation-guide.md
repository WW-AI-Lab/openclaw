# 钉钉机器人渠道接入方案

> **文档版本**: v1.0
> **更新日期**: 2026-02-28
> **状态**: 设计方案

---

## 目录

1. [概述](#1-概述)
2. [OpenClaw 渠道架构分析](#2-openclaw-渠道架构分析)
3. [钉钉机器人 API 调研](#3-钉钉机器人-api-调研)
4. [接入方案设计](#4-接入方案设计)
5. [实现指南](#5-实现指南)
6. [参考资料](#6-参考资料)

---

## 1. 概述

本文档分析 OpenClaw 的渠道支持架构，并针对钉钉机器人（DingTalk Bot）的接入提供完整的技术方案。

### 1.1 目标

- 分析 OpenClaw 渠道扩展的开发模式（插件 vs 源码）
- 调研钉钉机器人的最新接入方式（2026年）
- 提供钉钉渠道的完整实现方案

### 1.2 现状

- OpenClaw 已支持多种渠道：Telegram、Discord、Slack、Signal、iMessage、WhatsApp、飞书（Feishu）等
- 钉钉渠道**尚未实现**
- 飞书插件已存在，可作为重要参考

---

## 2. OpenClaw 渠道架构分析

### 2.1 核心发现：插件模式优先

OpenClaw 的渠道扩展**优先采用插件模式**，而非直接修改核心源码。

#### 证据

**目录结构对比**:

```
src/                    # 内置渠道（核心功能）
├── telegram/           # Telegram 内置实现
├── discord/            # Discord 内置实现
├── slack/              # Slack 内置实现
└── ...

extensions/             # 扩展渠道（插件）
├── telegram/           # Telegram 插件
├── discord/            # Discord 插件
├── slack/              # Slack 插件
├── feishu/             # 飞书插件 ⭐
├── msteams/            # Microsoft Teams 插件
├── matrix/             # Matrix 插件
└── ...
```

**关键观察**:

1. 大部分主流渠道同时存在内置实现和插件版本
2. 飞书（Feishu）是**纯插件实现**，没有内置版本
3. 新渠道推荐通过插件方式扩展

### 2.2 插件架构设计

#### 2.2.1 核心接口

所有渠道插件必须实现 `ChannelPlugin` 接口（位于 `src/channels/plugins/types.plugin.ts`）:

```typescript
type ChannelPlugin<ResolvedAccount = any, Probe = unknown, Audit = unknown> = {
  id: ChannelId; // 渠道唯一标识
  meta: ChannelMeta; // 元数据（名称、文档路径等）
  capabilities: ChannelCapabilities; // 功能特性
  config: ChannelConfigAdapter; // 配置适配器
  setup?: ChannelSetupAdapter; // 设置适配器
  pairing?: ChannelPairingAdapter; // 配对适配器
  security?: ChannelSecurityAdapter; // 安全适配器
  outbound?: ChannelOutboundAdapter; // 外发消息适配器
  status?: ChannelStatusAdapter; // 状态适配器
  gateway?: ChannelGatewayAdapter; // 网关适配器
  // ... 其他适配器
};
```

#### 2.2.2 插件目录结构（以飞书为例）

```
extensions/feishu/
├── package.json           # 插件元数据
├── index.ts               # 插件入口
├── src/
│   ├── channel.ts         # 渠道插件主实现 ⭐
│   ├── types.ts           # 类型定义
│   ├── accounts.ts        # 账号解析
│   ├── client.ts          # API 客户端
│   ├── config-schema.ts   # 配置 Schema
│   ├── send.ts            # 消息发送
│   ├── outbound.ts        # 外发适配器
│   ├── probe.ts           # 健康检查
│   ├── monitor.ts         # 网关监控
│   ├── directory.ts       # 目录（用户/群组）
│   ├── policy.ts          # 权限策略
│   ├── targets.ts         # 目标解析
│   ├── onboarding.ts      # 入向向导
│   └── ...
└── tests/
```

#### 2.2.3 插件元数据 (package.json)

```json
{
  "name": "@openclaw/dingtalk",
  "version": "2026.2.28",
  "description": "OpenClaw DingTalk channel plugin",
  "type": "module",
  "dependencies": {
    "dingtalk-stream": "latest" // 钉钉 Stream SDK
  },
  "openclaw": {
    "extensions": ["./index.ts"],
    "channel": {
      "id": "dingtalk",
      "label": "DingTalk",
      "selectionLabel": "DingTalk (钉钉)",
      "docsPath": "/channels/dingtalk",
      "docsLabel": "dingtalk",
      "blurb": "DingTalk enterprise messaging.",
      "aliases": ["dt"],
      "order": 40
    },
    "install": {
      "npmSpec": "@openclaw/dingtalk",
      "localPath": "extensions/dingtalk",
      "defaultChoice": "npm"
    }
  }
}
```

### 2.3 插件 SDK 能力

`openclaw/plugin-sdk` 提供的核心工具:

| 类别         | 功能                                                                |
| ------------ | ------------------------------------------------------------------- |
| **配置助手** | `buildChannelConfigSchema`, `setAccountEnabledInConfigSection`      |
| **配对助手** | `PAIRING_APPROVED_MESSAGE`, `formatPairingApproveHint`              |
| **工具参数** | `createActionGate`, `readStringParam`                               |
| **状态管理** | `createDefaultChannelRuntimeState`, `buildBaseChannelStatusSummary` |

---

## 3. 钉钉机器人 API 调研

### 3.1 钉钉机器人类型

钉钉提供两种机器人开发方式：

| 类型                 | 描述                   | 适用场景       |
| -------------------- | ---------------------- | -------------- |
| **企业内部机器人**   | 组织内部使用的机器人   | 企业内部自动化 |
| **第三方企业机器人** | 供多个组织使用的机器人 | SaaS 服务      |

**OpenClaw 应使用企业内部机器人模式**。

### 3.2 消息接收模式（重要）

钉钉提供两种消息接收模式：

#### 3.2.1 Webhook 模式

```
┌─────────┐     HTTP POST     ┌──────────────┐
│ 钉钉服务器 │ ────────────────> │ 你的服务器   │
│ (回调)   │ < ─────────────── │ (Webhook)   │
└─────────┘     HTTP 响应      └──────────────┘
```

**特点**:

- ❌ 需要公网 IP 和域名
- ❌ 需要 HTTPS 证书
- ❌ 需要配置防火墙白名单
- ❌ 需要处理加解密和签名验证

#### 3.2.2 Stream 模式（推荐）

```
┌─────────┐     WebSocket     ┌──────────────┐
│ 钉钉服务器 │ <─────────────> │ 你的应用     │
│ (长连接)  │   双向实时通信   │ (SDK 客户端) │
└─────────┘                    └──────────────┘
```

**特点**:

- ✅ **零公网 IP** - 不需要暴露公网服务
- ✅ **零证书管理** - SDK 自动处理 TLS
- ✅ **零防火墙配置** - 主动连接钉钉服务器
- ✅ **零内网穿透** - 本地开发即可

**OpenClaw 应使用 Stream 模式**（与飞书插件保持一致）。

### 3.3 Stream 模式详解

#### 3.3.1 原理

1. 应用启动时，通过 SDK 与钉钉建立 WebSocket 长连接
2. 钉钉服务器通过此连接推送事件（消息、卡片回调等）
3. 应用处理后返回响应

#### 3.3.2 Node.js SDK

官方包: `dingtalk-stream`

```bash
npm install dingtalk-stream
```

**基础用法**:

```typescript
import { DingTalkStreamClient, Credential } from "dingtalk-stream";

const credential = new Credential(
  process.env.DINGTALK_CLIENT_ID, // AppKey
  process.env.DINGTALK_CLIENT_SECRET, // AppSecret
);

const client = new DingTalkStreamClient(credential);

// 注册机器人消息处理器
client.registerCallbackListener("/v1.0/im/bot/messages/get", async (message) => {
  console.log("收到消息:", message);
  // 处理消息...
  return {};
});

// 启动客户端
client.start();
```

#### 3.3.3 支持的事件类型

| Topic                       | 描述                             |
| --------------------------- | -------------------------------- |
| `/v1.0/im/bot/messages/get` | 机器人接收消息                   |
| `/v1.0/card/callbacks`      | 卡片回调                         |
| 事件订阅                    | 各种事件（用户入群、消息撤回等） |

### 3.4 消息发送 API

#### 3.4.1 发送方式

| 方式            | API                                        | 说明                 |
| --------------- | ------------------------------------------ | -------------------- |
| 服务端 API      | `POST /v1.0/im/messages/send`              | 需要 access_token    |
| Webhook URL     | `POST https://api.dingtalk.com/robot/send` | 简单但功能受限       |
| Session Webhook | 动态获取，从消息回调中                     | 推荐，支持会话上下文 |

#### 3.4.2 消息类型支持

| 类型     | 支持 | 说明           |
| -------- | ---- | -------------- |
| 文本消息 | ✅   | 基础文本       |
| Markdown | ✅   | 富文本         |
| 链接消息 | ✅   | 标题+描述+链接 |
| FeedCard | ✅   | 多卡片消息     |
| 互动卡片 | ✅   | 高级交互       |

### 3.5 权限与凭证

#### 3.5.1 需要的凭证

| 凭证                          | 获取位置              | 说明                  |
| ----------------------------- | --------------------- | --------------------- |
| **Client ID** (AppKey)        | 开发者后台 > 应用详情 | 应用唯一标识          |
| **Client Secret** (AppSecret) | 开发者后台 > 应用详情 | 调用密钥              |
| **Robot Code**                | 机器人配置            | 通常与 Client ID 相同 |
| **Agent ID**                  | 应用详情              | 应用 ID               |

#### 3.5.2 需要的权限

```json
{
  "scopes": {
    "tenant": [
      "im:message",
      "im:message:send_as_bot",
      "im:message.group_at_msg:readonly",
      "im:message.p2p_msg:readonly",
      "im:chat.members:bot_access",
      "contact:user.base:readonly"
    ]
  }
}
```

---

## 4. 接入方案设计

### 4.1 技术选型

| 决策         | 选择              | 理由                        |
| ------------ | ----------------- | --------------------------- |
| **开发模式** | 插件模式          | 符合 OpenClaw 架构，易维护  |
| **消息接收** | Stream 模式       | 无需公网 IP，与飞书保持一致 |
| **消息发送** | 服务端 API        | 功能完整，支持多种消息类型  |
| **SDK 选择** | `dingtalk-stream` | 官方 Node.js SDK            |

### 4.2 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        OpenClaw Core                        │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Plugin SDK  │  │ Channel Reg  │  │  Gateway Runtime   │ │
│  └─────────────┘  └──────────────┘  └────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴────────────────┐
         │   Plugin Interface            │
         │   (ChannelPlugin)             │
         └───────────────┬────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                    DingTalk Plugin                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │   Config    │  │   Gateway    │  │    Messaging       │ │
│  │   Adapter   │  │   Adapter    │  │    Adapter         │ │
│  └─────────────┘  └──────┬───────┘  └────────────────────┘ │
│                          │                                   │
│                   ┌──────▼───────┐                          │
│                   │  Stream     │                          │
│                   │  Client     │                          │
│                   └──────┬───────┘                          │
└──────────────────────────┼───────────────────────────────────┘
                           │ WebSocket
                    ┌──────▼───────┐
                    │   DingTalk   │
                    │    Server    │
                    └──────────────┘
```

### 4.3 核心模块设计

#### 4.3.1 类型定义 (types.ts)

```typescript
// 账号配置
export interface DingtalkAccountConfig {
  clientId: string; // AppKey
  clientSecret: string; // AppSecret
  robotCode: string; // 机器人编码
  agentId: string; // 应用 ID
}

// 解析后的账号
export interface ResolvedDingtalkAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  name?: string;
  config: DingtalkAccountConfig;
}

// 消息类型
export interface DingtalkMessage {
  msgType: "text" | "markdown" | "link" | "feedCard" | "interactiveCard";
  content: DingtalkMessageContent;
  senderId: string;
  conversationId: string;
  conversationType: 1 | 2; // 1=群聊, 2=单聊
  atUsers?: string[];
  isAtAll?: boolean;
}

// 目标类型
export type DingtalkTarget =
  | { type: "user"; id: string } // 单聊目标 (userId)
  | { type: "chat"; id: string }; // 群聊目标 (openConversationId)
```

#### 4.3.2 配置 Schema (config-schema.ts)

```typescript
export const dingtalkConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    enabled: { type: "boolean" },
    clientId: { type: "string" },
    clientSecret: { type: "string", secret: true },
    robotCode: { type: "string" },
    agentId: { type: "string" },
    dmPolicy: {
      type: "string",
      enum: ["open", "pairing", "allowlist", "disabled"],
    },
    allowFrom: { type: "array", items: { type: "string" } },
    groupPolicy: {
      type: "string",
      enum: ["open", "allowlist", "disabled"],
    },
    groupAllowFrom: { type: "array", items: { type: "string" } },
    requireMention: { type: "boolean" },
    accounts: {
      type: "object",
      additionalProperties: {
        /* account config */
      },
    },
  },
};
```

#### 4.3.3 Stream 客户端封装 (client.ts)

```typescript
import { DingTalkStreamClient, Credential } from "dingtalk-stream";

export class DingtalkStreamClient {
  private client: DingTalkStreamClient;
  private handlers: Map<string, Function>;

  constructor(config: DingtalkAccountConfig) {
    const credential = new Credential(config.clientId, config.clientSecret);
    this.client = new DingTalkStreamClient(credential);
    this.handlers = new Map();
  }

  // 注册消息处理器
  onMessage(handler: (message: DingtalkMessage) => Promise<void>) {
    this.client.registerCallbackListener("/v1.0/im/bot/messages/get", async (callback) => {
      const message = this.parseMessage(callback);
      await handler(message);
      return {};
    });
  }

  // 发送消息
  async sendMessage(target: DingtalkTarget, content: any): Promise<void> {
    // 实现消息发送逻辑
  }

  // 启动连接
  start(): void {
    this.client.start();
  }

  // 停止连接
  stop(): void {
    this.client.stop();
  }
}
```

---

## 5. 实现指南

### 5.1 第一步：创建插件目录结构

```bash
cd /path/to/openclaw/extensions
mkdir dingtalk
cd dingtalk

# 创建目录结构
mkdir -p src tests
touch package.json index.ts
touch src/{channel.ts,types.ts,accounts.ts,client.ts,config-schema.ts}
touch src/{send.ts,outbound.ts,probe.ts,monitor.ts,directory.ts}
```

### 5.2 第二步：创建钉钉应用

1. 访问 [钉钉开发者后台](https://open-dev.dingtalk.com)
2. 创建 **企业内部应用**
3. 添加 **机器人能力**，选择 **Stream 模式**
4. 配置权限（见 3.5.2）
5. 发布应用

### 5.3 第三步：实现核心模块

#### 5.3.1 最小可行实现 (channel.ts)

参考飞书插件 (`extensions/feishu/src/channel.ts`) 的结构，实现：

```typescript
import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";

export const dingtalkPlugin: ChannelPlugin = {
  id: "dingtalk",
  meta: {
    id: "dingtalk",
    label: "DingTalk",
    selectionLabel: "DingTalk (钉钉)",
    docsPath: "/channels/dingtalk",
    blurb: "DingTalk enterprise messaging.",
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    polls: false,
    threads: false,
    media: true,
    reactions: false,
    edit: false,
    reply: true,
  },
  // 实现 config, setup, gateway, outbound 等适配器...
};
```

#### 5.3.2 网关适配器 (gateway.ts)

```typescript
gateway: {
  startAccount: async (ctx) => {
    const { monitorDingtalkProvider } = await import("./monitor.js");
    const account = resolveDingtalkAccount({ cfg: ctx.cfg, accountId: ctx.accountId });
    ctx.log?.info(`Starting dingtalk[${ctx.accountId}] (mode: stream)`);
    return monitorDingtalkProvider({
      config: ctx.cfg,
      runtime: ctx.runtime,
      abortSignal: ctx.abortSignal,
      accountId: ctx.accountId,
    });
  },
}
```

### 5.4 第四步：插件注册

在 `extensions/dingtalk/index.ts` 中导出插件：

```typescript
export { dingtalkPlugin } from "./src/channel.js";
```

### 5.5 第五步：测试与调试

1. 本地安装插件：

   ```bash
   openclaw plugins install ./extensions/dingtalk
   ```

2. 配置凭证：

   ```bash
   openclaw channels add
   # 选择 DingTalk，输入凭证
   ```

3. 启动网关：

   ```bash
   openclaw gateway
   ```

4. 查看日志：
   ```bash
   openclaw logs --follow
   ```

### 5.6 关键实现细节

#### 5.6.1 消息 @mention 处理

钉钉群聊消息需要判断是否被 @机器人：

```typescript
function isBotMentioned(message: DingtalkMessage): boolean {
  if (message.conversationType === 2) return true; // 单聊
  return message.atUsers?.includes(botUserId) || message.isAtAll;
}
```

#### 5.6.2 会话 ID 格式

钉钉使用不同的 ID 格式：

| 类型      | ID 格式      | 示例                      |
| --------- | ------------ | ------------------------- |
| 用户 ID   | `$.xxxxx`    | `$.C6TBxJm9xVxxxxxxxxx`   |
| 群会话 ID | `cidxxxxx==` | `cidC6TBxJm9xVxxxxxxxx==` |

#### 5.6.3 与飞书的主要差异

| 特性       | 飞书                      | 钉钉              |
| ---------- | ------------------------- | ----------------- |
| 用户 ID    | `ou_xxx`                  | `$.xxx`           |
| 群 ID      | `oc_xxx`                  | `cidxxx==`        |
| Stream SDK | `@larksuiteoapi/node-sdk` | `dingtalk-stream` |
| 权限模型   | 更灵活                    | 较复杂            |

### 5.7 配置示例

```json5
{
  channels: {
    dingtalk: {
      enabled: true,
      clientId: "dingxxxxxxxxxxx",
      clientSecret: "xxx",
      robotCode: "dingxxxxxxxxxxx",
      agentId: "123456789",
      dmPolicy: "pairing",
      groupPolicy: "open",
      requireMention: true,
      accounts: {
        main: {
          enabled: true,
          clientId: "dingxxxxxxxxxxx",
          clientSecret: "xxx",
        },
      },
    },
  },
}
```

---

## 6. 参考资料

### 6.1 OpenClaw 相关

- 飞书插件实现: `extensions/feishu/`
- 插件 SDK: `packages/plugin-sdk/`
- 渠道类型定义: `src/channels/plugins/`
- 飞书文档: `docs/channels/feishu.md`

### 6.2 钉钉官方资源

| 资源              | 链接                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| 开发者后台        | https://open-dev.dingtalk.com                                              |
| 开放平台文档      | https://open.dingtalk.com/document                                         |
| Stream 模式说明   | https://open.dingtalk.com/document/development/introduction-to-stream-mode |
| Node.js SDK (npm) | https://www.npmjs.com/package/dingtalk-stream                              |
| SDK GitHub        | https://github.com/open-dingtalk/dingtalk-stream-sdk-nodejs                |
| 机器人接入指南    | https://open.dingtalk.com/document/robots/custom-robot-access              |
| 消息发送 API      | https://open.dingtalk.com/document/isvapp/robot-reply-send-message         |

### 6.3 社区资源

- 阿里云开发者社区钉钉专区
- 钉钉开发者共创群: 35365014813

---

## 附录 A：快速实现检查清单

- [ ] 创建插件目录结构
- [ ] 创建钉钉应用并获取凭证
- [ ] 实现 `channel.ts` 主插件定义
- [ ] 实现 `types.ts` 类型定义
- [ ] 实现 `accounts.ts` 账号解析
- [ ] 实现 `client.ts` Stream 客户端封装
- [ ] 实现 `config-schema.ts` 配置 Schema
- [ ] 实现 `send.ts` 消息发送
- [ ] 实现 `outbound.ts` 外发适配器
- [ ] 实现 `probe.ts` 健康检查
- [ ] 实现 `monitor.ts` 网关监控（Stream 连接管理）
- [ ] 实现 `directory.ts` 用户/群组目录
- [ ] 实现 `policy.ts` 权限策略
- [ ] 配置 `package.json` 元数据
- [ ] 导出插件 (`index.ts`)
- [ ] 本地测试
- [ ] 编写用户文档 (`docs/channels/dingtalk.md`)

---

## 附录 B：与飞书插件对比

| 模块     | 飞书文件           | 钉钉对应文件       | 差异说明                    |
| -------- | ------------------ | ------------------ | --------------------------- |
| 插件定义 | `channel.ts`       | `channel.ts`       | ID、meta、capabilities 不同 |
| 类型定义 | `types.ts`         | `types.ts`         | ID 格式、消息结构不同       |
| 客户端   | `client.ts`        | `client.ts`        | SDK 完全不同                |
| 配置     | `config-schema.ts` | `config-schema.ts` | 字段名称差异                |
| 网关监控 | `monitor.ts`       | `monitor.ts`       | Stream 实现差异             |

---

**文档结束**
