import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { Pool } from 'pg';

const run = promisify(execFile);
const backendRoot = resolve(__dirname, '../..');

export function parseTestDatabaseUrl(value: string | undefined): URL {
  const error = () =>
    new Error(
      'TEST_DATABASE_URL must be an explicit local PostgreSQL admin URL ' +
        '(postgresql://USER:PASSWORD@127.0.0.1:5432/postgres), without query parameters. ' +
        'The role must have CREATEDB. Neon/remote URLs are never allowed.',
    );
  if (!value) throw error();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw error();
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) ||
    !url.username ||
    url.pathname !== '/postgres' ||
    url.search ||
    url.hash
  ) {
    throw error();
  }
  return url;
}

export class TemporaryDatabase {
  private readonly name = `jadi_link_test_${randomBytes(8).toString('hex')}`;
  private readonly admin: Pool;
  private created = false;
  readonly url: string;

  constructor(adminUrl: URL) {
    const safeAdminUrl = parseTestDatabaseUrl(adminUrl.toString());
    this.admin = new Pool({
      connectionString: safeAdminUrl.toString(),
      max: 1,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000,
    });
    const databaseUrl = new URL(safeAdminUrl);
    databaseUrl.pathname = `/${this.name}`;
    this.url = databaseUrl.toString();
  }

  async createAndMigrate(): Promise<void> {
    // The identifier is generated internally from hex bytes, never user input.
    await this.admin.query(`CREATE DATABASE "${this.name}"`);
    this.created = true;
    // Reproduce timezone-sensitive regressions regardless of the local default.
    await this.admin.query(
      `ALTER DATABASE "${this.name}" SET TimeZone = 'Asia/Bangkok'`,
    );
    try {
      await run(
        process.execPath,
        [
          resolve(backendRoot, 'node_modules/prisma/build/index.js'),
          'migrate',
          'deploy',
        ],
        {
          cwd: backendRoot,
          timeout: 30000,
          env: {
            ...process.env,
            DATABASE_URL: this.url,
            DIRECT_URL: this.url,
          },
        },
      );
    } catch {
      // Do not echo child-process env or connection credentials.
      throw new Error(
        'Integration migration failed; check local PostgreSQL and Prisma CLI.',
      );
    }
  }

  async dispose(): Promise<void> {
    try {
      if (this.created) {
        // Only the unique database created by this helper can be dropped.
        await this.admin.query(`DROP DATABASE "${this.name}" WITH (FORCE)`);
        this.created = false;
      }
    } finally {
      await this.admin.end();
    }
  }
}
