## ADDED Requirements

### Requirement: Onboarding 状态检查

系统 SHALL 提供 `getStatus` 方法，返回钉钉渠道的当前配置状态。

#### Scenario: 渠道未配置

- **WHEN** 钉钉渠道尚未配置任何凭证
- **THEN** 系统 SHALL 返回状态为 `"not-configured"`，包含引导信息

#### Scenario: 渠道已配置

- **WHEN** 钉钉渠道已配置有效凭证
- **THEN** 系统 SHALL 返回状态为 `"configured"`，显示当前账号信息

### Requirement: 凭证配置向导

系统 SHALL 提供 `configure` 方法，引导用户完成凭证配置。

#### Scenario: 首次配置

- **WHEN** 用户通过 `openclaw channels add` 选择 DingTalk
- **THEN** 系统 SHALL 依次引导用户：
  1. 展示创建钉钉企业内部应用的说明（含开发者后台链接）
  2. 提示用户输入 Client ID（AppKey）
  3. 提示用户输入 Client Secret（AppSecret）
  4. 验证凭证有效性
  5. 提示用户在开发者后台启用机器人能力并选择 Stream 模式

#### Scenario: 凭证验证失败

- **WHEN** 用户输入的凭证无效（probeAccount 失败）
- **THEN** 系统 SHALL 提示凭证无效，允许用户重新输入

### Requirement: 私聊策略配置

系统 SHALL 提供 `dmPolicy` 配置步骤。

#### Scenario: 选择默认配对模式

- **WHEN** 用户在 onboarding 中选择私聊策略
- **THEN** 系统 SHALL 提供 `"pairing"`（默认推荐）、`"open"`、`"allowlist"`、`"disabled"` 选项

### Requirement: 渠道禁用

系统 SHALL 提供 `disable` 方法，禁用钉钉渠道。

#### Scenario: 禁用渠道

- **WHEN** 用户通过 onboarding 或 CLI 禁用钉钉渠道
- **THEN** 系统 SHALL 设置 `channels.dingtalk.enabled` 为 `false`

### Requirement: Directory 适配器

系统 SHALL 实现 `ChannelDirectoryAdapter`，提供已知用户和群组列表。

#### Scenario: 列出已知用户

- **WHEN** 调用 `listPeers`
- **THEN** 系统 SHALL 从 `allowFrom` 配置中返回已知用户列表，每个用户包含 `id`、`kind: "dm"` 信息

#### Scenario: 列出已知群组

- **WHEN** 调用 `listGroups`
- **THEN** 系统 SHALL 从配置中的 `groups` 和 `groupAllowFrom` 返回已知群组列表，每个群组包含 `id`、`kind: "group"` 信息
