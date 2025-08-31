# Validação de Conteúdo para Verificações HTTP

## Visão Geral

Este documento descreve a funcionalidade de validação de conteúdo implementada no sistema de monitoramento para detectar páginas vazias ou com conteúdo insuficiente que retornam HTTP 200 OK.

## Problema Identificado

Alguns domínios podem retornar status HTTP 200 (OK) mas exibir páginas completamente vazias ou com conteúdo mínimo. O sistema anterior classificava essas páginas como "online" baseando-se apenas no código de status HTTP, resultando em falsos positivos.

### Exemplo
- **Domínio**: `https://clm-digital.com`
- **Status HTTP**: 200 OK
- **Conteúdo**: Página em branco
- **Classificação anterior**: Online
- **Classificação atual**: Warning

## Implementação

### Critérios de Validação

A validação de conteúdo verifica dois aspectos:

1. **Comprimento do Conteúdo Bruto** (`minContentLength`)
   - Verifica o tamanho total da resposta HTTP
   - Padrão: 100 caracteres

2. **Comprimento do Texto Limpo** (`minTextLength`)
   - Remove tags HTML e normaliza espaços em branco
   - Verifica o conteúdo textual real
   - Padrão: 50 caracteres

### Configuração

```typescript
interface ContentValidationConfig {
  enabled: boolean;           // Habilita/desabilita a validação
  minContentLength: number;   // Tamanho mínimo do conteúdo bruto
  minTextLength: number;      // Tamanho mínimo do texto limpo
}
```

**Configuração Padrão**:
```typescript
{
  enabled: true,
  minContentLength: 100,
  minTextLength: 50
}
```

### Lógica de Classificação

Para verificações HTTP, o status é determinado da seguinte forma:

1. **Offline**: Status HTTP ≥ 500 ou erros de conexão
2. **Warning**: 
   - Status HTTP 4xx, OU
   - Status HTTP 2xx-3xx mas conteúdo insuficiente (quando validação habilitada)
3. **Online**: Status HTTP 2xx-3xx com conteúdo suficiente

### Métodos de Configuração

```typescript
// Configurar validação de conteúdo
monitoringService.setContentValidation({
  enabled: true,
  minContentLength: 150,
  minTextLength: 75
});

// Obter configuração atual
const config = monitoringService.getContentValidation();
```

## Benefícios

1. **Detecção de Falsos Positivos**: Identifica páginas vazias que retornam 200 OK
2. **Flexibilidade**: Configuração ajustável por ambiente
3. **Compatibilidade**: Não afeta verificações existentes quando desabilitada
4. **Granularidade**: Diferencia entre problemas de servidor (offline) e conteúdo (warning)

## Casos de Uso

### Páginas em Manutenção
- Status HTTP: 200 OK
- Conteúdo: Página básica "Em manutenção"
- Classificação: Warning (conteúdo insuficiente)

### Domínios Sem Site
- Status HTTP: 200 OK
- Conteúdo: Página completamente vazia
- Classificação: Warning (sem conteúdo)

### Sites Funcionais
- Status HTTP: 200 OK
- Conteúdo: Página completa com texto suficiente
- Classificação: Online

## Considerações Técnicas

- A validação é aplicada apenas para verificações HTTP
- Verificações de ping e TCP não são afetadas
- O processamento adicional é mínimo e não impacta significativamente a performance
- A configuração pode ser ajustada em tempo de execução

## Histórico de Mudanças

- **v1.0**: Implementação inicial da validação de conteúdo
- Adicionada interface `ContentValidationConfig`
- Implementados métodos `setContentValidation` e `getContentValidation`
- Integração com o método `checkHttp` existente