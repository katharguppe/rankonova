import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { config as loadDotenv } from 'dotenv'

loadDotenv()

export default defineConfig({
  schema: path.join('prisma', 'schema'),
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})
