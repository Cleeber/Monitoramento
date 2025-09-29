import { reportService } from './src/services/ReportService.ts'
import { pdfService } from './src/services/PDFService.ts'
import { databaseService } from './src/services/DatabaseService.ts'
import fs from 'fs'

async function testPDFGeneration() {
  try {
    console.log('🧪 Iniciando teste de geração de PDF...')
    
    // Buscar monitores
    const monitors = await databaseService.getMonitors()
    console.log(`📋 Encontrados ${monitors.length} monitores`)
    
    if (monitors.length === 0) {
      console.log('❌ Nenhum monitor encontrado')
      return
    }
    
    // Pegar o primeiro monitor com slug
    const monitorWithSlug = monitors.find((m: any) => m.slug)
    
    if (!monitorWithSlug) {
      console.log('❌ Nenhum monitor com slug encontrado')
      console.log('📋 Monitores disponíveis:', monitors.map((m: any) => ({ name: m.name, slug: m.slug })))
      return
    }
    
    console.log(`📋 Testando com monitor: ${monitorWithSlug.name} (slug: ${monitorWithSlug.slug})`)
    
    // Testar geração de PDF usando o método sendMonthlyReportDynamic
    console.log('📄 Testando geração de PDF via sendMonthlyReportDynamic...')
    
    try {
      // Simular o envio de relatório dinâmico (sem enviar email)
      console.log('🧪 Testando captura de página de status...')
      
      const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://monitor.pagina1digital.com.br'
      console.log(`🌐 FRONTEND_BASE_URL: ${frontendBaseUrl}`)
      
      // Testar captura otimizada
      try {
        console.log(`🖼️ Testando generateOptimizedStatusPDF com baseUrl: ${frontendBaseUrl}`)
        const pdfBuffer = await pdfService.generateOptimizedStatusPDF(
          monitorWithSlug.slug,
          monitorWithSlug.name,
          frontendBaseUrl
        )
        
        console.log(`✅ PDF otimizado gerado com sucesso! Tamanho: ${Math.round(pdfBuffer.length / 1024)}KB`)
        
        // Salvar PDF para verificação
        const fileName = `test-optimized-pdf-${Date.now()}.pdf`
        fs.writeFileSync(fileName, pdfBuffer)
        console.log(`💾 PDF salvo como: ${fileName}`)
        
      } catch (optError) {
        console.error('❌ Erro na geração de PDF otimizado:', optError)
        
        // Testar captura dinâmica como fallback
        try {
          console.log(`🖼️ Testando generateDynamicStatusPDF com baseUrl: ${frontendBaseUrl}`)
          const pdfBuffer = await pdfService.generateDynamicStatusPDF(
            monitorWithSlug.slug,
            monitorWithSlug.name,
            frontendBaseUrl
          )
          
          console.log(`✅ PDF dinâmico gerado com sucesso! Tamanho: ${Math.round(pdfBuffer.length / 1024)}KB`)
          
          // Salvar PDF para verificação
          const fileName = `test-dynamic-pdf-${Date.now()}.pdf`
          fs.writeFileSync(fileName, pdfBuffer)
          console.log(`💾 PDF salvo como: ${fileName}`)
          
        } catch (dynError) {
          console.error('❌ Erro na geração de PDF dinâmico:', dynError)
          console.error('Stack trace:', dynError.stack)
        }
      }
      
    } catch (pdfError) {
      console.error('❌ Erro geral na geração de PDF:', pdfError)
      console.error('Stack trace:', pdfError.stack)
    }
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error)
    console.error('Stack trace:', error.stack)
  }
}

testPDFGeneration()