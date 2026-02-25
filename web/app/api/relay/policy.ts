export type OriginRule = {
  protocol: 'http:' | 'https:'
  port: string
  hostSuffix: string
}

export type OriginAllowlist = {
  exact: Set<string>
  wildcard: OriginRule[]
}

function normalizeOriginPort(url: URL): string {
  if (url.port) return url.port
  if (url.protocol === 'https:') return '443'
  if (url.protocol === 'http:') return '80'
  return ''
}

export function normalizeClientIp(raw: string): string | null {
  const cleaned = raw.trim().replace(/^\[|\]$/g, '').toLowerCase()
  if (cleaned.length < 3 || cleaned.length > 64) return null
  if (!/^[0-9a-f:.]+$/.test(cleaned)) return null
  return cleaned
}

function firstForwardedHop(raw: string | null): string | null {
  if (!raw) return null
  const first = raw.split(',')[0]?.trim() || ''
  return first.length > 0 ? first : null
}

export function getClientIpFromHeaders(
  headers: Headers,
  options: { isVercelRuntime: boolean; trustProxyHeaders: boolean }
): string {
  if (options.isVercelRuntime) {
    const vercelForwarded = firstForwardedHop(headers.get('x-vercel-forwarded-for'))
    if (vercelForwarded) {
      const normalized = normalizeClientIp(vercelForwarded)
      if (normalized) return normalized
    }

    const fallbackForwarded = firstForwardedHop(headers.get('x-forwarded-for'))
    if (fallbackForwarded) {
      const normalized = normalizeClientIp(fallbackForwarded)
      if (normalized) return normalized
    }
  } else if (options.trustProxyHeaders) {
    const directIp = headers.get('x-real-ip')
    if (directIp) {
      const normalized = normalizeClientIp(directIp)
      if (normalized) return normalized
    }

    const forwarded = firstForwardedHop(headers.get('x-forwarded-for'))
    if (forwarded) {
      const normalized = normalizeClientIp(forwarded)
      if (normalized) return normalized
    }
  }

  return 'unknown'
}

export function parseOriginAllowlist(raw: string): OriginAllowlist | null {
  const exact = new Set<string>()
  const wildcard: OriginRule[] = []

  const entries = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  for (const entry of entries) {
    const wildcardMatch = /^(https?):\/\/\*\.([A-Za-z0-9.-]+)(?::(\d{1,5}))?$/i.exec(entry)
    if (wildcardMatch) {
      const protocol = (wildcardMatch[1].toLowerCase() + ':') as OriginRule['protocol']
      const host = wildcardMatch[2].toLowerCase().replace(/^\.+/, '')
      const port = wildcardMatch[3] || (protocol === 'https:' ? '443' : '80')
      if (host.length > 0) {
        wildcard.push({
          protocol,
          port,
          hostSuffix: `.${host}`
        })
      }
      continue
    }

    try {
      exact.add(new URL(entry).origin)
    } catch {
      // Ignore invalid allowlist items.
    }
  }

  if (exact.size === 0 && wildcard.length === 0) return null
  return { exact, wildcard }
}

export function isOriginAllowed(headers: Headers, allowlist: OriginAllowlist | null): boolean {
  if (!allowlist) return true

  const origin = headers.get('origin')
  if (!origin) return false

  let parsedOrigin: URL
  try {
    parsedOrigin = new URL(origin)
  } catch {
    return false
  }

  const normalizedOrigin = parsedOrigin.origin
  if (allowlist.exact.has(normalizedOrigin)) {
    return true
  }

  const hostname = parsedOrigin.hostname.toLowerCase()
  const port = normalizeOriginPort(parsedOrigin)
  for (const rule of allowlist.wildcard) {
    if (parsedOrigin.protocol !== rule.protocol) continue
    if (port !== rule.port) continue
    if (hostname.length <= rule.hostSuffix.length) continue
    if (hostname.endsWith(rule.hostSuffix)) return true
  }

  return false
}

export function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim())
  if (!match) return null
  return match[1].trim() || null
}

export function readApiCredential(headers: Headers): string | null {
  const headerKey = headers.get('x-relayer-api-key')
  if (headerKey && headerKey.trim().length > 0) {
    return headerKey.trim()
  }
  return parseBearerToken(headers.get('authorization'))
}
