import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolveTableauMcpConfig } from './tableauConfig';

type JsonRecord = Record<string, unknown>;

let clientPromise: Promise<Client> | null = null;
let requestQueue: Promise<unknown> = Promise.resolve();

export function isTableauAuthenticationError(error: unknown) {
  return error instanceof Error && error.message.includes('Tableau MCP authentication failed (401)');
}

function extractPlainTextError(rawText: string) {
  const trimmed = rawText.trim();
  const requestIdMatch = trimmed.match(/requestId:\s*([^,\n]+)/i);
  const errorMatch = trimmed.match(/error:\s*([^\n]+)/i);

  if (!errorMatch) {
    return null;
  }

  const requestId = requestIdMatch?.[1]?.trim();
  const errorMessage = errorMatch[1].trim();

  if (errorMessage.includes('status code 401')) {
    return `Tableau MCP authentication failed (401)${requestId ? ` [requestId: ${requestId}]` : ''}. Check TABLEAU_PAT_NAME, TABLEAU_PAT_VALUE, TABLEAU_SERVER, and TABLEAU_SITE_NAME in your Codex/Tableau MCP config.`;
  }

  return `Tableau MCP request failed${requestId ? ` [requestId: ${requestId}]` : ''}: ${errorMessage}`;
}

function parseJsonPayload<T>(toolName: string, rawText: string): T {
  const trimmed = rawText.trim();

  const plainTextError = extractPlainTextError(trimmed);
  if (plainTextError) {
    throw new Error(plainTextError);
  }

  const candidates = [
    trimmed,
    // Some Tableau MCP responses include log/header lines before the JSON payload.
    trimmed.slice(Math.max(trimmed.indexOf('{'), 0)),
    trimmed.slice(Math.max(trimmed.indexOf('['), 0)),
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next candidate.
    }
  }

  const jsonStart = trimmed
    .split(/\r?\n/)
    .findIndex((line) => line.trim().startsWith('{') || line.trim().startsWith('['));

  if (jsonStart >= 0) {
    const lineCandidate = trimmed
      .split(/\r?\n/)
      .slice(jsonStart)
      .join('\n');
    try {
      return JSON.parse(lineCandidate) as T;
    } catch {
      // Fall through to the final error below.
    }
  }

  const preview = trimmed.slice(0, 300);
  throw new Error(`Tool ${toolName} returned non-JSON text payload: ${preview}`);
}

async function connectClient() {
  const config = resolveTableauMcpConfig();
  const transport = new StdioClientTransport({
    command: config.command,
    env: config.env,
    stderr: 'pipe',
  });

  const client = new Client(
    {
      name: 'bmw-tableau-hub',
      version: '0.1.0',
    },
    {
      capabilities: {},
    },
  );

  if (transport.stderr) {
    transport.stderr.on('data', (chunk) => {
      const message = chunk.toString().trim();
      if (message) {
        console.error(`[tableau-mcp] ${message}`);
      }
    });
  }

  await client.connect(transport);
  return client;
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = connectClient().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
}

async function resetClient() {
  const currentClientPromise = clientPromise;
  clientPromise = null;

  if (!currentClientPromise) {
    return;
  }

  try {
    const client = await currentClientPromise;
    await client.close();
  } catch (error) {
    console.error('[tableau-mcp] Failed to close Tableau MCP client after auth failure', error);
  }
}

export async function callTableauTool<T extends JsonRecord>(name: string, args: JsonRecord) {
  const run = async () => {
    const client = await getClient();
    const response = await client.callTool({
      name,
      arguments: args,
    });

    const content = response.content as Array<{ type: string; text?: string }>;
    const textBlock = content.find((block) => block.type === 'text');
    if (!textBlock || typeof textBlock.text !== 'string') {
      throw new Error(`Tool ${name} did not return a JSON text payload.`);
    }

    return parseJsonPayload<T>(name, textBlock.text);
  };

  const runWithAuthRetry = async () => {
    try {
      return await run();
    } catch (error) {
      if (!isTableauAuthenticationError(error)) {
        throw error;
      }

      console.warn(`[tableau-mcp] ${name} returned 401; resetting Tableau MCP client and retrying once`);
      await resetClient();
      return run();
    }
  };

  const nextRequest = requestQueue.then(runWithAuthRetry, runWithAuthRetry);
  requestQueue = nextRequest.then(
    () => undefined,
    () => undefined,
  );

  return nextRequest;
}
