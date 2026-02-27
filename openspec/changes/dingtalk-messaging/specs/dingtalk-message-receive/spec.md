## ADDED Requirements

### Requirement: 消息回调解析

系统 SHALL 解析钉钉 Stream 回调数据（`DWClientDownStream.data`），将 JSON 字符串转换为结构化的 `DingtalkMessageContext` 对象。

#### Scenario: 解析单聊文本消息

- **WHEN** 收到 `conversationType` 为 `"1"` 的文本消息回调
- **THEN** 系统 SHALL 解析出 `chatType: "p2p"`、`senderId`、`senderNick`、`conversationId`、`msgId`、`text.content`，并将 `sessionWebhook` 保存到上下文中

#### Scenario: 解析群聊文本消息

- **WHEN** 收到 `conversationType` 为 `"2"` 的文本消息回调
- **THEN** 系统 SHALL 解析出 `chatType: "group"`、`conversationId`（群会话 ID）、`senderId`、`senderNick`、`text.content`

#### Scenario: 解析非文本消息类型

- **WHEN** 收到 `msgtype` 为 `"picture"`、`"richText"`、`"file"`、`"audio"` 或 `"video"` 的消息
- **THEN** 系统 SHALL 提取消息类型描述文本（如 `[图片]`、`[文件: filename]`），并保存原始消息中的媒体标识（如 `downloadCode`、`pictureDownloadCode`）供后续处理

### Requirement: 消息去重

系统 SHALL 对收到的消息进行去重，防止 Stream 重试导致的重复处理。

#### Scenario: 首次收到的消息正常处理

- **WHEN** 收到一条 `msgId` 为 `"msg001"` 的消息，且该 `msgId` 未被记录过
- **THEN** 系统 SHALL 记录该 `msgId` 并正常处理消息

#### Scenario: 重复消息被丢弃

- **WHEN** 收到一条 `msgId` 为 `"msg001"` 的消息，且该 `msgId` 已被记录
- **THEN** 系统 SHALL 丢弃该消息，记录 debug 级别日志，不 SHALL 重复触发 AI 回复

### Requirement: @提及检测

系统 SHALL 在群聊场景下检测消息是否 @了机器人。

#### Scenario: 单聊消息始终响应

- **WHEN** 收到 `conversationType` 为 `"1"` 的消息
- **THEN** 系统 SHALL 视为对机器人的直接消息，无论是否包含 @内容都正常处理

#### Scenario: 群聊中 Stream 模式的 @推送

- **WHEN** 收到群聊消息且使用 Stream 模式
- **THEN** 系统 SHALL 识别为被 @的消息（钉钉 Stream 模式仅推送 @机器人的群聊消息），设置 `mentionedBot: true`

### Requirement: @文本清理

系统 SHALL 在传递消息内容给 AI 前，清理消息中的 @机器人文本。

#### Scenario: 清理群聊中的 @前缀

- **WHEN** 群聊消息内容为 `"@MyBot 你好世界"`
- **THEN** 系统 SHALL 将传递给 AI 的内容清理为 `"你好世界"`（去除 @机器人名称及前后空格）

#### Scenario: 纯文本消息不受影响

- **WHEN** 消息内容为 `"你好世界"`（不含 @）
- **THEN** 系统 SHALL 原样传递消息内容

### Requirement: 消息路由到 OpenClaw 核心

系统 SHALL 将解析后的消息通过 OpenClaw 核心的 `dispatchReplyFromConfig` 分发到 AI Agent 处理。

#### Scenario: 构建 inbound context

- **WHEN** 消息解析完成且通过去重和策略检查
- **THEN** 系统 SHALL 构建包含以下信息的 inbound context：
  - `channel`: `"dingtalk"`
  - `accountId`: 当前账号 ID
  - `chatType`: `"p2p"` 或 `"group"`
  - `senderId`: 发送者 ID
  - `senderName`: 发送者昵称
  - `conversationId`: 会话 ID
  - `text`: 清理后的消息文本
  - `sessionWebhook`: 用于回复的 webhook URL

#### Scenario: 创建回复分发器

- **WHEN** 需要回复用户消息
- **THEN** 系统 SHALL 创建 `DingtalkReplyDispatcher`，绑定到当前会话上下文，通过 deliver 回调将 AI 回复发送到钉钉
