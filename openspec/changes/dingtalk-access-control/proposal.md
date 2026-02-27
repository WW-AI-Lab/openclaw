## Why

提案 1 和提案 2 分别实现了钉钉插件骨架和消息收发能力，但缺少访问控制和安全策略——任何发送消息的用户都能获得 AI 回复，这在企业场景中是不可接受的。本提案实现钉钉渠道的**访问控制、配对流程和 onboarding 向导**，让管理员能够控制谁可以使用机器人。

此外，新用户首次配置钉钉渠道需要一个清晰的引导流程。参考飞书插件的 onboarding 适配器，实现交互式的配置向导，降低用户的配置门槛。

本提案为钉钉渠道系列提案的**第 3 个（共 4 个）**，依赖提案 1 和提案 2。

## What Changes

- **实现配对（Pairing）适配器**：支持 `dmPolicy: "pairing"` 模式，未授权用户发送消息时收到配对码，管理员通过 CLI 批准后授权对话
- **实现安全（Security）适配器**：实现 `collectWarnings` 提示安全风险（如 groupPolicy 为 open 时的警告）
- **实现访问策略逻辑**：
  - 私聊策略（dmPolicy）：open、pairing、allowlist、disabled
  - 群聊策略（groupPolicy）：open、allowlist、disabled
  - 白名单（allowFrom、groupAllowFrom）
- **实现 Onboarding 适配器**：提供交互式 CLI 向导，引导用户完成钉钉应用创建、凭证配置、权限配置
- **实现 Directory 适配器**：提供已知用户和群组的列表能力
- **实现用户/群组策略判断逻辑**：在消息处理流程中集成策略检查

## Capabilities

### New Capabilities

- `dingtalk-pairing`: 钉钉渠道的配对授权流程，包括配对码生成与发送、配对批准通知、白名单管理
- `dingtalk-access-policy`: 钉钉渠道的访问策略实现，包括私聊策略（open/pairing/allowlist/disabled）、群聊策略（open/allowlist/disabled）、@提及要求的执行
- `dingtalk-onboarding`: 钉钉渠道的 CLI 配置向导，引导用户完成应用创建和凭证配置

### Modified Capabilities

（无）

## Impact

- **修改文件**：`extensions/dingtalk/src/channel.ts`（挂载 pairing、security、onboarding、directory 适配器）
- **修改文件**：`extensions/dingtalk/src/bot.ts`（在消息处理流程中集成访问策略检查）
- **新增文件**：`src/policy.ts`（访问策略判断）、`src/onboarding.ts`（onboarding 适配器）、`src/directory.ts`（目录适配器）
- **用户影响**：用户需要在配置中设置 `dmPolicy` 和 `groupPolicy`（有默认值）
- **CLI 影响**：`openclaw pairing list dingtalk`、`openclaw pairing approve dingtalk` 命令可用
