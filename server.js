const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const net = require('net');
const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const sharp = require('sharp');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const FileType = require('file-type');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
require('dotenv').config();

const app = express();
let port = process.env.PORT || 3000;

// 获取公网访问地址
app.get('/api/public-url', (req, res) => {
    if (process.env.PUBLIC_URL) {
        res.json({ url: process.env.PUBLIC_URL });
    } else {
        const protocol = req.secure ? 'https' : 'http';
        const host = req.get('host');
        res.json({ url: `${protocol}://${host}` });
    }
});

// 会话配置
app.use(session({
    store: new FileStore({
        path: './sessions',
        ttl: 86400, // 1天
        reapInterval: 3600 // 1小时清理一次过期会话
    }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    }
}));

// 安全中间件
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// 压缩中间件
app.use(compression());

// 检查端口是否可用
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// 查找可用端口
async function findAvailablePort(startPort) {
  let currentPort = startPort;
  while (!(await isPortAvailable(currentPort))) {
    currentPort++;
  }
  return currentPort;
}

// 创建数据库
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({
    files: [],
    stats: { totalUploads: 0, totalAccess: 0 },
    settings: {
        watermarkEnabled: true,
        watermarkText: 'Protected Image',
        maxFileSize: 10 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        compressionQuality: 85
    }
}).write();

// 创建 Telegram Bot 实例
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// 配置限流
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});

// 应用限流
app.use('/api/', limiter);

// 启用 CORS
app.use(cors());

// 添加数据库和 bot 实例到请求对象
app.use((req, res, next) => {
    req.app.locals.db = db;
    req.app.locals.bot = bot;
    next();
});

// 路由
app.use('/api/admin', require('./routes/admin'));
app.use('/api/image', require('./routes/image'));

// 处理文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueId = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, uniqueId + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

// 处理文件上传
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }

        // 验证文件
        const settings = db.get('settings').value();
        const fileType = await FileType.fromFile(req.file.path);
        
        if (!fileType || !settings.allowedTypes.includes(fileType.mime)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).send('Invalid file type');
        }

        // 处理图片
        const processor = new (require('./utils/imageProcessor'))(settings);
        await processor.process(req.file.path, {
            watermark: settings.watermarkEnabled,
            quality: settings.compressionQuality
        });

        console.log('Sending photo to Telegram...');

        // 读取处理后的文件
        const fileStream = fs.createReadStream(req.file.path);

        // 发送图片到 Telegram 频道
        const msg = await bot.sendPhoto(process.env.TELEGRAM_CHANNEL_ID, fileStream, {
            caption: '🔒 Protected Upload',
            protect_content: true
        });

        // 删除临时文件
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });

        // 获取图片的文件 ID
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        
        // 获取文件信息
        const fileInfo = await bot.getFile(fileId);
        
        // 生成唯一的访问ID
        const uniqueId = crypto.randomBytes(16).toString('hex');
        
        // 存储文件信息到数据库
        const newFile = {
            id: uniqueId,
            fileId: fileId,
            filePath: fileInfo.file_path,
            uploadTime: new Date().toISOString(),
            accessCount: 0,
            lastAccess: null,
            originalName: req.file.originalname,
            mimeType: fileType.mime,
            size: fileInfo.file_size,
            messageId: msg.message_id
        };

        db.get('files')
            .push(newFile)
            .write();

        // 更新统计信息
        db.update('stats.totalUploads', n => n + 1)
            .write();

        // 返回代理URL
        res.json([{
            src: `/image/${uniqueId}`
        }]);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).send(error.message);
    }
});

// 处理图片请求
app.get('/image/:id', async (req, res) => {
    try {
        // 从数据库获取文件信息
        const fileInfo = db.get('files')
            .find({ id: req.params.id })
            .value();

        if (!fileInfo) {
            return res.status(404).send('Image not found');
        }

        // 更新访问信息
        db.get('files')
            .find({ id: req.params.id })
            .assign({
                accessCount: fileInfo.accessCount + 1,
                lastAccess: new Date().toISOString()
            })
            .write();

        // 更新总访问统计
        db.update('stats.totalAccess', n => n + 1)
            .write();

        // 获取 Telegram 文件
        const response = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.filePath}`);
        if (!response.ok) {
            throw new Error('Failed to fetch image');
        }

        // 设置缓存控制和安全头
        res.set({
            'Cache-Control': 'private, max-age=3600',
            'Content-Type': response.headers.get('content-type'),
            'Content-Security-Policy': "default-src 'self'",
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block'
        });

        // 流式传输响应
        response.body.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Error fetching image');
    }
});

// 清理过期的文件（每天运行一次）
setInterval(async () => {
    const now = new Date();
    const expireTime = 7 * 24 * 60 * 60 * 1000; // 7天

    // 获取过期的文件
    const expiredFiles = db.get('files')
        .filter(file => {
            const fileDate = new Date(file.uploadTime);
            return now - fileDate > expireTime && file.accessCount === 0;
        })
        .value();

    // 删除过期的文件
    for (const file of expiredFiles) {
        try {
            // 从 Telegram 删除文件
            await bot.deleteMessage(process.env.TELEGRAM_CHANNEL_ID, file.messageId);
        } catch (error) {
            console.error(`Failed to delete message ${file.messageId}:`, error);
        }

        // 从数据库删除
        db.get('files')
            .remove({ id: file.id })
            .write();
    }

    console.log(`Cleaned up ${expiredFiles.length} expired files`);
}, 24 * 60 * 60 * 1000);

// 提供静态文件
app.use(express.static('.'));

// 处理所有其他请求，返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 创建必要的目录
['uploads', 'temp', 'data'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// 启动服务器
async function startServer() {
    try {
        // 检查环境变量
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            throw new Error('TELEGRAM_BOT_TOKEN is not set in .env file');
        }
        if (!process.env.TELEGRAM_CHANNEL_ID) {
            throw new Error('TELEGRAM_CHANNEL_ID is not set in .env file');
        }

        // 查找可用端口
        port = await findAvailablePort(port);
        
        // 启动 HTTP 服务器
        app.listen(port, () => {
            console.log(`\n本地服务器运行于: http://localhost:${port}`);
            if (process.env.PUBLIC_URL) {
                console.log(`\n公网访问地址: ${process.env.PUBLIC_URL}`);
            }
            
            // 显示统计信息
            const stats = db.get('stats').value();
            console.log('\n服务器统计:');
            console.log(`总上传数: ${stats.totalUploads}`);
            console.log(`总访问数: ${stats.totalAccess}`);
        });

    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('正在关闭服务器...');
    process.exit(0);
});

startServer(); 