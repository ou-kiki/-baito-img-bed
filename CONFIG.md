# 配置说明

本项目使用 .env 文件进行配置。请复制 .env.example 文件并重命名为 .env，然后根据实际情况修改配置项。

## 必需的配置项

1. Telegram 配置
   - TELEGRAM_BOT_TOKEN: 从 @BotFather 获取的机器人令牌
   - TELEGRAM_CHANNEL_ID: Telegram 频道 ID

2. 公网访问配置
   - PUBLIC_URL: 您的域名，例如 https://your-domain.com

## 可选配置项

1. 服务器配置
   - PORT: 服务器端口，默认 3000
   - NODE_ENV: 运行环境，development 或 production

2. 安全配置
   - SESSION_SECRET: 会话密钥，建议使用随机字符串
   - ADMIN_PASSWORD: 管理员密码

3. 图片处理配置
   - MAX_FILE_SIZE: 最大文件大小（字节）
   - COMPRESSION_QUALITY: 压缩质量（0-100）
   - WATERMARK_ENABLED: 是否启用水印
   - WATERMARK_TEXT: 水印文字

4. 清理配置
   - FILE_EXPIRE_DAYS: 文件过期天数
   - CLEANUP_INTERVAL: 清理间隔（毫秒）

## 配置步骤

1. 复制示例配置文件：
   \`\`\`bash
   cp .env.example .env
   \`\`\`

2. 编辑配置文件：
   \`\`\`bash
   nano .env
   \`\`\`

3. 填入实际的配置值

## 注意事项

- 不要将 .env 文件提交到版本控制系统
- 妥善保管敏感信息
- 定期更新密钥和密码