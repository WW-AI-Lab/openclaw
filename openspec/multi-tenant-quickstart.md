# OpenClaw 多租户快速实现指南

> **目标**: 通过单一飞书机器人，将不同用户路由到完全独立的 OpenClaw 实例
> **原则**: 不修改 OpenClaw 源码，纯外部实现

---

## 核心架构

```
飞书 → 反向代理 → 用户专属 OpenClaw 实例
```

---

## 方案一：轻量级实现（进程池模式）

适合：10-50 用户，单机部署

### 文件结构

```
~/claw-multi-tenant/
├── proxy/
│   ├── index.js           # 代理服务入口
│   ├── router.js          # 路由逻辑
│   ├── pool.js            # 实例池管理
│   └── package.json
├── instances/             # 实例数据目录
│   ├── user-ou_xxxx1/
│   └── user-ou_xxxx2/
└── start.sh               # 启动脚本
```

### 实现代码

**proxy/package.json**

```json
{
  "name": "claw-proxy",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ioredis": "^5.3.2",
    "ws": "^8.14.2"
  }
}
```

**proxy/index.js**

```javascript
import express from 'express';
import { createServer } from 'http';
import { RouterService } from './router.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const router = new RouterService();

// 飞书 Webhook 接收
app.post('/feishu/webhook', async (req, res) => {
  try {
    const event = req.body;
    const senderId = event.sender?.sender_id?.open_id;

    if (!senderId) {
      return res.status(400).json({ code: 2, msg: 'Missing sender_id' });
    }

    // 路由到用户实例
    const instance = await router.getOrCreateInstance(senderId);

    // 转发事件
    const response = await router.forwardToInstance(instance, event);
    return res.json(response);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ code: 500, msg: 'Internal error' });
  }
});

// 健康检查
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 启动服务
app.listen(PORT, () => {
  console.log(`Proxy listening on port ${PORT}`);
});
```

**proxy/router.js**

```javascript
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const BASE_PORT = 18790;
const INSTANCES_DIR = path.join(process.cwd(), 'instances');

export class RouterService {
  constructor() {
    this.instances = new Map();  // userId -> instance info
    this.processes = new Map();  // port -> child process
  }

  async getOrCreateInstance(userId) {
    // 检查是否已有实例
    if (this.instances.has(userId)) {
      return this.instances.get(userId);
    }

    // 创建新实例
    const port = BASE_PORT + this.instances.size;
    const token = this.generateToken();
    const dataDir = path.join(INSTANCES_DIR, `user-${userId}`);

    // 创建数据目录
    await fs.mkdir(dataDir, { recursive: true });

    // 生成配置文件
    await this.generateConfig(dataDir, port, token);

    // 启动 OpenClaw 进程
    await this.startOpenClaw(dataDir, port);

    const instance = { userId, port, token, dataDir };
    this.instances.set(userId, instance);

    return instance;
  }

  async generateConfig(dataDir, port, token) {
    const config = {
      gateway: {
        mode: "local",
        bind: "127.0.0.1",
        port: port,
        auth: { token }
      },
      channels: {
        feishu: {
          enabled: true,
          appId: process.env.FEISHU_APP_ID,
          appSecret: process.env.FEISHU_APP_SECRET,
          encryptKey: process.env.FEISHU_ENCRYPT_KEY,
          verificationToken: process.env.FEISHU_VERIFICATION_TOKEN,
          connectionMode: "websocket",
        }
      },
      agents: {
        defaultAgentId: "main",
        list: [{
          id: "main",
          modelProvider: "anthropic",
          modelId: "claude-sonnet-4-20250514"
        }]
      }
    };

    await fs.writeFile(
      path.join(dataDir, 'openclaw.json'),
      JSON.stringify(config, null, 2)
    );
  }

  async startOpenClaw(dataDir, port) {
    const env = {
      ...process.env,
      OPENCLAW_CONFIG_DIR: dataDir,
      OPENCLAW_GATEWAY_PORT: String(port),
    };

    const proc = spawn('openclaw', ['gateway', 'run'], {
      env,
      stdio: 'pipe',
    });

    this.processes.set(port, proc);

    proc.stdout.on('data', (data) => {
      console.log(`[Instance:${port}]`, data.toString());
    });

    proc.on('exit', (code) => {
      console.log(`[Instance:${port}] Exited with code ${code}`);
      this.processes.delete(port);
    });
  }

  async forwardToInstance(instance, event) {
    // 使用 OpenClaw 的内部 API 或直接调用
    // 这里简化处理，实际需要通过 HTTP 或 WebSocket
    const response = await fetch(`http://127.0.0.1:${instance.port}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${instance.token}`
      },
      body: JSON.stringify({ channel: 'feishu', event })
    });

    return await response.json();
  }

  generateToken() {
    return require('crypto').randomBytes(16).toString('hex');
  }
}
```

**proxy/pool.js**

```javascript
// 实例池管理 - 自动清理空闲实例

