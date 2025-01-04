const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// 缓存控制中间件
const cacheControl = (req, res, next) => {
    res.set({
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Timing-Allow-Origin': '*'
    });
    next();
};

// 处理 OPTIONS 请求
router.options('/:id', (req, res) => {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        'Cross-Origin-Resource-Policy': 'cross-origin'
    }).status(204).end();
});

// 图片处理中间件
const processImage = async (req, res, next) => {
    try {
        const { width, height, quality, format, blur, grayscale } = req.query;
        const imageProcessor = new (require('../utils/imageProcessor'))(req.app.locals.db.get('settings').value());

        // 如果没有处理参数，直接进入下一个中间件
        if (!width && !height && !quality && !format && !blur && !grayscale) {
            return next();
        }

        // 获取原始图片
        const response = await fetch(req.imageUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch original image');
        }

        const buffer = await response.buffer();
        let image = sharp(buffer);

        // 调整大小
        if (width || height) {
            image = image.resize(
                width ? parseInt(width) : null,
                height ? parseInt(height) : null,
                { fit: 'inside', withoutEnlargement: true }
            );
        }

        // 应用效果
        if (grayscale === 'true') {
            image = image.grayscale();
        }
        if (blur && !isNaN(blur)) {
            image = image.blur(parseFloat(blur));
        }

        // 转换格式
        if (format) {
            switch (format.toLowerCase()) {
                case 'jpeg':
                case 'jpg':
                    image = image.jpeg({ quality: parseInt(quality) || 80 });
                    break;
                case 'png':
                    image = image.png({ quality: parseInt(quality) || 80 });
                    break;
                case 'webp':
                    image = image.webp({ quality: parseInt(quality) || 80 });
                    break;
                case 'avif':
                    image = image.avif({ quality: parseInt(quality) || 80 });
                    break;
                default:
                    throw new Error('Unsupported format');
            }
        }

        // 处理图片
        const processedBuffer = await image.toBuffer();

        // 设置响应头
        res.set('Content-Type', `image/${format || 'jpeg'}`);
        res.set('Content-Length', processedBuffer.length);

        // 发送处理后的图片
        res.send(processedBuffer);
    } catch (error) {
        console.error('Image processing error:', error);
        next(error);
    }
};

// 获取图片
router.get('/:id', async (req, res, next) => {
    try {
        const db = req.app.locals.db;
        const bot = req.app.locals.bot;

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

        // 获取文件URL
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.filePath}`;
        req.imageUrl = fileUrl;

        // 进入图片处理中间件
        next();
    } catch (error) {
        console.error('Error getting image:', error);
        res.status(500).send('Internal Server Error');
    }
}, processImage, cacheControl, async (req, res) => {
    try {
        // 如果没有进行图片处理，直接代理原始图片
        const response = await fetch(req.imageUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch image');
        }

        // 设置响应头
        res.set('Content-Type', response.headers.get('content-type'));
        res.set('Content-Length', response.headers.get('content-length'));

        // 流式传输响应
        response.body.pipe(res);
    } catch (error) {
        console.error('Error proxying image:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 获取图片信息
router.get('/:id/info', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const fileInfo = db.get('files')
            .find({ id: req.params.id })
            .value();

        if (!fileInfo) {
            return res.status(404).send('Image not found');
        }

        // 获取图片元数据
        const response = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.filePath}`);
        if (!response.ok) {
            throw new Error('Failed to fetch image');
        }

        const buffer = await response.buffer();
        const metadata = await sharp(buffer).metadata();

        res.json({
            id: fileInfo.id,
            originalName: fileInfo.originalName,
            mimeType: fileInfo.mimeType,
            size: fileInfo.size,
            uploadTime: fileInfo.uploadTime,
            accessCount: fileInfo.accessCount,
            lastAccess: fileInfo.lastAccess,
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            space: metadata.space,
            channels: metadata.channels,
            depth: metadata.depth,
            density: metadata.density,
            hasAlpha: metadata.hasAlpha,
            isAnimated: metadata.pages > 1
        });
    } catch (error) {
        console.error('Error getting image info:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 下载原始图片
router.get('/:id/download', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const fileInfo = db.get('files')
            .find({ id: req.params.id })
            .value();

        if (!fileInfo) {
            return res.status(404).send('Image not found');
        }

        // 获取文件
        const response = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.filePath}`);
        if (!response.ok) {
            throw new Error('Failed to fetch image');
        }

        // 设置响应头
        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename="${fileInfo.originalName}"`);
        res.set('Content-Length', response.headers.get('content-length'));

        // 流式传输响应
        response.body.pipe(res);
    } catch (error) {
        console.error('Error downloading image:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router; 