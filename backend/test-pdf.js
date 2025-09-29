import PDFService from './src/services/PDFService.ts';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function testPDFGeneration() {
  try {
    console.log('Iniciando teste de geração de PDF...');
    
    const pdfService = new PDFService();
    
    // Teste com o monitor Microsoft
    const monitorId = 'ff1154e6-b422-4f68-b253-5cff81332fa5';
    const year = 2024;
    const month = 12;
    
    console.log(`Gerando PDF para monitor ${monitorId}, ano ${year}, mês ${month}`);
    
    const pdfBuffer = await pdfService.generateMonthlyReportPDF(monitorId, year, month);
    
    if (pdfBuffer && pdfBuffer.length > 0) {
      console.log(`✅ PDF gerado com sucesso! Tamanho: ${pdfBuffer.length} bytes`);
      
      // Salvar o PDF para verificação
      fs.writeFileSync('./test-report.pdf', pdfBuffer);
      console.log('PDF salvo como test-report.pdf');
    } else {
      console.log('❌ PDF não foi gerado ou está vazio');
    }
    
  } catch (error) {
    console.error('❌ Erro ao gerar PDF:', error);
    console.error('Stack trace:', error.stack);
  }
}

testPDFGeneration();