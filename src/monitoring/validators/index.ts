import type { CheckContext, CheckOutcome, ValidationResult } from './types.js'
import { calculateFinalVerdict } from './types.js'
import { httpStatusValidator } from './httpStatus.validator.js'
import { keywordValidator } from './keyword.validator.js'
import { contentValidator } from './content.validator.js'
import { errorPageValidator } from './errorPage.validator.js'
import { apiHealthValidator } from './apiHealth.validator.js'
import { responseTimeValidator } from './responseTime.validator.js'
import { sslValidator } from './ssl.validator.js'

export type { CheckContext, CheckOutcome, ValidationResult, MonitorValidationConfig, Verdict } from './types.js'

export const validators = [
  httpStatusValidator,
  contentValidator,
  errorPageValidator,
  keywordValidator,
  responseTimeValidator,
  apiHealthValidator,
  sslValidator,
]

export async function runAllValidators(ctx: CheckContext): Promise<CheckOutcome> {
  const results: ValidationResult[] = []

  for (const validator of validators) {
    try {
      const result = await validator.validate(ctx)
      results.push(result)
    } catch (err) {
      results.push({
        validator: validator.name,
        verdict: 'error',
        weight: 0,
        message: `Exceção em ${validator.name}: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  const { verdict, totalWeight, maxWeight } = calculateFinalVerdict(results)

  return {
    verdict,
    responseTime: ctx.responseTime,
    statusCode: ctx.statusCode,
    error: ctx.error,
    validations: results,
    totalWeight,
    maxWeight,
    timestamp: new Date().toISOString(),
  }
}
