const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class ImageProcessor {
    constructor(settings) {
        this.settings = settings;
    }

    async process(filePath, options = {}) {
        try {
            const image = sharp(filePath);
            const metadata = await image.metadata();
            let processedImage = image;

            // 调整大小（如果需要）
            if (metadata.width > 2000 || metadata.height > 2000) {
                processedImage = processedImage.resize(2000, 2000, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            // 添加水印（如果启用）
            if (options.watermark && this.settings.watermarkEnabled) {
                const watermarkSvg = Buffer.from(`
                    <svg width="${metadata.width}" height="40">
                        <text 
                            x="50%" 
                            y="25" 
                            font-family="Arial" 
                            font-size="24" 
                            fill="rgba(255,255,255,0.5)" 
                            text-anchor="middle"
                        >
                            ${this.settings.watermarkText}
                        </text>
                    </svg>
                `);

                processedImage = processedImage.composite([{
                    input: watermarkSvg,
                    gravity: 'southeast'
                }]);
            }

            // 设置压缩质量
            if (options.quality) {
                processedImage = processedImage.jpeg({
                    quality: options.quality,
                    progressive: true
                });
            }

            // 创建临时文件路径
            const tempPath = path.join(
                path.dirname(filePath),
                `processed_${path.basename(filePath)}`
            );

            // 保存处理后的图片
            await processedImage.toFile(tempPath);

            // 替换原文件
            fs.unlinkSync(filePath);
            fs.renameSync(tempPath, filePath);

            return filePath;
        } catch (error) {
            console.error('Image processing error:', error);
            throw new Error('Failed to process image');
        }
    }

    async getMetadata(filePath) {
        try {
            const metadata = await sharp(filePath).metadata();
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: metadata.size,
                hasAlpha: metadata.hasAlpha,
                isAnimated: metadata.pages > 1
            };
        } catch (error) {
            console.error('Metadata extraction error:', error);
            throw new Error('Failed to get image metadata');
        }
    }

    async optimize(filePath, options = {}) {
        try {
            const metadata = await this.getMetadata(filePath);
            const image = sharp(filePath);

            // 根据图片大小调整压缩设置
            let quality = options.quality || this.settings.compressionQuality;
            if (metadata.size > 5 * 1024 * 1024) { // 5MB
                quality = Math.min(quality, 75);
            }

            // 根据图片格式选择最佳压缩方法
            switch (metadata.format.toLowerCase()) {
                case 'jpeg':
                case 'jpg':
                    await image
                        .jpeg({ quality, progressive: true })
                        .toFile(filePath + '.optimized');
                    break;
                case 'png':
                    await image
                        .png({ quality, progressive: true })
                        .toFile(filePath + '.optimized');
                    break;
                case 'webp':
                    await image
                        .webp({ quality })
                        .toFile(filePath + '.optimized');
                    break;
                case 'gif':
                    if (!metadata.isAnimated) {
                        await image
                            .gif({ quality })
                            .toFile(filePath + '.optimized');
                    } else {
                        // 对于动态GIF，保持原样
                        return filePath;
                    }
                    break;
                default:
                    throw new Error('Unsupported image format');
            }

            // 替换原文件
            fs.unlinkSync(filePath);
            fs.renameSync(filePath + '.optimized', filePath);

            return filePath;
        } catch (error) {
            console.error('Image optimization error:', error);
            throw new Error('Failed to optimize image');
        }
    }

    async convert(filePath, format, options = {}) {
        try {
            const outputPath = path.join(
                path.dirname(filePath),
                `${path.basename(filePath, path.extname(filePath))}.${format}`
            );

            const image = sharp(filePath);
            const quality = options.quality || this.settings.compressionQuality;

            switch (format.toLowerCase()) {
                case 'jpeg':
                case 'jpg':
                    await image
                        .jpeg({ quality, progressive: true })
                        .toFile(outputPath);
                    break;
                case 'png':
                    await image
                        .png({ quality, progressive: true })
                        .toFile(outputPath);
                    break;
                case 'webp':
                    await image
                        .webp({ quality })
                        .toFile(outputPath);
                    break;
                case 'gif':
                    await image
                        .gif({ quality })
                        .toFile(outputPath);
                    break;
                default:
                    throw new Error('Unsupported output format');
            }

            return outputPath;
        } catch (error) {
            console.error('Format conversion error:', error);
            throw new Error('Failed to convert image format');
        }
    }
}

module.exports = ImageProcessor; 