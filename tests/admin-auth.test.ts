import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test, mock } from 'node:test'
import bcrypt from 'bcryptjs'
import { bootstrapAdmin } from '../src/lib/bootstrapAdmin.js'
import { DatabaseService } from '../src/services/DatabaseService.js'

function fakeDatabase(existingAdmin = false) {
  const created: Parameters<DatabaseService['createUser']>[0][] = []
  return {
    created,
    getAdminUser: async () => existingAdmin ? { id: randomUUID() } : null,
    createUser: async (user: Parameters<DatabaseService['createUser']>[0]) => {
      created.push(user)
      return {
        ...user, id: randomUUID(), role: user.role || 'user',
        created_at: null, updated_at: null,
      }
    },
  }
}

test('startup sem credenciais não cria uma conta padrão', async () => {
  const database = fakeDatabase()
  assert.equal(await bootstrapAdmin(database, {}), 'disabled')
  assert.equal(database.created.length, 0)
})

test('admin existente impede recriação mesmo com outro email configurado', async () => {
  const database = fakeDatabase(true)
  assert.equal(await bootstrapAdmin(database, {
    ADMIN_EMAIL: 'new-admin@example.test', ADMIN_PASSWORD: randomUUID(),
  }), 'existing')
  assert.equal(database.created.length, 0)
})

test('configuração incompleta também preserva um admin existente', async () => {
  const database = fakeDatabase(true)
  assert.equal(await bootstrapAdmin(database, {
    ADMIN_EMAIL: 'new-admin@example.test',
  }), 'existing')
  assert.equal(database.created.length, 0)
})

test('primeiro admin exige email e senha juntos', async () => {
  for (const env of [{ ADMIN_EMAIL: 'owner@example.test' }, { ADMIN_PASSWORD: randomUUID() }]) {
    const database = fakeDatabase()
    await assert.rejects(bootstrapAdmin(database, env), /ADMIN_EMAIL e ADMIN_PASSWORD juntos/)
    assert.equal(database.created.length, 0)
  }
})

test('primeiro admin usa as credenciais fornecidas sem alterar a senha', async () => {
  const database = fakeDatabase()
  const password = ` ${randomUUID()} `
  assert.equal(await bootstrapAdmin(database, {
    ADMIN_EMAIL: ' owner@example.test ', ADMIN_PASSWORD: password, ADMIN_NAME: ' Responsável ',
  }), 'created')
  assert.deepEqual(database.created, [{
    email: 'owner@example.test', password, name: 'Responsável', role: 'admin',
  }])
})

test('falha de consulta não permite criar um admin sem verificar o banco', async () => {
  const database = fakeDatabase()
  database.getAdminUser = async () => { throw new Error('Banco indisponível') }
  await assert.rejects(bootstrapAdmin(database, {
    ADMIN_EMAIL: 'owner@example.test', ADMIN_PASSWORD: randomUUID(),
  }), /Banco indisponível/)
  assert.equal(database.created.length, 0)
})

test('cadastro envia hash bcrypt para a coluna password usada pelo login', async () => {
  const oldUrl = process.env.SUPABASE_URL
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_URL = 'https://supabase.example.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  let inserted: Record<string, unknown> | undefined
  const fetchMock = mock.method(globalThis, 'fetch', async (_input, init) => {
    inserted = JSON.parse(String(init?.body))
    return new Response(JSON.stringify(inserted), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    })
  })
  try {
    const password = randomUUID()
    await new DatabaseService().createUser({
      email: 'owner@example.test', password, name: 'Responsável', role: 'admin',
    })
    assert.ok(inserted)
    assert.equal(inserted.role, 'admin')
    assert.equal('password_hash' in inserted, false)
    assert.equal(typeof inserted.password, 'string')
    assert.notEqual(inserted.password, password)
    assert.equal(await bcrypt.compare(password, String(inserted.password)), true)
    assert.equal(await bcrypt.compare(randomUUID(), String(inserted.password)), false)
  } finally {
    fetchMock.mock.restore()
    if (oldUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = oldUrl
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey
  }
})
