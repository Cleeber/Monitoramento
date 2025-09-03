import { databaseService } from './dist/services/DatabaseService.js';
import { schedulerService } from './dist/services/SchedulerService.js';

async function testScheduler() {
  console.log('🧪 Iniciando teste do sistema de agendamento...');
  
  try {
    // 1. Verificar jobs ativos
    console.log('\n📋 Jobs atualmente agendados:');
    const jobs = await schedulerService.listJobs();
    
    jobs.forEach(job => {
      console.log(`  - ${job.name}: ${job.status}`);
    });
    
    console.log(`\n📊 Total de jobs: ${jobs.length}`);
    
    // 2. Buscar monitores com configuração de relatório
    console.log('\n🔍 Monitores com configuração de relatório:');
    const monitors = await databaseService.getMonitors();
    
    const monitorsWithReports = monitors.filter(m => 
      m.report_email && m.report_send_day && m.report_send_time
    );
    
    console.log(`📈 ${monitorsWithReports.length} monitores configurados para relatórios`);
    
    monitorsWithReports.forEach(monitor => {
      console.log(`  - ${monitor.name}:`);
      console.log(`    📧 Email: ${monitor.report_email}`);
      console.log(`    📅 Dia: ${monitor.report_send_day}`);
      console.log(`    ⏰ Horário: ${monitor.report_send_time}`);
    });
    
    // 3. Verificar se há jobs correspondentes
    console.log('\n🔗 Verificando correspondência entre monitores e jobs:');
    
    monitorsWithReports.forEach(monitor => {
      const jobName = `monthly-report-${monitor.id}`;
      const hasJob = jobs.some(job => job.name === jobName);
      
      if (hasJob) {
        console.log(`  ✅ ${monitor.name}: job agendado corretamente`);
      } else {
        console.log(`  ❌ ${monitor.name}: job NÃO encontrado`);
      }
    });
    
    // 4. Testar reagendamento
    if (monitorsWithReports.length > 0) {
      const testMonitor = monitorsWithReports[0];
      console.log(`\n🔄 Testando reagendamento para: ${testMonitor.name}`);
      
      await schedulerService.rescheduleMonitorReport(testMonitor.id);
      console.log('✅ Reagendamento executado com sucesso');
    }
    
    console.log('\n🎉 Teste do agendamento concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testScheduler().then(() => {
  console.log('\n🏁 Teste finalizado');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});