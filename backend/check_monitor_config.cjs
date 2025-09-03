const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkMonitorConfig() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    // Primeiro, vamos listar todos os monitores
    const { data: allMonitors, error: allError } = await supabase
      .from('monitors')
      .select('id, name, report_email, report_send_day, report_send_time');
    
    if (allError) {
      console.error('Erro ao buscar todos os monitores:', allError);
      return;
    }
    
    console.log('=== TODOS OS MONITORES ===');
    console.log(JSON.stringify(allMonitors, null, 2));
    
    // Agora buscar especificamente o SupplyHub
    const { data, error } = await supabase
      .from('monitors')
      .select('id, name, report_email, report_send_day, report_send_time')
      .eq('name', 'SupplyHub');
    
    if (error) {
      console.error('Erro:', error);
      return;
    }
    
    console.log('Monitor SupplyHub:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data && data.length > 0) {
      const monitor = data[0];
      console.log('\n=== Configuração do Relatório ===');
      console.log('E-mail:', monitor.report_email);
      console.log('Dia do envio:', monitor.report_send_day);
      console.log('Horário do envio:', monitor.report_send_time);
      
      const today = new Date();
      console.log('\n=== Data/Hora Atual ===');
      console.log('Dia atual:', today.getDate());
      console.log('Horário atual:', today.toTimeString().substring(0, 5));
      
      // Verificar se deveria ter enviado hoje
      if (monitor.report_send_day === today.getDate()) {
        console.log('\n✅ Hoje é o dia configurado para envio!');
        console.log('Horário configurado:', monitor.report_send_time);
      } else {
        console.log('\n❌ Hoje NÃO é o dia configurado para envio.');
        console.log('Dia configurado:', monitor.report_send_day);
        console.log('Dia atual:', today.getDate());
      }
    }
    
  } catch (error) {
    console.error('Erro ao verificar configuração:', error);
  }
}

checkMonitorConfig();