export class InstancePool {
  constructor(router, options = {}) {
    this.router = router;
    this.idleTimeout = options.idleTimeout || 30 * 60 * 1000;  // 30分钟
    this.lastAccess = new Map();  // userId -> timestamp
    this.startCleanupTask();
  }

  markAccess(userId) {
    this.lastAccess.set(userId, Date.now());
  }

  startCleanupTask() {
    setInterval(() => {
      this.cleanupIdleInstances();
    }, 60 * 1000);  // 每分钟检查
  }

  cleanupIdleInstances() {
    const now = Date.now();
    for (const [userId, timestamp] of this.lastAccess) {
      if (now - timestamp > this.idleTimeout) {
        console.log(`Cleaning up idle instance for user ${userId}`);
        this.stopInstance(userId);
      }
    }
  }

  async stopInstance(userId) {
    // 停止实例进程
    // 清理数据
    this.lastAccess.delete(userId);
  }
}
```

**start.sh**

```bash
#!/bin/bash
set -e

# 配置环境变量
export PORT=3000
export FEISHU_APP_ID="your_app_id"
export FEISHU_APP_SECRET="your_app_secret"
export FEISHU_ENCRYPT_KEY="your_encrypt_key"
export FEISHU_VERIFICATION_TOKEN="your_verification_token"

# 创建必要的目录
mkdir -p instances

# 启动代理
cd proxy && npm start
```

### 启动步骤

```bash
# 1. 安装依赖
cd ~/claw-multi-tenant/proxy && npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入飞书凭证

# 3. 启动服务
./start.sh
```

---

## 方案二：Docker 容器化（推荐）

适合：50+ 用户，需要更好隔离

### docker-compose.yml

```yaml
version: '3.8'

services:
  proxy:
    build: ./proxy
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - FEISHU_APP_ID=${FEISHU_APP_ID}
      - FEISHU_APP_SECRET=${FEISHU_APP_SECRET}
      - FEISHU_ENCRYPT_KEY=${FEISHU_ENCRYPT_KEY}
      - FEISHU_VERIFICATION_TOKEN=${FEISHU_VERIFICATION_TOKEN}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./instances:/instances
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

### Dockerfile.proxy

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

---

## 飞书配置

### 在飞书开发者后台

1. 创建企业内部应用
2. 添加机器人能力
3. 配置事件订阅：
   - 请求 URL: `https://your-domain.com/feishu/webhook`
4. 获取并配置凭证：
   - App ID
   - App Secret
   - Encrypt Key
   - Verification Token

---

## 验证测试

```bash
# 1. 检查代理服务
curl http://localhost:3000/health

# 2. 查看实例列表
curl http://localhost:3000/admin/instances

# 3. 在飞书中发送测试消息
# @机器人 发送 "hello"
# 应该收到回复
```

---

## 故障排查

### 实例无法启动

```bash
# 检查端口占用
lsof -i :18790

# 查看实例日志
tail -f instances/user-ou_xxxx/logs/gateway.log
```

### 消息无响应

```bash
# 检查代理日志
docker-compose logs -f proxy

# 检查实例健康
curl http://localhost:18790/health
```

---

## 成本估算

| 用户数 | CPU | 内存 | 存储 |
|--------|-----|------|------|
| 10 | 2核 | 4GB | 20GB |
| 50 | 4核 | 8GB | 50GB |
| 100 | 8核 | 16GB | 100GB |
