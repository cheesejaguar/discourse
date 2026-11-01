import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TEST_DATABASE_URL, TEST_DB_PORT } from './dbConfig.js';

/**
 * Starts a throwaway PostgreSQL cluster for the backend test run and applies
 * the Prisma schema to it, so tests exercise real queries instead of a mocked
 * Prisma client.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'hvnp-test-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'test',
    password: 'test',
    port: TEST_DB_PORT,
    persistent: false,
    onLog: () => {},
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('hvnp_test');

  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });

  return async () => {
    await pg.stop();
    rmSync(dataDir, { recursive: true, force: true });
  };
}
