// 获取DOM元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');

// 获取当前域名（优先使用公网地址）
async function getBaseUrl() {
    try {
        const response = await fetch('/api/public-url');
        const data = await response.json();
        return data.url || window.location.origin;
    } catch (error) {
        return window.location.origin;
    }
}

// 点击上传区域触发文件选择
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// 处理文件拖拽
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    handleFiles(files);
});

// 处理文件选择
fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
});

// 处理文件上传
function handleFiles(files) {
    for (let file of files) {
        uploadFile(file);
    }
}

// 上传单个文件
async function uploadFile(file) {
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showError('只支持 JPG、PNG、GIF 和 WebP 格式的图片');
        return;
    }

    // 验证文件大小（最大 10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showError('文件大小不能超过 10MB');
        return;
    }

    // 创建上传进度显示
    const progressDiv = document.createElement('div');
    progressDiv.className = 'alert alert-info';
    progressDiv.innerHTML = `
        <div class="d-flex align-items-center">
            <strong>正在上传 ${file.name}...</strong>
            <div class="spinner-border ms-auto" role="status" aria-hidden="true"></div>
        </div>
    `;
    uploadStatus.insertBefore(progressDiv, uploadStatus.firstChild);

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`上传失败: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data || !data[0] || !data[0].src) {
            throw new Error('服务器响应格式错误');
        }

        // 获取基础URL（可能是公网地址）
        const baseUrl = await getBaseUrl();
        const fullUrl = baseUrl + data[0].src;

        // 显示上传成功和图片预览
        progressDiv.className = 'card mb-3';
        progressDiv.innerHTML = `
            <div class="card-body">
                <img src="${data[0].src}" alt="Uploaded Image" class="img-fluid mb-3" style="max-height: 300px;">
                <div class="input-group">
                    <input type="text" class="form-control" value="${fullUrl}" readonly>
                    <button class="btn btn-outline-primary copy-btn" type="button" data-url="${fullUrl}">
                        <i class="bi bi-clipboard"></i> 复制链接
                    </button>
                </div>
                <div class="copy-feedback mt-2 text-success" style="display: none;">
                    <i class="bi bi-check-circle"></i> 链接已复制到剪贴板
                </div>
            </div>
        `;

        // 添加复制按钮事件监听
        const copyBtn = progressDiv.querySelector('.copy-btn');
        const copyFeedback = progressDiv.querySelector('.copy-feedback');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(copyBtn.dataset.url);
                copyFeedback.style.display = 'block';
                copyBtn.disabled = true;
                copyBtn.innerHTML = '<i class="bi bi-check"></i> 已复制';
                setTimeout(() => {
                    copyFeedback.style.display = 'none';
                    copyBtn.disabled = false;
                    copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> 复制链接';
                }, 2000);
            } catch (err) {
                showError('复制失败，请手动复制');
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        progressDiv.className = 'alert alert-danger';
        progressDiv.textContent = error.message;
    }
}

// 显示错误信息
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    uploadStatus.insertBefore(errorDiv, uploadStatus.firstChild);
    
    // 自动关闭错误提示
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}
