## ADDED Requirements

### Requirement: 媒体消息接收与下载

系统 SHALL 支持接收钉钉消息中的媒体文件并下载保存。

#### Scenario: 接收图片消息

- **WHEN** 用户发送图片消息（`msgtype: "picture"`）
- **THEN** 系统 SHALL 通过 `pictureDownloadCode` 调用文件下载 API 获取图片数据，保存到本地临时存储，并将图片路径传递给 AI

#### Scenario: 接收文件消息

- **WHEN** 用户发送文件消息（`msgtype: "file"`）
- **THEN** 系统 SHALL 通过 `downloadCode` 调用文件下载 API 获取文件数据，保存并传递给 AI

#### Scenario: 接收音频消息

- **WHEN** 用户发送音频消息（`msgtype: "audio"`）
- **THEN** 系统 SHALL 下载音频文件并保存，将文件路径传递给 AI

#### Scenario: 文件大小限制检查

- **WHEN** 收到的媒体文件大小超过 `mediaMaxMb` 配置值
- **THEN** 系统 SHALL 跳过下载，向 AI 传递 `[文件过大，无法处理]` 描述文本

#### Scenario: 下载失败处理

- **WHEN** 文件下载 API 调用失败
- **THEN** 系统 SHALL 记录错误日志，向 AI 传递 `[文件下载失败]` 描述文本，不 SHALL 影响消息的其他部分处理

### Requirement: 媒体消息发送

系统 SHALL 支持通过钉钉 API 发送媒体消息。

#### Scenario: 发送图片消息

- **WHEN** AI 回复包含图片 URL
- **THEN** 系统 SHALL 下载图片、上传到钉钉文件服务、使用返回的 mediaId 构建图片消息并发送

#### Scenario: 发送文件消息

- **WHEN** AI 回复包含文件附件
- **THEN** 系统 SHALL 上传文件到钉钉文件服务，使用 mediaId 发送文件消息

#### Scenario: 媒体上传失败的 fallback

- **WHEN** 媒体文件上传到钉钉失败
- **THEN** 系统 SHALL 降级为发送包含文件 URL 链接的文本消息

### Requirement: 媒体大小配置

系统 SHALL 通过 `mediaMaxMb` 配置项控制媒体文件的大小限制。

#### Scenario: 默认大小限制

- **WHEN** 用户未配置 `mediaMaxMb`
- **THEN** 系统 SHALL 使用默认值 30MB
