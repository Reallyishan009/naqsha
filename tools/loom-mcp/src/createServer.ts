import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDiffDesigns } from './tools/diffDesigns.ts';
import { registerExportBmp } from './tools/exportBmp.ts';
import { registerReadCardPhoto } from './tools/readCardPhoto.ts';
import { registerRenderCloth } from './tools/renderCloth.ts';
import { registerValidateProfile } from './tools/validateProfile.ts';
/** The server with its five tools. It has no transport yet; server.ts connects stdio. */
export function createServer(): McpServer {
  const server = new McpServer({ name: 'loom-mcp', version: '0.1.0' });
  registerValidateProfile(server);
  registerReadCardPhoto(server);
  registerRenderCloth(server);
  registerDiffDesigns(server);
  registerExportBmp(server);
  return server;
}
