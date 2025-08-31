const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testDatabase() {
  try {
    console.log('Testando conexão com o banco...');
    
    // Verificar se a tabela smtp_config existe
    const { data, error } = await supabase
      .from('smtp_config')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('Erro ao acessar tabela smtp_config:', error.message);
    } else {
      console.log('Tabela smtp_config existe. Dados:', data);
    }
    
    // Verificar estrutura da tabela
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_columns', { table_name: 'smtp_config' })
      .single();
      
    if (tableError) {
      console.log('Não foi possível obter estrutura da tabela:', tableError.message);
    } else {
      console.log('Estrutura da tabela:', tableInfo);
    }
    
  } catch (err) {
    console.log('Erro geral:', err.message);
  }
}

testDatabase();