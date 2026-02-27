## ADDED Requirements

### Requirement: 流式卡片创建

系统 SHALL 在 AI 开始生成回复时创建一个互动卡片实例。

#### Scenario: 创建初始流式卡片

- **WHEN** AI 收到用户消息并开始生成回复，且 `streaming` 配置为 `true`
- **THEN** 系统 SHALL 调用钉钉互动卡片 API 创建一个包含初始加载指示的卡片，发送给用户/群组

#### Scenario: streaming 被禁用时使用普通消息

- **WHEN** `streaming` 配置为 `false`
- **THEN** 系统 SHALL 等待 AI 完整生成后，以普通文本/Markdown 消息方式一次性发送

### Requirement: 流式卡片实时更新

系统 SHALL 在 AI 生成过程中实时更新卡片内容。

#### Scenario: 增量内容更新

- **WHEN** AI 产生新的输出内容
- **THEN** 系统 SHALL 通过互动卡片 API 更新卡片的 Markdown 内容，显示最新的完整输出（含已生成部分）

#### Scenario: 更新频率限制

- **WHEN** AI 连续快速产生输出
- **THEN** 系统 SHALL 限制卡片更新频率为最快每 500ms 一次，合并期间产生的所有新内容

#### Scenario: 更新失败降级

- **WHEN** 卡片更新 API 调用失败（如网络错误或 API 限流）
- **THEN** 系统 SHALL 记录警告日志，继续累积内容，在下次更新时发送完整内容；连续失败超过 3 次则降级为普通消息

### Requirement: 流式卡片完成

系统 SHALL 在 AI 完成生成后发送最终版本的卡片。

#### Scenario: 正常完成

- **WHEN** AI 完成回复生成
- **THEN** 系统 SHALL 发送最终更新，将卡片内容设置为完整回复，并标记流式结束

#### Scenario: 生成异常中断

- **WHEN** AI 生成过程中发生异常
- **THEN** 系统 SHALL 更新卡片内容为已生成的部分内容加上错误提示，不 SHALL 保持加载状态

### Requirement: 块级流式支持

系统 SHALL 支持 `blockStreaming` 模式，按 Markdown 块级别更新。

#### Scenario: 启用块级流式

- **WHEN** `blockStreaming` 配置为 `true`（默认）
- **THEN** 系统 SHALL 在 AI 完成一个完整 Markdown 块（段落、代码块、列表等）后才更新卡片，而非逐字符更新

### Requirement: 流式配置

系统 SHALL 通过配置控制流式输出行为。

#### Scenario: 配置项默认值

- **WHEN** 用户未显式配置流式相关选项
- **THEN** 系统 SHALL 使用默认值：`streaming: true`、`blockStreaming: true`
