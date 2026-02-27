## ADDED Requirements

### Requirement: 通过 sessionWebhook 回复消息

系统 SHALL 支持通过钉钉消息回调中的 `sessionWebhook` URL 发送回复消息。

#### Scenario: 发送文本回复

- **WHEN** AI 生成了回复内容，且 `sessionWebhook` 尚未过期
- **THEN** 系统 SHALL 向 `sessionWebhook` URL 发送 POST 请求，body 包含 `msgtype: "text"` 和 `text.content` 字段，携带 `x-acs-dingtalk-access-token` header

#### Scenario: 发送 Markdown 回复

- **WHEN** AI 生成了包含 Markdown 格式的回复内容
- **THEN** 系统 SHALL 向 `sessionWebhook` URL 发送 POST 请求，body 包含 `msgtype: "markdown"` 和 `markdown.title`、`markdown.text` 字段

#### Scenario: sessionWebhook 过期时的 fallback

- **WHEN** 当前时间超过 `sessionWebhookExpiredTime`
- **THEN** 系统 SHALL 自动切换到服务端 API 发送消息，并记录 info 级别日志说明 webhook 已过期

### Requirement: 通过服务端 API 主动发送消息

系统 SHALL 支持通过钉钉服务端 API 发送主动消息（不依赖 sessionWebhook）。

#### Scenario: 主动发送单聊消息

- **WHEN** 需要向用户发送主动消息（如配对通知）
- **THEN** 系统 SHALL 调用 `POST https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend`，携带 `robotCode`、`userIds`、`msgKey`（如 `sampleText`）、`msgParam`（JSON 字符串），使用 access_token 认证

#### Scenario: 主动发送群聊消息

- **WHEN** 需要向群聊发送主动消息
- **THEN** 系统 SHALL 调用 `POST https://api.dingtalk.com/v1.0/robot/groupMessages/send`，携带 `robotCode`、`openConversationId`、`msgKey`、`msgParam`

### Requirement: 消息格式支持

系统 SHALL 支持以下消息发送格式。

#### Scenario: 发送纯文本消息

- **WHEN** 发送内容为纯文本
- **THEN** 系统 SHALL 使用 `msgKey: "sampleText"`，`msgParam` 为 `{"content": "消息内容"}`

#### Scenario: 发送 Markdown 消息

- **WHEN** 发送内容为 Markdown 格式
- **THEN** 系统 SHALL 使用 `msgKey: "sampleMarkdown"`，`msgParam` 为 `{"title": "标题", "text": "Markdown 内容"}`

### Requirement: access_token 管理

系统 SHALL 在使用服务端 API 时正确管理 access_token 的获取和使用。

#### Scenario: 获取 access_token

- **WHEN** 需要调用服务端 API
- **THEN** 系统 SHALL 通过 `DWClient.getAccessToken()` 获取有效的 access_token，并在 API 请求的 `x-acs-dingtalk-access-token` header 中携带

#### Scenario: access_token 获取失败

- **WHEN** `getAccessToken()` 调用失败（如凭证被撤销）
- **THEN** 系统 SHALL 记录错误日志，不 SHALL 尝试发送消息，向上层返回发送失败结果

### Requirement: 发送错误处理

系统 SHALL 优雅处理消息发送失败的场景。

#### Scenario: sessionWebhook 请求失败

- **WHEN** 向 `sessionWebhook` 发送请求返回非 200 状态码
- **THEN** 系统 SHALL 记录错误日志（包含状态码和响应内容），尝试通过服务端 API 重试发送

#### Scenario: 服务端 API 请求失败

- **WHEN** 服务端 API 请求失败（网络错误或 API 错误）
- **THEN** 系统 SHALL 记录错误日志，不 SHALL 无限重试，向上层返回发送失败结果
