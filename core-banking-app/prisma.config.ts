import { defineConfig } from 'prisma/config';
import path from 'path';
import { config } from 'dotenv';

config();

export default defineConfig({
  schema: path.join(__dirname, 'prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
