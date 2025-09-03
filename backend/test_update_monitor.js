// Teste de atualização de monitor (usando fetch nativo do Node.js)
async function testUpdateMonitor() {
  try {
    // Primeiro, buscar um monitor existente
    const listResponse = await fetch('http://localhost:3001/api/monitors', {
      headers: {
        'Authorization': 'Bearer test-token' // Usar um token válido se necessário
      }
    });
    
    if (!listResponse.ok) {
      console.log('❌ Erro ao buscar monitores:', listResponse.status);
      return;
    }
    
    const monitors = await listResponse.json();
    if (monitors.length === 0) {
      console.log('❌ Nenhum monitor encontrado');
      return;
    }
    
    const monitor = monitors[0];
    console.log('📋 Monitor selecionado:', monitor.name);
    console.log('⏰ Horário atual:', monitor.report_send_time || 'não definido');
    
    // Atualizar o monitor com um novo horário
    const newTime = '15:30';
    const updateResponse = await fetch(`http://localhost:3001/api/monitors/${monitor.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        name: monitor.name,
        url: monitor.url,
        type: monitor.type,
        interval: monitor.interval,
        timeout: monitor.timeout,
        group_id: monitor.group_id,
        enabled: monitor.enabled,
        slug: monitor.slug,
        report_email: monitor.report_email || '',
        report_send_day: monitor.report_send_day || 1,
        report_send_time: newTime
      })
    });
    
    if (updateResponse.ok) {
      console.log('✅ Monitor atualizado com sucesso');
      
      // Verificar se a atualização foi persistida
      const checkResponse = await fetch(`http://localhost:3001/api/monitors`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      if (checkResponse.ok) {
        const updatedMonitors = await checkResponse.json();
        const updatedMonitor = updatedMonitors.find(m => m.id === monitor.id);
        console.log('🔍 Horário após atualização:', updatedMonitor.report_send_time);
        
        if (updatedMonitor.report_send_time === newTime) {
          console.log('✅ Atualização persistida corretamente!');
        } else {
          console.log('❌ Atualização não foi persistida. Esperado:', newTime, 'Atual:', updatedMonitor.report_send_time);
        }
      }
    } else {
      const errorText = await updateResponse.text();
      console.log('❌ Erro na atualização:', updateResponse.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testUpdateMonitor();