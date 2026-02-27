## ADDED Requirements

### Requirement: 插件注册与入口

系统 SHALL 在 `extensions/dingtalk/index.ts` 中导出符合 OpenClaw 插件规范的默认导出对象，包含 `id`、`name`、`configSchema`、`register(api)` 方法。

#### Scenario: 插件加载与注册

- **WHEN** OpenClaw 启动并发现 `extensions/dingtalk` 插件
- **THEN** 系统 SHALL 调用 `register(api)` 方法，通过 `api.registerChannel({ plugin: dingtalkPlugin })` 注册钉钉渠道

#### Scenario: 运行时注入

- **WHEN** 插件的 `register` 方法被调用
- **THEN** 系统 SHALL 通过 `setDingtalkRuntime(api.runtime)` 保存运行时引用，供后续模块使用

### Requirement: ChannelPlugin 接口实现

系统 SHALL 实现 `ChannelPlugin<ResolvedDingtalkAccount>` 接口，提供钉钉渠道的完整元数据和能力声明。

#### Scenario: 渠道元数据正确

- **WHEN** 系统查询钉钉渠道的元信息
- **THEN** 系统 SHALL 返回以下元数据：
  - `id`: `"dingtalk"`
  - `label`: `"DingTalk"`
  - `selectionLabel`: `"DingTalk (钉钉)"`
  - `docsPath`: `"/channels/dingtalk"`
  - `blurb`: 简短描述钉钉企业消息功能
  - `aliases`: `["dt"]`
  - `order`: 40

#### Scenario: 能力声明正确

- **WHEN** 系统查询钉钉渠道的能力
- **THEN** 系统 SHALL 声明以下能力：
  - `chatTypes`: `["direct", "group"]`（支持单聊和群聊）
  - `media`: `true`（支持媒体，后续提案实现）
  - `reply`: `true`（支持消息回复）
  - `polls`: `false`
  - `threads`: `false`
  - `reactions`: `false`
  - `edit`: `false`（钉钉不支持编辑已发送消息）

### Requirement: Gateway 适配器

系统 SHALL 实现 `ChannelGatewayAdapter`，通过 `startAccount` 方法启动钉钉 Stream 连接。

#### Scenario: 启动账号 Stream 连接

- **WHEN** Gateway 调用 `startAccount(ctx)` 启动钉钉账号
- **THEN** 系统 SHALL 解析账号配置，创建 `DWClient` 实例，注册消息回调监听器，并调用 `connect()` 建立连接

#### Scenario: 启动时记录日志

- **WHEN** `startAccount` 被调用
- **THEN** 系统 SHALL 通过 `ctx.log` 记录启动信息，包含 accountId 和连接模式（stream）

### Requirement: Status 适配器

系统 SHALL 实现 `ChannelStatusAdapter`，提供账号状态查询和健康探测能力。

#### Scenario: 构建账号快照

- **WHEN** 系统构建钉钉渠道状态
- **THEN** 系统 SHALL 返回 `ChannelAccountSnapshot`，包含 `accountId`、`enabled`、`configured`、`name` 等字段

#### Scenario: 探测账号健康

- **WHEN** 系统对钉钉账号执行 probeAccount
- **THEN** 系统 SHALL 尝试获取 access_token 验证凭证有效性，成功返回 probe 结果，失败抛出包含错误信息的异常

### Requirement: package.json 插件元数据

系统 SHALL 在 `extensions/dingtalk/package.json` 中配置完整的插件元数据。

#### Scenario: 元数据格式正确

- **WHEN** OpenClaw 加载钉钉插件的 package.json
- **THEN** 配置 SHALL 包含：
  - `name`: `"@openclaw/dingtalk"`
  - `openclaw.extensions`: `["./index.ts"]`
  - `openclaw.channel.id`: `"dingtalk"`
  - `openclaw.channel.label`: `"DingTalk"`
  - `openclaw.channel.selectionLabel`: `"DingTalk (钉钉)"`
  - `openclaw.channel.aliases`: `["dt"]`
  - `openclaw.install.localPath`: `"extensions/dingtalk"`

#### Scenario: 依赖声明正确

- **WHEN** 安装钉钉插件依赖
- **THEN** `dependencies` SHALL 包含 `dingtalk-stream` 作为运行时依赖，`openclaw` SHALL 在 `devDependencies` 或 `peerDependencies` 中声明
