# 在树莓派上部署 ImgBed 图床服务

本指南将详细介绍如何在树莓派上部署 ImgBed 图床服务，包括环境配置、安装步骤和常见问题解决方案。

## 前置条件

- 树莓派（任何型号，推荐 Raspberry Pi 3B+ 或更高版本）
- 稳定的网络连接
- 基本的 Linux 命令行知识

## 1. 环境准备

### 1.1 安装必要的系统包

```bash
# 更新系统包列表
sudo apt update

# 安装必要的依赖
sudo apt install -y curl git
```

### 1.2 安装 Node.js

```bash
# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# 安装 Node.js 和 npm
sudo apt install -y nodejs

# 验证安装
node --version
npm --version
```

## 2. 项目部署

### 2.1 克隆项目

```bash
# 克隆项目仓库
cd ~
git clone https://github.com/your-username/imgbed.git
cd imgbed

# 安装项目依赖
npm install
```

### 2.2 配置环境变量

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑环境变量文件：
```bash
nano .env
```

配置示例（请替换为您自己的值）：
```env
# Telegram 配置
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=your_channel_id

# 服务器配置
PORT=3000
NODE_ENV=development

# 安全配置
SESSION_SECRET=your_session_secret
ADMIN_PASSWORD=your_admin_password

# 图片处理配置
MAX_FILE_SIZE=10485760  # 10MB
COMPRESSION_QUALITY=85
WATERMARK_ENABLED=true
WATERMARK_TEXT=Protected Image

# 清理配置
FILE_EXPIRE_DAYS=7
CLEANUP_INTERVAL=86400000  # 24小时 

# 公网访问地址
PUBLIC_URL=https://your-domain.com
```

### 2.3 创建必要的目录

```bash
mkdir -p uploads temp data sessions
```

### 2.4 安装和配置 PM2

```bash
# 安装 PM2
sudo npm install -g pm2

# 使用 PM2 启动服务
pm2 start server.js --name imgbed

# 设置开机自启
pm2 startup
pm2 save
```

## 3. 配置公网访问

### 3.1 安装 Cloudflared

```bash
# 下载 Cloudflared
wget -O cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-armhf

# 使文件可执行
chmod +x cloudflared

# 移动到系统目录
sudo mv cloudflared /usr/local/bin/
```

### 3.2 配置 Cloudflared

1. 登录到 Cloudflare：
```bash
cloudflared tunnel login
```

2. 创建隧道：
```bash
cloudflared tunnel create imgbed
```

3. 配置隧道：
```bash
mkdir -p ~/.cloudflared
```

编辑配置文件 `~/.cloudflared/config.yml`：
```yaml
tunnel: your_tunnel_id
credentials-file: /home/pi/.cloudflared/your_tunnel_id.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3000
  - service: http_status:404
```

4. 安装为系统服务：
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

## 4. 验证部署

1. 检查服务状态：
```bash
pm2 status
pm2 logs imgbed
```

2. 检查 Cloudflared 状态：
```bash
sudo systemctl status cloudflared
```

3. 访问您的域名测试服务是否正常运行

## 5. 常见问题

### 5.1 端口被占用

问题：启动服务时提示端口已被占用
解决方案：
```bash
# 查找占用端口的进程
sudo lsof -i :3000

# 终止进程
sudo kill -9 <PID>
```

### 5.2 权限问题

问题：创建目录或写入文件时遇到权限错误
解决方案：
```bash
# 确保目录权限正确
sudo chown -R pi:pi ~/imgbed
chmod -R 755 ~/imgbed
```

### 5.3 内存不足

问题：服务运行一段时间后自动停止
解决方案：
1. 增加交换空间
2. 在 PM2 中限制内存使用：
```bash
pm2 start server.js --name imgbed --max-memory-restart 512M
```

## 6. 维护建议

1. 定期备份数据：
```bash
# 备份数据库
cp db.json db.json.backup
```

2. 监控日志：
```bash
pm2 logs imgbed
```

3. 更新代码：
```bash
git pull
npm install
pm2 restart imgbed
```

## 7. 安全建议

1. 定期更新系统：
```bash
sudo apt update
sudo apt upgrade
```

2. 使用强密码
3. 定期检查日志文件
4. 配置防火墙
5. 保持环境变量文件的安全

## 结论

通过本指南，您应该已经成功在树莓派上部署了 ImgBed 图床服务。如果遇到任何问题，请查看上述常见问题解决方案或提交 Issue。 