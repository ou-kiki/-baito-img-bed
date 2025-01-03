# ImgBed - 安全的图片托管服务

ImgBed 是一个基于 Telegram 作为存储后端的安全图片托管服务。它提供了简单的图片上传、处理和管理功能，同时确保了图片的安全性和隐私性。

## 特性

- 使用 Telegram 作为存储后端，无需额外的存储服务
- 支持多种图片格式（JPEG、PNG、GIF、WebP）
- 图片处理功能（调整大小、压缩、水印等）
- 安全的访问控制和文件管理
- 支持图片元数据查看
- 提供 RESTful API
- 支持批量上传和管理
- 自动清理未使用的文件

## 安装

1. 克隆仓库：
```bash
git clone https://github.com/yourusername/imgbed.git
cd imgbed
```

2. 安装依赖：
```bash
npm install
```

3. 创建 `.env` 文件并设置以下环境变量：
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=your_channel_id
ADMIN_PASSWORD=your_admin_password
REDIS_URL=your_redis_url
SESSION_SECRET=your_session_secret
```

4. 启动服务：
```bash
npm start
```

## 配置

### Telegram Bot 设置

1. 在 Telegram 中找到 [@BotFather](https://t.me/botfather)
2. 创建一个新的 bot，获取 bot token
3. 创建一个频道用于存储图片
4. 将 bot 添加为频道管理员
5. 获取频道 ID

### 环境变量

- `TELEGRAM_BOT_TOKEN`: Telegram Bot API 令牌
- `TELEGRAM_CHANNEL_ID`: Telegram 存储频道 ID
- `ADMIN_PASSWORD`: 管理面板密码
- `REDIS_URL`: Redis 服务器 URL（用于会话存储）
- `SESSION_SECRET`: 会话加密密钥
- `PORT`: 服务器端口（默认：3000）
- `NODE_ENV`: 运行环境（development/production）

## 使用方法

### 上传图片

1. 访问首页
2. 选择或拖拽图片到上传区域
3. 等待上传完成
4. 获取图片链接

### 图片处理

在图片 URL 后添加参数来处理图片：

- 调整大小：`/image/{id}?width=800&height=600`
- 压缩质量：`/image/{id}?quality=80`
- 转换格式：`/image/{id}?format=webp`
- 添加效果：`/image/{id}?grayscale=true&blur=3`

### API 端点

#### 图片操作

- `POST /api/upload` - 上传图片
- `GET /image/:id` - 获取图片
- `GET /image/:id/info` - 获取图片信息
- `GET /image/:id/download` - 下载原始图片

#### 管理接口

- `GET /api/admin/stats` - 获取统计信息
- `GET /api/admin/files` - 获取文件列表
- `POST /api/admin/settings` - 更新设置
- `DELETE /api/admin/files/:id` - 删除文件
- `POST /api/admin/files/batch-delete` - 批量删除文件
- `GET /api/admin/backup` - 备份数据
- `POST /api/admin/restore` - 恢复数据

## 安全性

- 所有上传的图片都存储在私密的 Telegram 频道中
- 支持图片水印保护
- 管理接口需要认证
- 使用 Redis 存储会话
- 实现了速率限制
- 所有请求都经过安全头处理

## 性能优化

- 图片处理使用 Sharp 库
- 支持响应压缩
- 实现了缓存控制
- 使用流式传输处理大文件
- Redis 用于会话存储和缓存

## 贡献

欢迎提交 Pull Requests 和 Issues！

## 许可证

MIT License

