export interface TokenClaims {
  name: string;
  preferredUsername: string;
  scopes: string;
  roles: string;
  audience: string;
  expires: string;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function toTokenClaims(token: string): TokenClaims | null {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return null;
  }
  const roles = payload['roles'];
  const exp = typeof payload['exp'] === 'number' ? payload['exp'] : 0;
  return {
    name: String(payload['name'] ?? payload['preferred_username'] ?? '—'),
    preferredUsername: String(payload['preferred_username'] ?? payload['upn'] ?? '—'),
    scopes: String(payload['scp'] ?? payload['scope'] ?? '—'),
    roles: Array.isArray(roles) ? roles.join(', ') : '—',
    audience: Array.isArray(payload['aud']) ? payload['aud'].join(', ') : String(payload['aud'] ?? '—'),
    expires: exp ? new Date(exp * 1000).toLocaleString() : '—'
  };
}
