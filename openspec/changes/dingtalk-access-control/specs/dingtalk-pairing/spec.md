## ADDED Requirements

### Requirement: 配对码发送

系统 SHALL 在 `dmPolicy` 为 `"pairing"` 时，向未授权用户发送配对码。

#### Scenario: 未授权用户首次发送消息

- **WHEN** 一个未在白名单中的用户通过单聊向机器人发送消息，且 `dmPolicy` 为 `"pairing"`
- **THEN** 系统 SHALL 生成配对码并通过钉钉消息回复给用户，消息内容包含配对码和批准指令说明

#### Scenario: 已授权用户正常对话

- **WHEN** 一个已通过配对或在白名单中的用户发送消息
- **THEN** 系统 SHALL 正常处理消息，不显示配对码

### Requirement: 配对批准通知

系统 SHALL 在管理员批准配对后通知用户。

#### Scenario: 管理员批准配对

- **WHEN** 管理员执行 `openclaw pairing approve dingtalk <code>`
- **THEN** 系统 SHALL 通过钉钉服务端 API 向该用户发送批准通知消息（使用 `PAIRING_APPROVED_MESSAGE`）

#### Scenario: 通知发送失败

- **WHEN** 配对批准通知的消息发送失败（如凭证过期）
- **THEN** 系统 SHALL 记录错误日志，但配对批准本身 SHALL 仍然生效

### Requirement: 配对 ID 标签

系统 SHALL 定义钉钉渠道的配对 ID 标签，用于 CLI 输出。

#### Scenario: 配对列表中的 ID 显示

- **WHEN** 用户执行 `openclaw pairing list dingtalk`
- **THEN** 系统 SHALL 使用 `"staffId"` 作为 ID 标签（idLabel），显示用户的 `senderStaffId`

### Requirement: 白名单条目标准化

系统 SHALL 标准化添加到白名单的用户 ID。

#### Scenario: 标准化 staffId 格式

- **WHEN** 用户添加白名单条目（如 `"042xxx"`）
- **THEN** 系统 SHALL 通过 `normalizeAllowEntry` 函数保留 staffId 格式不变（钉钉 staffId 已是标准格式）
