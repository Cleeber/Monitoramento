const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testSmtpConfig() {
  console.log('🔍 Testando configuração SMTP...')
  
  try {
    // Teste 1: Inserir configuração SMTP
    console.log('\n1. Inserindo configuração SMTP de teste...')
    const testConfig = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: 'test@example.com',
      pass: 'test-password',
      from_name: 'Test Monitor',
      from_email: 'noreply@test.com',
      is_configured: true
    }
    
    const { data: insertData, error: insertError } = await supabase
      .from('smtp_config')
      .upsert(testConfig)
      .select()
    
    if (insertError) {
      console.error('❌ Erro ao inserir:', insertError)
      return
    }
    
    console.log('✅ Configuração inserida com sucesso:', insertData)
    
    // Teste 2: Buscar configuração
    console.log('\n2. Buscando configuração...')
    const { data: fetchData, error: fetchError } = await supabase
      .from('smtp_config')
      .select('*')
      .single()
    
    if (fetchError) {
      console.error('❌ Erro ao buscar:', fetchError)
      return
    }
    
    console.log('✅ Configuração encontrada:', fetchData)
    
    // Teste 3: Atualizar configuração
    console.log('\n3. Atualizando configuração...')
    const { data: updateData, error: updateError } = await supabase
      .from('smtp_config')
      .update({
        host: 'smtp.updated.com',
        port: 465,
        secure: true
      })
      .eq('host', 'smtp.gmail.com')
      .select()
    
    if (updateError) {
      console.error('❌ Erro ao atualizar:', updateError)
      return
    }
    
    console.log('✅ Configuração atualizada com sucesso:', updateData)
    
    // Teste 4: Simular resposta da API
    console.log('\n4. Simulando resposta da API (formato frontend)...')
    const config = updateData[0]
    const apiResponse = {
      id: config.id,
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.pass,
      from_email: config.from_email,
      from_name: config.from_name,
      use_tls: !config.secure,
      use_ssl: config.secure,
      enabled: config.is_configured
    }
    
    console.log('✅ Formato da API:', JSON.stringify(apiResponse, null, 2))
    
    // Limpeza: Remover dados de teste
    console.log('\n5. Limpando dados de teste...')
    const { error: deleteError } = await supabase
      .from('smtp_config')
      .delete()
      .eq('host', 'smtp.updated.com')
    
    if (deleteError) {
      console.error('❌ Erro ao limpar:', deleteError)
    } else {
      console.log('✅ Dados de teste removidos')
    }
    
    console.log('\n🎉 Todos os testes passaram! A configuração SMTP está funcionando corretamente.')
    
  } catch (error) {
    console.error('❌ Erro geral:', error)
  }
}

testSmtpConfig()