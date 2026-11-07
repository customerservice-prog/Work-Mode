import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const SESSION_TTL = 12 * 60 * 60 * 1000;
const COOKIE_NAME = '__Host-workmode';
const cookieAttributes = 'HttpOnly; Secure; SameSite=Strict; Path=/';
const safeEqual = (a,b) => {
  const left = createHash('sha256').update(String(a)).digest();
  const right = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(left, right);
};
const parseCookie = (raw) => {
  for (const part of String(raw || '').split(';')) {
    const [name, ...pieces] = part.trim().split('=');
    if (name === COOKIE_NAME) return pieces.join('=').trim();
  }
  return null;
};

export function createHostedAuth(config) {
  const enabled = config.enabled === true;
  if (!enabled) return { enabled: false, middleware: (_req,_res,next) => next(), register: () => {} };
  const origin = new URL(String(config.origin || ''));
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('WORKMODE_CLOUD_ORIGIN must be a bare HTTPS origin (for example https://example.com)');
  }
  const password = String(config.password || '');
  const secret = String(config.secret || '');
  if (password.length < 16 || secret.length < 32) {
    throw new Error('Cloud mode requires WORKMODE_CLOUD_PASSWORD (16+ characters) and WORKMODE_SESSION_SECRET (32+ characters)');
  }
  const sessions = new Map();
  const attempts = new Map();
  const now = config.now || (() => Date.now());

  function currentSession(req) {
    const id = parseCookie(req.headers.cookie);
    if (!id || !/^[A-Za-z0-9_-]{32,100}$/.test(id)) return null;
    const session = sessions.get(createHash('sha256').update(secret + id).digest('hex'));
    if (!session || session.expires <= now()) return null;
    return session;
  }
  function ownOrigin(req) {
    const host = String(req.headers.host || '').toLowerCase();
    if (host !== origin.host.toLowerCase()) return false;
    const requestedOrigin = String(req.headers.origin || '');
    if (requestedOrigin && requestedOrigin !== origin.origin) return false;
    const fetchSite = String(req.headers['sec-fetch-site'] || '');
    if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) {
      // Opening a link from ChatGPT, email, or a search result is a
      // cross-site top-level GET navigation. It is safe to show the login
      // page, but cross-site API requests and all writes must stay blocked.
      const publicNavigation = req.method === 'GET'
        && (req.path === '/' || req.path === '/login')
        && req.headers['sec-fetch-mode'] === 'navigate'
        && req.headers['sec-fetch-dest'] === 'document'
        && !requestedOrigin;
      if (!publicNavigation) return false;
    }
    return true;
  }
  function throttleKey(req) {
    return String(req.socket?.remoteAddress || 'unknown').slice(0, 150);
  }
  function login(req,res) {
    if (!ownOrigin(req)) return res.status(403).json({ error: 'Invalid origin' });
    const key = throttleKey(req);
    const entry = attempts.get(key) || { count: 0, until: now() + FIFTEEN_MINUTES };
    if (entry.until <= now()) { entry.count = 0; entry.until = now() + FIFTEEN_MINUTES; }
    if (entry.count >= 8) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    const input = String(req.body?.password || '');
    if (input.length > 500 || !safeEqual(input, password)) {
      entry.count++;
      attempts.set(key, entry);
      return res.status(401).json({ error: 'Incorrect password' });
    }
    attempts.delete(key);
    const id = randomBytes(36).toString('base64url');
    const hash = createHash('sha256').update(secret + id).digest('hex');
    sessions.set(hash, { expires: now() + SESSION_TTL });
    if (sessions.size > 300) {
      for (const [k,v] of sessions) if (v.expires < now()) sessions.delete(k);
    }
    res.setHeader('Set-Cookie', COOKIE_NAME + '=' + id + '; Max-Age=43200; ' + cookieAttributes);
    res.set('Cache-Control','no-store').json({ ok: true, authenticated: true });
  }
  function logout(req,res) {
    const id = parseCookie(req.headers.cookie);
    if (id) sessions.delete(createHash('sha256').update(secret + id).digest('hex'));
    res.setHeader('Set-Cookie',COOKIE_NAME + '=; Max-Age=0; ' + cookieAttributes);
    res.set('Cache-Control','no-store').json({ ok: true });
  }
  function middleware(req,res,next) {
    // Generic health checks must work from the hosting provider's private
    // network address, which may not set the public hostname as Host.
    if (req.method === 'GET' && req.path === '/api/health') return next();
    if (!ownOrigin(req)) return res.status(403).send('Forbidden origin');
    if (req.method === 'GET' && ['/login','/manifest.webmanifest','/sw.js','/icons/work-mode.svg'].includes(req.path)) return next();
    if (req.path === '/api/auth/session' && req.method === 'GET') {
      return res.set('Cache-Control','no-store').json({ authenticated: Boolean(currentSession(req)), hosted: true });
    }
    if (req.path === '/api/auth/login' && req.method === 'POST') return login(req,res);
    if (!currentSession(req)) {
      if (req.path.startsWith('/api/')) return res.status(401).json({ error:'Sign in to Work-Mode first',loginRequired:true });
      return res.redirect(302,'/login');
    }
    if (req.path === '/api/auth/logout' && req.method === 'POST') return logout(req,res);
    next();
  }

  return { enabled, middleware, currentSession, origin: origin.origin, register: () => {} };
}
