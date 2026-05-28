import { createServer } from "node:http";
import next from "next";
import { attachSocketServer } from "@/server/socket/socketServer";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  attachSocketServer(httpServer);

  httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`> ready on http://${hostname}:${port}`);
  });
});
