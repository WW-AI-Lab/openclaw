## ADDED Requirements

### Requirement: Stream 连接建立

系统 SHALL 使用 `dingtalk-stream` SDK 的 `DWClient` 与钉钉服务器建立 WebSocket 长连接。连接建立需要提供有效的 `clientId`（AppKey）和 `clientSecret`（AppSecret）。

#### Scenario: 使用有效凭证建立连接

- **WHEN** 用户配置了有效的 `clientId` 和 `clientSecret`，且 Gateway 启动
- **THEN** 系统 SHALL 调用 `DWClient.connect()` 成功建立 WebSocket 连接，并注册消息回调监听器（topic: `/v1.0/im/bot/messages/get`）

#### Scenario: 凭证无效时连接失败

- **WHEN** 用户配置了无效的 `clientId` 或 `clientSecret`
- **THEN** 系统 SHALL 捕获连接异常，记录错误日志（包含 accountId 和错误原因），不 SHALL 导致 Gateway 进程崩溃

### Requirement: 自动重连

系统 SHALL 在 WebSocket 连接断开时自动重连，利用 `DWClient` 内置的 `autoReconnect` 机制。

#### Scenario: 网络中断后自动恢复

- **WHEN** WebSocket 连接因网络问题断开
- **THEN** 系统 SHALL 自动尝试重新连接（默认间隔 1 秒），并在重连成功后恢复消息接收能力

#### Scenario: 服务端主动断开后重连

- **WHEN** 钉钉服务端发送 `disconnect` 系统消息
- **THEN** 系统 SHALL 触发重连流程，重新获取 endpoint 并建立新的 WebSocket 连接

### Requirement: 心跳保活

系统 SHALL 响应钉钉服务端的心跳检测，维持连接活跃状态。

#### Scenario: 响应服务端 ping

- **WHEN** 收到钉钉服务端的 `ping` 系统消息
- **THEN** 系统 SHALL 通过 `DWClient` 自动返回 pong 响应（由 SDK 内置处理），保持连接不被服务端超时断开

#### Scenario: 客户端侧心跳检测

- **WHEN** 启用了 `keepAlive` 选项
- **THEN** 系统 SHALL 以 8 秒间隔发送客户端侧 ping，检测连接是否仍然活跃；若 ping-pong 超时则终止并重建连接

### Requirement: 优雅停止

系统 SHALL 支持通过 AbortSignal 优雅停止 Stream 连接。

#### Scenario: Gateway 停止时断开连接

- **WHEN** Gateway 触发 abort signal（用户停止 Gateway 或账号被禁用）
- **THEN** 系统 SHALL 调用 `DWClient.disconnect()` 主动断开 WebSocket 连接，取消自动重连，释放相关资源

#### Scenario: 多账号独立停止

- **WHEN** 多账号模式下某个账号被禁用
- **THEN** 系统 SHALL 仅停止该账号对应的 Stream 连接，不影响其他账号的连接

### Requirement: 消息 ACK 响应

系统 SHALL 在处理回调消息后通过 `socketCallBackResponse` 返回 ACK，避免钉钉服务端在 60 秒内重试推送。

#### Scenario: 正常处理后返回 ACK

- **WHEN** 收到机器人回调消息（topic: `/v1.0/im/bot/messages/get`）并完成处理
- **THEN** 系统 SHALL 调用 `client.socketCallBackResponse(messageId, responseData)` 返回成功响应

#### Scenario: 处理异常时仍返回 ACK

- **WHEN** 消息处理过程中发生异常
- **THEN** 系统 SHALL 仍然返回 ACK 响应（避免重复接收），并将异常记录到日志
