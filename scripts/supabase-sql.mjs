import { readFile } from 'node:fs/promises'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()
const [filename, mode] = process.argv.slice(2)
if (!filename || (mode && mode !== '--rollback-test')) {
  throw new Error('Usage: node scripts/supabase-sql.mjs <file.sql> [--rollback-test]')
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

// The existing exec_sql RPC is restricted to service_role and returns void.
// Tests deliberately raise an exception to roll back all fixtures and deletions.
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const sql = await readFile(filename, 'utf8')
const { error } = await client.rpc('exec_sql', { sql })
if (mode === '--rollback-test') {
  if (error?.code !== 'P0001' || error.message !== 'RETENTION_TEST_PASSED_ROLLED_BACK') {
    throw new Error(error?.message || 'The test did not roll back as expected')
  }
  console.log('Retention tests passed. All database changes were rolled back.')
} else {
  if (error) throw new Error(error.message)
  console.log('SQL applied successfully.')
}
