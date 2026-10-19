import http from "node:http";

import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { Store } from "./db.ts";

const store = new Store(config.dataDir);
const server = http.createServer(createApp({ store, ...config }));

server.listen(config.port, config.host, () => {
    console.log(`KahoCord badges server listening on http://${config.host}:${config.port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
