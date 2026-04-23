import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BMW_DATASOURCE = {
  luid: 'ad57247f-1dab-4467-9c99-a038ab3e0e3d',
  name: '[INT] DS_BMW_USA_Media_Unified Platform Data_V1 FV',
} as const;

type ParsedConfig = {
  command?: string;
  env: Record<string, string>;
};

export type TableauMcpRuntimeConfig = {
  command: string;
  env: Record<string, string>;
  datasourceLuid: string;
  datasourceName: string;
  server: string;
  siteName: string;
};

function stripTomlQuotes(value: string) {
  return value.trim().replace(/^"/, '').replace(/"$/, '');
}

function isTomlSection(line: string, section: string) {
  return line.toLowerCase() === section.toLowerCase();
}

function parseTableauConfigFile() {
  const configPath = path.join(os.homedir(), '.codex', 'config.toml');

  if (!fs.existsSync(configPath)) {
    return { env: {} } satisfies ParsedConfig;
  }

  const lines = fs.readFileSync(configPath, 'utf8').split(/\r?\n/);
  let inTableauSection = false;
  let inTableauEnvSection = false;
  const parsed: ParsedConfig = { env: {} };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('[')) {
      inTableauSection = isTomlSection(line, '[mcp_servers.tableau]');
      inTableauEnvSection = isTomlSection(line, '[mcp_servers.tableau.env]');
      continue;
    }

    const match = line.match(/^([A-Z0-9_]+|command)\s*=\s*(.+)$/i);
    if (!match) {
      continue;
    }

    const [, key, value] = match;

    if (inTableauSection && key === 'command') {
      parsed.command = stripTomlQuotes(value);
    }

    if (inTableauEnvSection) {
      parsed.env[key] = stripTomlQuotes(value);
    }
  }

  return parsed;
}

export function resolveTableauMcpConfig(): TableauMcpRuntimeConfig {
  const parsed = parseTableauConfigFile();
  const command = process.env.TABLEAU_MCP_COMMAND || parsed.command;
  const env = {
    PATH: process.env.PATH || parsed.env.PATH || '',
    DEFAULT_LOG_LEVEL:
      process.env.TABLEAU_MCP_LOG_LEVEL || parsed.env.DEFAULT_LOG_LEVEL || 'error',
    PAT_NAME: process.env.TABLEAU_PAT_NAME || parsed.env.PAT_NAME || '',
    PAT_VALUE: process.env.TABLEAU_PAT_VALUE || parsed.env.PAT_VALUE || '',
    SERVER: process.env.TABLEAU_SERVER || parsed.env.SERVER || '',
    SITE_NAME: process.env.TABLEAU_SITE_NAME || parsed.env.SITE_NAME || '',
  };

  if (!command || !env.PAT_NAME || !env.PAT_VALUE || !env.SERVER || !env.SITE_NAME) {
    throw new Error(
      'Missing Tableau MCP runtime configuration. Set TABLEAU_MCP_COMMAND, TABLEAU_PAT_NAME, TABLEAU_PAT_VALUE, TABLEAU_SERVER, and TABLEAU_SITE_NAME or populate ~/.codex/config.toml.',
    );
  }

  return {
    command,
    env,
    datasourceLuid: BMW_DATASOURCE.luid,
    datasourceName: BMW_DATASOURCE.name,
    server: env.SERVER,
    siteName: env.SITE_NAME,
  };
}
