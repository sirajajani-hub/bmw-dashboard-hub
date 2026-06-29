import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { callTableauTool, isTableauAuthenticationError } from './tableauMcpClient';

const TABLEAU_ENV_KEYS = [
  'TABLEAU_MCP_COMMAND',
  'TABLEAU_PAT_NAME',
  'TABLEAU_PAT_VALUE',
  'TABLEAU_SERVER',
  'TABLEAU_SITE_NAME',
] as const;

function withTableauTestEnv() {
  const originalEnv = Object.fromEntries(TABLEAU_ENV_KEYS.map((key) => [key, process.env[key]]));

  process.env.TABLEAU_MCP_COMMAND = 'tableau-mcp-test';
  process.env.TABLEAU_PAT_NAME = 'test-pat';
  process.env.TABLEAU_PAT_VALUE = 'test-token';
  process.env.TABLEAU_SERVER = 'https://tableau.example.test';
  process.env.TABLEAU_SITE_NAME = 'bmw-test';

  return () => {
    for (const key of TABLEAU_ENV_KEYS) {
      const originalValue = originalEnv[key];
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  };
}

test('isTableauAuthenticationError recognizes the normalized Tableau MCP 401', () => {
  assert.equal(
    isTableauAuthenticationError(
      new Error(
        'Tableau MCP authentication failed (401) [requestId: 5]. Check TABLEAU_PAT_NAME, TABLEAU_PAT_VALUE, TABLEAU_SERVER, and TABLEAU_SITE_NAME in your Codex/Tableau MCP config.',
      ),
    ),
    true,
  );

  assert.equal(isTableauAuthenticationError(new Error('Tool query-datasource returned non-JSON text payload')), false);
});

test('callTableauTool resets the MCP client and retries once after a normalized Tableau MCP 401', async (t) => {
  const restoreEnv = withTableauTestEnv();
  t.after(restoreEnv);
  t.mock.method(console, 'warn', () => undefined);

  const clientIds = new WeakMap<object, number>();
  const connectedClientIds: number[] = [];
  const closedClientIds: number[] = [];
  const callClientIds: number[] = [];
  const requests: Array<{ name: string; arguments: Record<string, unknown> }> = [];

  t.mock.method(Client.prototype, 'connect', async function () {
    const clientId = connectedClientIds.length + 1;
    clientIds.set(this, clientId);
    connectedClientIds.push(clientId);
  });

  t.mock.method(Client.prototype, 'close', async function () {
    const clientId = clientIds.get(this);
    if (clientId) {
      closedClientIds.push(clientId);
    }
  });

  t.mock.method(Client.prototype, 'callTool', async function (request) {
    const clientId = clientIds.get(this);
    assert.ok(clientId, 'expected callTool to run on a connected client');
    callClientIds.push(clientId);
    requests.push(request as { name: string; arguments: Record<string, unknown> });

    if (callClientIds.length === 1) {
      return {
        content: [
          {
            type: 'text',
            text: 'requestId: 5\nerror: Request failed with status code 401',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: '{"ok":true,"rows":[{"id":1}]}',
        },
      ],
    };
  });

  const result = await callTableauTool<{ ok: boolean; rows: Array<{ id: number }> }>('query-datasource', {
    query: 'SELECT 1',
  });

  assert.deepEqual(result, { ok: true, rows: [{ id: 1 }] });
  assert.deepEqual(connectedClientIds, [1, 2]);
  assert.deepEqual(callClientIds, [1, 2]);
  assert.deepEqual(closedClientIds, [1]);
  assert.deepEqual(
    requests.map((request) => request.name),
    ['query-datasource', 'query-datasource'],
  );
  assert.deepEqual(
    requests.map((request) => request.arguments),
    [{ query: 'SELECT 1' }, { query: 'SELECT 1' }],
  );
});
