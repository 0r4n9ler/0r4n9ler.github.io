const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 1234;
const ROOT = __dirname;

const MIMES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.md': 'text/markdown'
};

const server = http.createServer((req, res) => {
    // Parsing URL
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // === API: Save Events ===
    if (pathname === '/api/save-events' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // Basic validation
                if (!data || !Array.isArray(data.events)) {
                    throw new Error("Invalid format: expected { events: [] }");
                }
                const filePath = path.join(ROOT, 'assets', 'events.json');
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
                console.log(`[OK] Saved events.json (${data.events.length} items)`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Events saved to disk' }));
            } catch (err) {
                console.error("[ERR] Save events failed:", err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: err.message }));
            }
        });
        return;
    }

    // === API: Save Posts ===
    if (pathname === '/api/save-posts' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // Basic validation
                if (!data || !Array.isArray(data.posts)) {
                    throw new Error("Invalid format: expected { posts: [] }");
                }
                const filePath = path.join(ROOT, 'assets', 'posts.json');
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
                console.log(`[OK] Saved posts.json (${data.posts.length} items)`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Posts saved to disk' }));
            } catch (err) {
                console.error("[ERR] Save posts failed:", err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: err.message }));
            }
        });
        return;
    }

    // === Static File Serving ===
    // Default to index.html
    if (pathname === '/') pathname = '/index.html';
    
    // Security: Prevent directory traversal
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(ROOT, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIMES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

console.log(`\n=== 博客本地管理服务器 ===`);
console.log(`地址: http://localhost:${PORT}`);
console.log(`功能: 支持直接将修改保存到硬盘`);
console.log(`使用: 按 Ctrl+C 停止服务\n`);

server.listen(PORT);