import http from "node:http";
import { executeNodeLaunch, validateOrigin } from "../src/lib/launcher/execute-node.ts";
import { validateLauncherBody } from "../src/lib/launcher/validation.ts";

const host = "127.0.0.1";
const port = 47135;
const maxBytes = 8192;

const server = http.createServer((request, response) => {
  const origin = request.headers.origin ?? null;
  if (!validateOrigin(origin)) {
    response.writeHead(403, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "origin-rejected" }));
    return;
  }
  const cors = { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type" };
  if (request.method === "OPTIONS") {
    response.writeHead(204, cors);
    response.end();
    return;
  }
  if (request.method !== "POST" || request.url !== "/launch") {
    response.writeHead(404, { ...cors, "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "not-found" }));
    return;
  }
  let bytes = 0;
  const chunks = [];
  request.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes > maxBytes) request.destroy();
    else chunks.push(chunk);
  });
  request.on("end", async () => {
    if (bytes > maxBytes) return;
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch {
      response.writeHead(400, { ...cors, "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: "invalid-json" }));
      return;
    }
    const parsed = validateLauncherBody(body);
    if (!parsed.success) {
      response.writeHead(400, { ...cors, "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: "invalid-action" }));
      return;
    }
    const result = await executeNodeLaunch(parsed.data);
    response.writeHead(result.ok ? 200 : 422, { ...cors, "content-type": "application/json" });
    response.end(JSON.stringify(result));
  });
});

server.listen(port, host, () => {
  console.log(`Zynthel 本地启动器：http://${host}:${port}`);
});
