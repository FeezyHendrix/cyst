import http from 'http';
const PORT = process.env.PORT || 5002;

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ products: ['Apple', 'Banana', 'Carrot'] }));
}).listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

