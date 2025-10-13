import type { VercelRequest, VercelResponse } from '@vercel/node'
import { batchGeocode /* or your function name */ } from '../server/services/geocode-service'

const cache = new Map<string, any>() // optional, in-memory

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    let codes: string[] = []
    if (req.method === 'GET') {
      const raw = (req.query.codes || '') as string
      codes = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : []
    } else if (req.method === 'POST') {
      const body = (req.body || {}) as { codes?: string[] }
      codes = Array.isArray(body.codes) ? body.codes : []
    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    if (!codes.length) return res.status(400).json({ error: 'No geocodes provided' })

    const key = [...new Set(codes)].sort().join(',')
    if (cache.has(key)) return res.status(200).json({ fromCache: true, results: cache.get(key) })

    const results = await batchGeocode(codes)
    cache.set(key, results); setTimeout(() => cache.delete(key), 15 * 60 * 1000)

    return res.status(200).json({ fromCache: false, results })
  } catch (e:any) {
    console.error(e); return res.status(500).json({ error: e?.message || 'Server error' })
  }
}
