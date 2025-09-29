import { reportService } from './src/services/ReportService.ts';
import { databaseService } from './src/services/DatabaseService.ts';

async function testManualReport() {
    console.log('🧪 Testando envio manual de relatório mensal...');
    
    try {
        // Buscar um monitor com configuração de relatório
        const monitors = await databaseService.getMonitors();
        const monitorWithReport = monitors.find(m => m.report_email);
        
        if (!monitorWithReport) {
            console.log('❌ Nenhum monitor com email de relatório encontrado');
            return;
        }
        
        console.log(`📋 Testando com monitor: ${monitorWithReport.name}`);
        console.log(`📧 Email: ${monitorWithReport.report_email}`);
        
        // Enviar relatório usando sendMonthlyReportDynamic
        console.log('📤 Enviando relatório mensal dinâmico...');
        await reportService.sendMonthlyReportDynamic(
            monitorWithReport.id, 
            monitorWithReport.report_email
        );
        
        console.log('✅ Relatório enviado com sucesso!');
        
        // Verificar se foi registrado no histórico
        const history = await databaseService.getMonthlyReportHistory({
            monitor_id: monitorWithReport.id,
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            limit: 1
        });
        
        console.log(`📊 Registros no histórico: ${history.length}`);
        if (history.length > 0) {
            console.log(`   - Status: ${history[0].status}`);
            console.log(`   - Enviado em: ${history[0].sent_at}`);
        }
        
    } catch (error) {
        console.error('❌ Erro durante teste manual:', error);
    }
}

testManualReport();