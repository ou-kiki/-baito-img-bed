const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const basicAuth = require('express-basic-auth');

// 基本认证中间件
const auth = basicAuth({
    users: { 'admin': process.env.ADMIN_PASSWORD || 'admin' },
    challenge: true,
    realm: 'ImgBed Admin'
});

// 获取统计信息
router.get('/stats', auth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const stats = db.get('stats').value();
        const totalFiles = db.get('files').size().value();
        const settings = db.get('settings').value();

        res.json({
            totalUploads: stats.totalUploads,
            totalAccess: stats.totalAccess,
            totalFiles: totalFiles,
            settings: settings
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 更新设置
router.post('/settings', auth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const { watermarkEnabled, watermarkText, maxFileSize, allowedTypes, compressionQuality } = req.body;

        db.get('settings')
            .assign({
                watermarkEnabled: watermarkEnabled !== undefined ? watermarkEnabled : db.get('settings.watermarkEnabled').value(),
                watermarkText: watermarkText || db.get('settings.watermarkText').value(),
                maxFileSize: maxFileSize || db.get('settings.maxFileSize').value(),
                allowedTypes: allowedTypes || db.get('settings.allowedTypes').value(),
                compressionQuality: compressionQuality || db.get('settings.compressionQuality').value()
            })
            .write();

        res.json({ success: true, settings: db.get('settings').value() });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 获取文件列表
router.get('/files', auth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sortBy = req.query.sortBy || 'uploadTime';
        const order = req.query.order || 'desc';

        let files = db.get('files')
            .orderBy(sortBy, order)
            .value();

        const total = files.length;
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const end = start + limit;

        files = files.slice(start, end);

        res.json({
            files,
            pagination: {
                total,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error('Error getting files:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 删除文件
router.delete('/files/:id', auth, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const bot = req.app.locals.bot;
        const fileInfo = db.get('files')
            .find({ id: req.params.id })
            .value();

        if (!fileInfo) {
            return res.status(404).send('File not found');
        }

        // 从 Telegram 删除消息
        try {
            await bot.deleteMessage(process.env.TELEGRAM_CHANNEL_ID, fileInfo.messageId);
        } catch (error) {
            console.error('Error deleting message from Telegram:', error);
        }

        // 从数据库删除
        db.get('files')
            .remove({ id: req.params.id })
            .write();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 批量删除文件
router.post('/files/batch-delete', auth, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const bot = req.app.locals.bot;
        const { ids } = req.body;

        if (!Array.isArray(ids)) {
            return res.status(400).send('Invalid request body');
        }

        const results = [];
        for (const id of ids) {
            const fileInfo = db.get('files')
                .find({ id })
                .value();

            if (fileInfo) {
                try {
                    await bot.deleteMessage(process.env.TELEGRAM_CHANNEL_ID, fileInfo.messageId);
                    db.get('files')
                        .remove({ id })
                        .write();
                    results.push({ id, success: true });
                } catch (error) {
                    console.error(`Error deleting file ${id}:`, error);
                    results.push({ id, success: false, error: error.message });
                }
            } else {
                results.push({ id, success: false, error: 'File not found' });
            }
        }

        res.json({ results });
    } catch (error) {
        console.error('Error in batch delete:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 搜索文件
router.get('/files/search', auth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const { query } = req.query;

        if (!query) {
            return res.status(400).send('Search query is required');
        }

        const files = db.get('files')
            .filter(file => {
                const searchStr = query.toLowerCase();
                return file.originalName.toLowerCase().includes(searchStr) ||
                       file.id.toLowerCase().includes(searchStr);
            })
            .value();

        res.json({ files });
    } catch (error) {
        console.error('Error searching files:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 获取系统信息
router.get('/system', auth, (req, res) => {
    try {
        const os = require('os');
        const systemInfo = {
            platform: os.platform(),
            arch: os.arch(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            cpus: os.cpus(),
            loadAvg: os.loadavg()
        };

        res.json(systemInfo);
    } catch (error) {
        console.error('Error getting system info:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 备份数据库
router.get('/backup', auth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const backupData = {
            timestamp: new Date().toISOString(),
            data: db.getState()
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=imgbed-backup-${backupData.timestamp}.json`);
        res.json(backupData);
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 恢复数据库
router.post('/restore', auth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const { data } = req.body;

        if (!data || !data.files || !data.stats || !data.settings) {
            return res.status(400).send('Invalid backup data');
        }

        db.setState(data).write();
        res.json({ success: true });
    } catch (error) {
        console.error('Error restoring backup:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router; 