## Context

提案 1 已实现钉钉 Stream 连接管理，`monitor.ts` 中注册了消息回调（topic: `/v1.0/im/bot/messages/get`），但回调内尚未实现消息处理逻辑。本设计聚焦于消息接收与发送的完整流程。

钉钉消息回调数据结构（`DWClientDownStream.data` 解析后）：

```jsonc
{
  "conversationId": "cidXXXXXX==",
  "chatbotCorpId": "dingXXXX",
  "chatbotUserId": "$:LWCXXXX",
  "msgId": "msgXXXX",
  "senderNick": "张三",
  "isAdmin": true,
  "senderStaffId": "042XXX",
  "sessionWebhookExpiredTime": 1695289035996,
  "createAt": 1695283635765,
  "senderCorpId": "dingXXXX",
  "conversationType": "1", // "1" = 单聊, "2" = 群聊
  "senderId": "$:LWCXXXX",
  "sessionWebhook": "https://oapi.dingtalk.com/robot/sendBySession?session=XXX",
  "robotCode": "dingXXXX",
  "msgtype": "text",
  "text": { "content": "hello" },
}
```

消息发送有两种方式：

1. **sessionWebhook**（推荐用于回复）：直接 POST 到回调中的 `sessionWebhook` URL，支持文本/Markdown/卡片
2. **服务端 API**（用于主动发送）：需要 access_token，区分单聊和群聊 API

## Goals / Non-Goals

**Goals:**

- 实现完整的消息接收流程：回调解析 → 结构化消息 → 路由到 OpenClaw 核心
- 实现两种消息发送方式：sessionWebhook 回复 + 服务端 API 主动发送
- 支持文本和 Markdown 两种发送格式
- 解析接收消息的多种类型（文本、富文本、图片、文件等）
- 实现 @提及检测和 requireMention 策略
- 实现消息去重机制
- 实现 ChannelOutboundAdapter

**Non-Goals:**

- 媒体文件的实际上传/下载（提案 4）
- 流式卡片输出（提案 4）
- 互动卡片（Action Card）发送（提案 4）
- 配对和访问控制逻辑（提案 3）

## Decisions

### D1: 消息回复方式选择

**选择：优先使用 sessionWebhook，主动发送时使用服务端 API**

理由：

- `sessionWebhook` 是钉钉推荐的回复方式，不需要额外的 access_token 管理
- `sessionWebhook` 有过期时间（约 2 小时），超过后需要使用服务端 API
- 在 `bot.ts` 中将 `sessionWebhook` 附加到 inbound context 中，回复时优先使用
- 服务端 API 作为 fallback 和主动发送场景使用

### D2: 消息格式映射

| OpenClaw 输出    | 钉钉发送格式  | msgKey           |
| ---------------- | ------------- | ---------------- |
| 纯文本           | 文本消息      | `sampleText`     |
| Markdown         | Markdown 消息 | `sampleMarkdown` |
| 长文本（需分块） | 多条文本消息  | `sampleText`     |

**选择：默认使用 Markdown 格式发送**

理由：

- OpenClaw 的 AI 回复通常包含 Markdown 格式（代码块、列表、加粗等）
- 钉钉支持 Markdown 消息类型，渲染效果良好
- 纯文本内容发送 Markdown 也能正常显示

### D3: @提及检测策略

**选择：解析消息体中的 @信息**

钉钉群聊中 @机器人时，消息内容会包含 `@机器人名称` 文本，但没有结构化的 mention 字段。检测策略：

1. 单聊（`conversationType === "1"`）：始终视为需要响应
2. 群聊（`conversationType === "2"`）：检查消息内容是否包含对机器人的 @提及

钉钉 Stream 模式下，群聊中 @机器人的消息会被推送到回调，未 @的消息不推送。因此对于 Stream 模式，`requireMention` 的检测实际上是由钉钉服务端完成的。

### D4: 消息去重机制

**选择：基于 msgId 的持久化去重（参考飞书实现）**

理由：

- 钉钉 Stream 模式在 60 秒内未收到 ACK 会重试推送
- 使用 OpenClaw 核心的 `tryRecordMessagePersistent` 机制，以 `msgId` 为唯一键
- 重复消息直接丢弃，记录 debug 日志

### D5: 消息分块策略

**选择：默认 2000 字符分块，使用 Markdown chunker**

理由：

- 钉钉单条消息无明确字符限制，但过长的消息显示效果不佳
- 2000 字符与飞书保持一致，提供良好的阅读体验
- 使用 OpenClaw 核心的 `chunkMarkdownText` 工具保持 Markdown 格式完整性

## Risks / Trade-offs

### R1: sessionWebhook 过期

**风险**：sessionWebhook 有过期时间（约 2 小时），如果 AI 回复延迟可能超时。

**缓解**：

- 检查 `sessionWebhookExpiredTime`，过期时自动切换到服务端 API
- 日志记录 sessionWebhook 过期事件

### R2: 群聊 @提及的文本污染

**风险**：群聊消息中的 `@机器人名称` 文本会包含在 `text.content` 中，传递给 AI 时可能造成干扰。

**缓解**：

- 在消息预处理阶段剥离 `@机器人名称` 前缀
- 仅传递用户实际输入的内容给 AI

### R3: 非文本消息的处理

**风险**：用户可能发送图片、文件等非文本消息，但本提案暂不实现完整的媒体处理。

**缓解**：

- 对非文本消息类型，提取描述性文本（如 `[图片]`、`[文件: xxx.pdf]`）
- 完整的媒体处理在提案 4 中实现
