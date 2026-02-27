## ADDED Requirements

### Requirement: 私聊访问策略

系统 SHALL 根据 `dmPolicy` 配置控制私聊消息的处理。

#### Scenario: dmPolicy 为 open

- **WHEN** `dmPolicy` 设置为 `"open"` 且 `allowFrom` 包含 `"*"`
- **THEN** 系统 SHALL 允许所有用户通过私聊与机器人对话

#### Scenario: dmPolicy 为 pairing

- **WHEN** `dmPolicy` 设置为 `"pairing"`（默认值）
- **THEN** 系统 SHALL 对未授权用户触发配对流程，已授权用户正常处理

#### Scenario: dmPolicy 为 allowlist

- **WHEN** `dmPolicy` 设置为 `"allowlist"`
- **THEN** 系统 SHALL 仅允许 `allowFrom` 列表中的用户对话，其他用户的消息被静默忽略

#### Scenario: dmPolicy 为 disabled

- **WHEN** `dmPolicy` 设置为 `"disabled"`
- **THEN** 系统 SHALL 忽略所有私聊消息，不做任何响应

### Requirement: 群聊访问策略

系统 SHALL 根据 `groupPolicy` 配置控制群聊消息的处理。

#### Scenario: groupPolicy 为 open

- **WHEN** `groupPolicy` 设置为 `"open"`（默认值）
- **THEN** 系统 SHALL 允许所有群组中被 @的消息

#### Scenario: groupPolicy 为 allowlist

- **WHEN** `groupPolicy` 设置为 `"allowlist"`
- **THEN** 系统 SHALL 仅处理 `groupAllowFrom` 列表中的群组消息，其他群组的消息被忽略

#### Scenario: groupPolicy 为 disabled

- **WHEN** `groupPolicy` 设置为 `"disabled"`
- **THEN** 系统 SHALL 忽略所有群聊消息

### Requirement: 白名单匹配

系统 SHALL 实现白名单的匹配逻辑。

#### Scenario: staffId 完全匹配

- **WHEN** 用户的 `senderStaffId` 为 `"042abc"` 且 `allowFrom` 包含 `"042abc"`
- **THEN** 系统 SHALL 判定该用户在白名单中

#### Scenario: 通配符匹配

- **WHEN** `allowFrom` 包含 `"*"`
- **THEN** 系统 SHALL 判定所有用户都在白名单中

#### Scenario: 不在白名单中

- **WHEN** 用户的 `senderStaffId` 不在 `allowFrom` 列表中且列表不含 `"*"`
- **THEN** 系统 SHALL 判定该用户不在白名单中

### Requirement: 安全警告

系统 SHALL 在不安全的配置下生成警告信息。

#### Scenario: groupPolicy 为 open 时的警告

- **WHEN** `groupPolicy` 设置为 `"open"`
- **THEN** 系统 SHALL 通过 `collectWarnings` 返回警告信息，提示机器人将响应所有群组中的 @消息
