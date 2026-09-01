import type { Request, Response, NextFunction } from 'express'

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || crypto.randomUUID()
  req.requestId = id
  res.setHeader('X-Request-Id', id)
  next()
}
