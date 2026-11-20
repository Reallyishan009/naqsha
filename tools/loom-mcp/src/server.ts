import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import './hooks.ts';
// The hook must be in place before the reader is loaded, so the server is built with a dynamic import.
const { createServer } = await import('./createServer.ts');
const server = createServer();
await server.connect(new StdioServerTransport());
// stdout carries the protocol; anything for a person goes to stderr.
console.error('loom-mcp is ready: validate_profile, read_card_photo, render_cloth, diff_designs, export_bmp');
