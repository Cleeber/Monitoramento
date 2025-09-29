import { reportService } from './src/services/ReportService.ts';
import { emailService } from './src/services/EmailService.ts';
import { pdfService } from './src/services/PDFService.ts';
import { databaseService } from './src/services/DatabaseService.ts';

async function testEmailWithPDF() {
    console.log('🧪 Iniciando teste de envio de email com PDF...');
    
    try {
        // Buscar um monitor com slug
        const monitors = await databaseService.getMonitors();
        const monitorWithSlug = monitors.find(m => m.slug);
        
        if (!monitorWithSlug) {
            console.log('❌ Nenhum monitor com slug encontrado');
            return;
        }
        
        console.log(`📋 Testando com monitor: ${monitorWithSlug.name} (slug: ${monitorWithSlug.slug})`);
        
        // Gerar PDF
        console.log('📄 Gerando PDF...');
        const pdfBuffer = await pdfService.generateOptimizedStatusPDF(
            'https://monitor.pagina1digital.com.br',
            monitorWithSlug.slug
        );
        
        if (!pdfBuffer) {
            console.log('❌ Falha na geração do PDF');
            return;
        }
        
        console.log(`✅ PDF gerado com sucesso! Tamanho: ${Math.round(pdfBuffer.length / 1024)}KB`);
        
        // Testar envio de email com PDF
        console.log('📧 Testando envio de email com PDF anexado...');
        
        const testEmail = 'cleeberm@hotmail.com'; // Email de teste
        const friendlyFileName = `relatorio-mensal-${monitorWithSlug.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 7)}.pdf`;
        
        await emailService.sendMonthlyReport(
            testEmail,
            monitorWithSlug.name,
            pdfBuffer,
            friendlyFileName,
            `https://monitor.pagina1digital.com.br/status/${monitorWithSlug.slug}`
        );
        
        console.log('✅ Email enviado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro durante o teste:', error);
    }
}

testEmailWithPDF();