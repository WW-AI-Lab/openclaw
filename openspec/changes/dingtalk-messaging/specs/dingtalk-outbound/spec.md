## ADDED Requirements

### Requirement: Outbound 适配器实现

系统 SHALL 实现 `ChannelOutboundAdapter` 接口，作为钉钉渠道的出站消息适配器。

#### Scenario: deliveryMode 配置

- **WHEN** 系统初始化钉钉 outbound 适配器
- **THEN** `deliveryMode` SHALL 设置为 `"direct"`（消息直接通过插件发送，不经过 Gateway 转发）

#### Scenario: 文本分块配置

- **WHEN** 系统初始化钉钉 outbound 适配器
- **THEN** `textChunkLimit` SHALL 设置为 2000 字符，`chunkerMode` SHALL 设置为 `"markdown"`，使用 OpenClaw 核心的 Markdown 文本分块器

### Requirement: sendText 实现

系统 SHALL 实现 `sendText` 方法，将文本消息发送到钉钉。

#### Scenario: 发送文本到单聊

- **WHEN** 调用 `sendText` 且目标类型为用户（`to` 格式为 `user:staffId`）
- **THEN** 系统 SHALL 向目标用户发送文本消息，返回包含 `channel: "dingtalk"` 的发送结果

#### Scenario: 发送文本到群聊

- **WHEN** 调用 `sendText` 且目标类型为群组（`to` 格式为 `chat:conversationId`）
- **THEN** 系统 SHALL 向目标群组发送文本消息

### Requirement: sendMedia 实现

系统 SHALL 实现 `sendMedia` 方法，处理包含媒体的消息发送。

#### Scenario: 文本+媒体 URL 的 fallback

- **WHEN** 调用 `sendMedia` 但尚未实现完整媒体上传
- **THEN** 系统 SHALL 将文本和媒体 URL 组合成文本消息发送（格式：`"文本内容\n\n📎 媒体链接: URL"`），直到提案 4 实现完整媒体上传

### Requirement: 目标解析

系统 SHALL 实现消息发送目标的解析和标准化。

#### Scenario: 解析用户目标

- **WHEN** 目标字符串为 `"user:staffId123"` 或裸 staffId
- **THEN** 系统 SHALL 将其标准化为 `{ type: "user", staffId: "staffId123" }`

#### Scenario: 解析群组目标

- **WHEN** 目标字符串为 `"chat:cidXXX=="` 或以 `cid` 开头的裸 ID
- **THEN** 系统 SHALL 将其标准化为 `{ type: "chat", openConversationId: "cidXXX==" }`

#### Scenario: 无效目标拒绝

- **WHEN** 目标字符串格式无法识别
- **THEN** 系统 SHALL 返回 `{ ok: false, error: Error("无法解析钉钉目标") }`

### Requirement: 回复分发器

系统 SHALL 实现 `createDingtalkReplyDispatcher`，协调 AI 回复到钉钉消息的发送流程。

#### Scenario: 分发单条回复

- **WHEN** AI 生成一条回复内容
- **THEN** 系统 SHALL 通过 deliver 回调发送消息，优先使用 sessionWebhook

#### Scenario: 分发分块回复

- **WHEN** AI 回复超过 `textChunkLimit`（2000 字符）
- **THEN** 系统 SHALL 将内容按 Markdown 边界分块，依次发送每个块

#### Scenario: 分发时包含消息引用

- **WHEN** 群聊回复且 `replyToMode` 不为 `"off"`
- **THEN** 系统 SHALL 在发送时标识这是对原消息的回复（通过 sessionWebhook 的 at 功能 @原发送者）

### Requirement: 钉钉 ID 格式标准化

系统 SHALL 标准化钉钉的各种 ID 格式，确保在 OpenClaw 系统内一致使用。

#### Scenario: 用户 ID 标准化

- **WHEN** 收到钉钉消息中的 `senderId`（格式如 `$:LWCxxxx`）或 `senderStaffId`（格式如 `042xxx`）
- **THEN** 系统 SHALL 将 `senderStaffId` 作为 OpenClaw 内部的用户标识，格式化为 `dingtalk:staffId:042xxx`

#### Scenario: 会话 ID 标准化

- **WHEN** 收到钉钉消息中的 `conversationId`（格式如 `cidXXXX==`）
- **THEN** 系统 SHALL 保留原始格式作为 OpenClaw 内部的群组标识，格式化为 `dingtalk:chat:cidXXXX==`
