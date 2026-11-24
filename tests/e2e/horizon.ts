import { createServer } from 'node:http';

const port = Number(process.env.PORT || 4174);
const server = createServer((request, response) => {
  const path = new URL(request.url || '/', 'http://localhost').pathname;
  response.setHeader('Access-Control-Allow-Origin', '*');

  if (path === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    return;
  }

  if (path.endsWith('/operations')) {
    response
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end('{"_embedded":{"records":[]}}');
    return;
  }
  if (path.includes('/transactions/')) {
    response.writeHead(404, { 'Content-Type': 'application/json' }).end('{}');
    return;
  }

  response
    .writeHead(200, { 'Content-Type': 'application/json' })
    .end(
      JSON.stringify(
        path.endsWith('/accounts')
          ? { _embedded: { records: [] } }
          : { balances: [{ asset_type: 'native', balance: '0.0000000' }] },
      ),
    );
});

server.listen(port, '127.0.0.1');
