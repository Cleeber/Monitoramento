// Usando fetch nativo do Node.js (disponível a partir da versão 18)

async function testUpdateMonitor() {
  try {
    console.log('🔐 Fazendo login para obter token...');
    
    // Primeiro, fazer login para obter token
    const loginResponse = await fetch('http://localhost:8081/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@example.com', // Email padrão do sistema
        password: 'admin123' // Senha padrão do sistema
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Erro no login:', loginResponse.status, await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login realizado com sucesso');
    
    // Buscar monitores existentes
    console.log('📋 Buscando monitores...');
    const monitorsResponse = await fetch('http://localhost:8081/api/monitors', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!monitorsResponse.ok) {
      console.error('❌ Erro ao buscar monitores:', monitorsResponse.status);
      return;
    }
    
    const monitors = await monitorsResponse.json();
    console.log(`📊 Encontrados ${monitors.length} monitores`);
    
    if (monitors.length === 0) {
      console.log('⚠️ Nenhum monitor encontrado para testar');
      return;
    }
    
    const monitor = monitors[0];
    console.log(`🎯 Testando com monitor: ${monitor.name} (ID: ${monitor.id})`);
    console.log(`📅 Horário atual: ${monitor.report_send_time || 'não definido'}`);
    
    // Atualizar o monitor com novo horário
    const newTime = '15:30';
    console.log(`🔄 Atualizando horário para: ${newTime}`);
    
    const updateResponse = await fetch(`http://localhost:8081/api/monitors/${monitor.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: monitor.name,
        url: monitor.url,
        type: monitor.type,
        interval: monitor.interval,
        timeout: monitor.timeout,
        is_active: monitor.is_active,
        group_id: monitor.group_id,
        report_email: monitor.report_email,
        report_send_day: monitor.report_send_day,
        report_send_time: newTime
      })
    });
    
    if (!updateResponse.ok) {
      console.error('❌ Erro ao atualizar monitor:', updateResponse.status, await updateResponse.text());
      return;
    }
    
    const updatedMonitor = await updateResponse.json();
    console.log('✅ Monitor atualizado com sucesso');
    console.log(`📅 Novo horário: ${updatedMonitor.report_send_time}`);
    
    // Verificar se a alteração foi persistida
    console.log('🔍 Verificando persistência...');
    const verifyResponse = await fetch('http://localhost:8081/api/monitors', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!verifyResponse.ok) {
      console.error('❌ Erro ao verificar monitores:', verifyResponse.status);
      return;
    }
    
    const allMonitors = await verifyResponse.json();
    const verifiedMonitor = allMonitors.find(m => m.id === monitor.id);
    
    if (!verifiedMonitor) {
      console.error('❌ Monitor não encontrado na verificação');
      return;
    }
    
    console.log(`🎯 Horário verificado: ${verifiedMonitor.report_send_time}`);
    
    if (verifiedMonitor.report_send_time === newTime) {
      console.log('✅ SUCESSO: Horário foi persistido corretamente!');
    } else {
      console.log('❌ FALHA: Horário não foi persistido corretamente!');
      console.log(`Esperado: ${newTime}, Encontrado: ${verifiedMonitor.report_send_time}`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testUpdateMonitor();