import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

app.prepare().then(() => {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const parsedUrl = parse(req.url!, true);

      // Runtime API proxy — forwards /api/* to the backend
      if (parsedUrl.pathname?.startsWith('/api/')) {
        const backendUrl = `${BACKEND_URL}${parsedUrl.pathname}${parsedUrl.search || ''}`;

        // Build headers (drop hop-by-hop)
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (k === 'host' || k === 'connection' || k === 'transfer-encoding') continue;
          if (typeof v === 'string') headers[k] = v;
          else if (Array.isArray(v)) headers[k] = v.join(', ');
        }

        const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
        const body = hasBody ? await readBody(req) : undefined;

        const backendRes = await fetch(backendUrl, {
          method: req.method,
          headers,
          body: body ? new Uint8Array(body) : undefined,
        });

        res.statusCode = backendRes.status;
        backendRes.headers.forEach((v, k) => {
          if (k !== 'transfer-encoding' && k !== 'content-encoding') res.setHeader(k, v);
        });
        const buf = Buffer.from(await backendRes.arrayBuffer());
        res.end(buf);
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  server.once('error', err => {
    console.error(err);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV
      } (proxy -> ${BACKEND_URL})`,
    );
  });
});
