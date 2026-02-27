## ADDED Requirements

### Requirement: 核心凭证配置

系统 SHALL 支持通过配置文件设置钉钉渠道的核心凭证，包括 `clientId`（AppKey）、`clientSecret`（AppSecret）和 `robotCode`（机器人编码）。

#### Scenario: 最小配置

- **WHEN** 用户仅提供 `clientId` 和 `clientSecret`
- **THEN** 系统 SHALL 接受配置为有效配置，`robotCode` 默认使用 `clientId` 的值

#### Scenario: 完整凭证配置

- **WHEN** 用户提供 `clientId`、`clientSecret`、`robotCode`
- **THEN** 系统 SHALL 使用用户指定的 `robotCode`，不使用 `clientId` 作为默认值

#### Scenario: 缺少必要凭证

- **WHEN** 用户未提供 `clientId` 或 `clientSecret`
- **THEN** 系统 SHALL 将该账号标记为 `configured: false`，不 SHALL 尝试建立 Stream 连接

### Requirement: 启用/禁用控制

系统 SHALL 支持通过 `enabled` 字段控制钉钉渠道和单个账号的启用状态。

#### Scenario: 渠道级别禁用

- **WHEN** 用户设置 `channels.dingtalk.enabled` 为 `false`
- **THEN** 系统 SHALL 不启动任何钉钉账号的 Stream 连接

#### Scenario: 账号级别禁用

- **WHEN** 用户设置 `channels.dingtalk.accounts.main.enabled` 为 `false`
- **THEN** 系统 SHALL 不启动该账号的 Stream 连接，但其他已启用账号不受影响

### Requirement: 多账号配置

系统 SHALL 支持在 `channels.dingtalk.accounts` 下配置多个钉钉机器人账号，每个账号可独立设置凭证。

#### Scenario: 单账号模式（默认）

- **WHEN** 用户在 `channels.dingtalk` 顶层配置凭证，未使用 `accounts` 字段
- **THEN** 系统 SHALL 创建一个默认账号（accountId 使用 `DEFAULT_ACCOUNT_ID`），使用顶层凭证

#### Scenario: 多账号模式

- **WHEN** 用户在 `channels.dingtalk.accounts` 下定义多个账号（如 `main`、`backup`）
- **THEN** 系统 SHALL 为每个账号独立解析配置，账号级凭证覆盖顶层默认值

#### Scenario: 账号配置继承

- **WHEN** 某账号未指定 `clientId` 但顶层配置了 `clientId`
- **THEN** 系统 SHALL 从顶层配置继承 `clientId` 的值

### Requirement: 策略配置占位

系统 SHALL 在配置 Schema 中预留访问控制策略字段，为后续提案的实现做准备。

#### Scenario: dmPolicy 字段定义

- **WHEN** 用户设置 `channels.dingtalk.dmPolicy`
- **THEN** 系统 SHALL 接受以下值之一：`"open"`、`"pairing"`、`"allowlist"`、`"disabled"`，默认值为 `"pairing"`

#### Scenario: groupPolicy 字段定义

- **WHEN** 用户设置 `channels.dingtalk.groupPolicy`
- **THEN** 系统 SHALL 接受以下值之一：`"open"`、`"allowlist"`、`"disabled"`，默认值为 `"open"`

#### Scenario: requireMention 字段定义

- **WHEN** 用户设置 `channels.dingtalk.requireMention`
- **THEN** 系统 SHALL 接受布尔值，默认值为 `true`（群聊中需要 @机器人才响应）

### Requirement: 配置 Schema 验证

系统 SHALL 使用 Zod Schema 验证钉钉渠道配置的合法性。

#### Scenario: clientSecret 标记为敏感

- **WHEN** 系统处理钉钉配置中的 `clientSecret`
- **THEN** 系统 SHALL 将其标记为敏感字段（`secret: true`），不在日志或状态输出中明文显示

#### Scenario: 无效配置值拒绝

- **WHEN** 用户设置 `dmPolicy` 为无效值（如 `"invalid"`）
- **THEN** 系统 SHALL 拒绝该配置并报告验证错误

### Requirement: 账号解析函数

系统 SHALL 提供 `resolveDingtalkAccount` 函数，从 OpenClaw 配置中解析出完整的钉钉账号信息。

#### Scenario: 解析默认账号

- **WHEN** 调用 `resolveAccount(cfg)` 未指定 accountId
- **THEN** 系统 SHALL 返回默认账号的 `ResolvedDingtalkAccount`，包含合并后的顶层+账号级配置

#### Scenario: 解析指定账号

- **WHEN** 调用 `resolveAccount(cfg, "backup")`
- **THEN** 系统 SHALL 返回名为 "backup" 的账号配置，账号级值覆盖顶层默认值

#### Scenario: 列举所有账号

- **WHEN** 调用 `listAccountIds(cfg)`
- **THEN** 系统 SHALL 返回所有已配置的账号 ID 列表
