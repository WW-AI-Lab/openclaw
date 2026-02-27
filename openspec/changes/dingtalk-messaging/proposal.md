## Why

提案 1（dingtalk-plugin-core）完成了钉钉插件骨架和 Stream 连接管理，但尚未实现消息的实际收发。本提案实现钉钉渠道的**消息收发核心能力**，包括：接收用户消息（文本、Markdown、图片等）、解析消息内容、处理 @提及、发送回复消息、消息去重和出站适配器。

这是钉钉渠道的核心功能模块——没有消息收发，渠道就无法真正工作。本提案完成后，钉钉渠道将具备基本可用的消息交互能力。

本提案为钉钉渠道系列提案的**第 2 个（共 4 个）**，依赖提案 1 的核心骨架。

## What Changes

- **实现消息接收处理**：在 `monitor.ts` 的回调中解析钉钉推送的消息数据（`DWClientDownStream.data`），提取发送者、会话类型、消息内容等信息
- **实现消息发送**：封装钉钉消息发送 API，支持通过 `sessionWebhook` 回复消息和通过服务端 API 主动发送消息
- **支持多种消息格式**：
  - 接收：文本、富文本、图片、文件、语音、视频
  - 发送：文本（`sampleText`）、Markdown（`sampleMarkdown`）
- **实现 @提及处理**：解析群聊消息中的 @机器人信息，根据 `requireMention` 配置决定是否响应
- **实现消息去重**：防止 Stream 重试导致的重复消息处理
- **实现 Outbound 适配器**：实现 `ChannelOutboundAdapter`，提供 `sendText`、`sendMedia` 接口
- **实现 Reply Dispatcher**：创建回复分发器，处理消息分块和发送
- **实现会话 ID 解析**：将钉钉的 `conversationId`、`senderId` 映射到 OpenClaw 的目标格式

## Capabilities

### New Capabilities

- `dingtalk-message-receive`: 钉钉消息接收与解析，包括多类型消息解析、@提及检测、会话类型判断、消息去重
- `dingtalk-message-send`: 钉钉消息发送，包括 sessionWebhook 回复、服务端 API 发送、文本/Markdown 格式支持
- `dingtalk-outbound`: 钉钉出站适配器，实现 ChannelOutboundAdapter 接口，包含消息分块、目标解析、发送路由

### Modified Capabilities

（无，本提案为新增功能模块）

## Impact

- **修改文件**：`extensions/dingtalk/src/monitor.ts`（在消息回调中集成消息处理逻辑）
- **新增文件**：`src/bot.ts`（消息处理主逻辑）、`src/send.ts`（消息发送）、`src/send-target.ts`（目标解析）、`src/outbound.ts`（出站适配器）、`src/reply-dispatcher.ts`（回复分发）、`src/mention.ts`（@提及处理）、`src/dedup.ts`（消息去重）、`src/external-keys.ts`（钉钉 ID 格式标准化）
- **修改文件**：`src/channel.ts`（挂载 outbound、messaging 适配器）
- **API 依赖**：使用 `sessionWebhook`（回调内回复）和 `POST /v1.0/robot/oToMessages/batchSend`（主动单聊）、`POST /v1.0/robot/groupMessages/send`（主动群聊）
- **测试**：需为消息解析、发送、去重等模块编写单元测试
