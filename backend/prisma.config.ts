import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations use Neon's direct connection, not its pooled endpoint.
    url: process.env['DIRECT_URL'] || env('DATABASE_URL'),
  },
});
