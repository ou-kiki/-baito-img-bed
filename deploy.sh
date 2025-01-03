#!/bin/bash

# 更新代码
git pull

# 安装依赖
npm install

# 复制配置文件（如果不存在）
if [ ! -f .env ]; then
    cp .env.example .env
    echo "请编辑 .env 文件并填入正确的配置信息"
    exit 1
fi

# 创建必要的目录
mkdir -p uploads temp data sessions

# 安装 PM2（如果需要）
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 重启服务
pm2 restart imgbed || pm2 start server.js --name imgbed

echo "部署完成！"