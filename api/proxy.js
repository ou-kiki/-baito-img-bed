// 该服务为 vercel serve跨域处理
const {
  createProxyMiddleware
} = require('http-proxy-middleware')

module.exports = (req, res) => {
  console.log('收到请求:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });

  const proxy = createProxyMiddleware({
    target: 'https://telegra.ph',
    changeOrigin: true,
    pathRewrite: {
      '^/api': '', // 移除 /api 前缀，注意这里不带末尾的斜杠
    },
    onError: (err, req, res) => {
      console.error('代理请求错误:', err);
      res.writeHead(500, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Content-Length',
      });
      res.end('代理请求失败: ' + err.message);
    },
    onProxyReq: (proxyReq, req, res) => {
      // 打印代理请求信息
      console.log('代理请求:', {
        method: proxyReq.method,
        path: proxyReq.path,
        headers: proxyReq.getHeaders(),
      });

      // 确保 Content-Length 头正确设置
      if (req.headers['content-length']) {
        proxyReq.setHeader('Content-Length', req.headers['content-length']);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      // 添加CORS头
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Content-Length';
      
      // 打印响应信息用于调试
      console.log('目标服务器响应:', {
        statusCode: proxyRes.statusCode,
        headers: proxyRes.headers,
      });

      // 如果是错误响应，记录更多信息
      if (proxyRes.statusCode >= 400) {
        let body = '';
        proxyRes.on('data', chunk => {
          body += chunk.toString();
        });
        proxyRes.on('end', () => {
          console.error('目标服务器错误响应:', {
            statusCode: proxyRes.statusCode,
            body: body
          });
        });
      }
    },
    logLevel: 'debug' // 添加详细日志输出
  });

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Content-Length',
    });
    res.end();
    return;
  }

  return proxy(req, res);
}
