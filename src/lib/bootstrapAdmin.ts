import type { DatabaseService } from '../services/DatabaseService.js'

type AdminDatabase = Pick<DatabaseService, 'getAdminUser' | 'createUser'>

/** Cria apenas o primeiro admin, quando credenciais foram configuradas explicitamente. */
export async function bootstrapAdmin(
  database: AdminDatabase,
  env: NodeJS.ProcessEnv = process.env
): Promise<'disabled' | 'existing' | 'created'> {
  const email = env.ADMIN_EMAIL?.trim()
  const password = env.ADMIN_PASSWORD

  if (!email && !password) return 'disabled'

  // Credenciais de bootstrap nunca substituem um administrador existente.
  if (await database.getAdminUser()) return 'existing'

  if (!email || !password) {
    throw new Error('Configure ADMIN_EMAIL e ADMIN_PASSWORD juntos para criar o primeiro administrador')
  }

  await database.createUser({
    email,
    password,
    name: env.ADMIN_NAME?.trim() || 'Administrador',
    role: 'admin',
  })

  return 'created'
}
