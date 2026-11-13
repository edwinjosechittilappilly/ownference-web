#!/usr/bin/env node
import { createServer } from '../server.js';

const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number.');
createServer().listen(port, '127.0.0.1', () => console.log(`Ownference Web: http://localhost:${port}`));
