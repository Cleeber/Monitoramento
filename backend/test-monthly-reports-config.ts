import { databaseService } from './src/services/DatabaseService.ts';

async function testMonthlyReportsConfig() {
    console.log('🧪 Verificando configurações de relatórios mensais...');
    
    try {
        // Verificar monitores ativos
        const monitors = await databaseService.getMonitors();
        console.log(`📋 Total de monitores: ${monitors.length}`);
        
        // Verificar quais monitores têm email de relatório configurado
        const monitorsWithReports = monitors.filter(m => m.report_email);
        console.log(`📧 Monitores com email de relatório: ${monitorsWithReports.length}`);
        
        monitorsWithReports.forEach(monitor => {
            console.log(`   - ${monitor.name}: ${monitor.report_email} (ativo: ${monitor.is_active})`);
        });
        
        // Verificar configurações de relatórios mensais
        const monthlyReports = await databaseService.getMonthlyReportConfigs();
        console.log(`📊 Configurações de relatórios mensais: ${monthlyReports.length}`);
        
        monthlyReports.forEach(config => {
            console.log(`   - Monitor ID ${config.monitor_id}: ${config.email} (ativo: ${config.is_active})`);
        });
        
        // Verificar histórico de relatórios recentes
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        console.log(`📅 Verificando histórico para ${currentMonth}/${currentYear}...`);
        
        for (const monitor of monitorsWithReports) {
            const history = await databaseService.getMonthlyReportHistory({
                monitor_id: monitor.id,
                year: currentYear,
                month: currentMonth,
                limit: 5
            });
            
            console.log(`   - ${monitor.name}: ${history.length} registros no histórico`);
            history.forEach(record => {
                console.log(`     * ${record.sent_at}: ${record.status}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Erro durante verificação:', error);
    }
}

testMonthlyReportsConfig();