import http from 'http';

const PORT = process.env.PORT || 5005;

http.createServer((req, res) => {
    if (req.url === '/verify') {
        const isAuthorized = req.headers['authorization'] === 'Bearer token';
        res.writeHead(isAuthorized ? 200 : 401);
        res.end();
    } else if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hello');
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
}).listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});