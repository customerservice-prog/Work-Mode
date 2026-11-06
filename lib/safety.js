import dns from 'node:dns/promises';
import net from 'node:net';

const DANGEROUS_ACTIONS = /\b(pay|purchase|buy|checkout|order|charge|refund|transfer|withdraw|delete|remove|release|unassign|assign|publish|post|send|submit|save|update|confirm|subscribe|cancel|sign|invite|archive|disable|close account|accept|agree|authorize|place order|add to cart|checkout|replace number|change number|create|book|reserve|unsubscribe|finalize|apply changes|complete purchase)\b/i;
const SECRET_INPUT = /\b(pass(word|code)?|one.?time|otp|verification|2fa|mfa|security.?code|credit.?card|debit.?card|card.?number|cc.?number|cvc|cvv|routing.?number|account.?number|social.?security|ssn|api.?key|access.?token|auth.?token|secret|private.?key)\b/i;
const BLOCKED_HOST = /(?:^|\.)(?:localhost|local|internal)$/i;
const METADATA_HOSTS = new Set(['metadata', 'metadata.google.internal', 'instance-data', '169.254.169.254']);

export function isPrivateIp(raw) {
  const ip = String(raw || '').toLowerCase();
  if (ip.startsWith('::ffff:')) return isPrivateIp(ip.slice(7));
  const family = net.isIP(ip);
  if (family === 4) {
    const [a, b, c] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0 && c === 0);
  }
  if (family === 6) {
    return ip === '::' || ip === '::1' || ip.startsWith('fe8') || ip.startsWith('fe9') ||
      ip.startsWith('fea') || ip.startsWith('feb') ||
      ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('2001:db8:');
  }
  return false;
}

export function assertPublicUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); }
  catch { throw new Error('Please provide a complete public https:// URL'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) web pages are allowed');
  if (u.username || u.password) throw new Error('Passwords embedded in URLs are not allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || !host.includes('.') && net.isIP(host) === 0 ||
      BLOCKED_HOST.test(host) || METADATA_HOSTS.has(host) || isPrivateIp(host)) {
    throw new Error('Local, internal, or private network addresses are blocked');
  }
  return u.toString();
}

// Important: validate DNS-resolved navigation destinations too. This reduces
// (but cannot eliminate) DNS-rebinding and other browser-network risks.
export async function assertPublicNavigation(raw) {
  const url = assertPublicUrl(raw);
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  if (!net.isIP(host)) {
    const addresses = await dns.lookup(host, { all: true });
    if (!addresses.length || addresses.some(a => isPrivateIp(a.address))) {
      throw new Error('Navigation resolved to a private/internal address');
    }
  }
  return url;
}

export function isSecretField(meta = {}) {
  return SECRET_INPUT.test([meta.type, meta.name, meta.auto, meta.label, meta.placeholder].filter(Boolean).join(' '));
}

export function isHighImpactAction(meta = {}) {
  const type = String(meta.type || '').toLowerCase();
  if (['submit', 'reset'].includes(type)) return true;
  const label = [meta.label, meta.title, meta.formText, meta.href, meta.aria].filter(Boolean).join(' ');
  return DANGEROUS_ACTIONS.test(label);
}

export function redactForLog(value) {
  return String(value || '')
    .replace(/(?:sk|rk|pk)_[A-Za-z0-9_-]{12,}/g, '[REDACTED_KEY]')
    .replace(/(?:Bearer\s+)[A-Za-z0-9._-]{12,}/gi, '[REDACTED_TOKEN]')
    .replace(/((?:api[_ -]?key|password|token|secret)\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
    .slice(0, 1500);
}

export function assertLocalRequest(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const hostname = host.split(':')[0].replace(/^\[|\]$/g, '');
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error('Local access only');
  }
  const origin = String(req.headers.origin || '');
  if (origin) {
    let parsed;
    try { parsed = new URL(origin); }
    catch { throw new Error('Invalid browser origin'); }
    if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
      parsed.host !== host || parsed.protocol !== 'http:') {
      throw new Error('Cross-origin requests are blocked');
    }
  }
  const destination = String(req.headers['sec-fetch-site'] || '');
  if (destination && !['same-origin', 'none'].includes(destination)) {
    throw new Error('Cross-site requests are blocked');
  }
}
