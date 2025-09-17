#!/usr/bin/env node

const https = require('https');
const http = require('http');

// URLs para testar
const urls = [
  'https://api.pagina1digital.com.br/api/health',
  'https://monitor.pagina1digital.com.br',
  'https://zhywrrzzezexlvtpqacl.supabase.co',
  'https://monitoramento-uptime-monitor.4uxnvx.easypanel.host'
];

function testUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const startTime = Date.now();
    
    const req = protocol.get(url, (res) => {
      const responseTime = Date.now() - startTime;
      resolve({
        url,
        status: res.statusCode,
        responseTime,
        success: res.statusCode >= 200 && res.statusCode < 400
      });
    });
    
    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      resolve({
        url,
        status: 'ERROR',
        responseTime,
        success: false,
        error: error.message
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      resolve({
        url,
        status: 'TIMEOUT',
        responseTime,
        success: false,
        error: 'Request timeout'
      });
    });
  });
}

async function runTests() {
  console.log('🔍 Testando conectividade dos serviços...\n');
  
  const results = [];
  
  for (const url of urls) {
    console.log(`Testando: ${url}`);
    const result = await testUrl(url);
    results.push(result);
    
    const statusIcon = result.success ? '✅' : '❌';
    const statusText = result.success ? 'OK' : 'FALHA';
    
    console.log(`${statusIcon} ${statusText} - Status: ${result.status} - Tempo: ${result.responseTime}ms`);
    if (result.error) {
      console.log(`   Erro: ${result.error}`);
    }
    console.log('');
  }
  
  // Resumo
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log('📊 RESUMO DOS TESTES:');
  console.log(`✅ Sucessos: ${successful}/${total}`);
  console.log(`❌ Falhas: ${total - successful}/${total}`);
  
  if (successful === total) {
    console.log('\n🎉 Todos os serviços estão funcionando corretamente!');
  } else {
    console.log('\n⚠️  Alguns serviços apresentaram problemas. Verifique as configurações.');
  }
  
  return results;
}

// Executar testes
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testUrl, runTests };