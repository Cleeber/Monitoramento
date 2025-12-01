
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load env vars
const envPath = path.join(process.cwd(), '.env')
dotenv.config({ path: envPath })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log('Starting migration to remove groups...')

  try {
    // 1. Remove foreign key constraint from monitors
    // We might not know the constraint name, but usually it is automatically named.
    // Or we can just drop the column and it drops the constraint? Postgres allows dropping column with CASCADE.
    
    console.log('Dropping group_id from monitors...')
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE monitors DROP COLUMN IF EXISTS group_id CASCADE;'
    })
    if (error1) {
        // If rpc exec_sql is not available (it's a custom function), we might fail here.
        // Assuming exec_sql exists as seen in index.ts
        console.error('Error dropping group_id from monitors:', error1)
    } else {
        console.log('Dropped group_id from monitors.')
    }

    console.log('Dropping group_id from reports...')
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE reports DROP COLUMN IF EXISTS group_id CASCADE;'
    })
    if (error2) console.error('Error dropping group_id from reports:', error2)
    else console.log('Dropped group_id from reports.')

    console.log('Dropping groups table...')
    const { error: error3 } = await supabase.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS groups CASCADE;'
    })
    if (error3) console.error('Error dropping groups table:', error3)
    else console.log('Dropped groups table.')

    console.log('Migration completed.')

  } catch (error) {
    console.error('Migration failed:', error)
  }
}

runMigration()
