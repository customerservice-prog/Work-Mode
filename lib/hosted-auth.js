import { createHash, randomBytes, timingSafeEqual, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import path from 'node:path';

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
  const sessionFile = config.sessionFile ? path.resolve(config.sessionFile) : null;
  const passwordFile = config.passwordFile ? path.resolve(config.passwordFile) : null;
  let savedPassword = null;
  if (passwordFile) {
    try {
      const state=JSON.parse(readFileSync(passwordFile,'utf8'));
      if (!/^[A-Za-z0-9+/]{20,30}={0,2}$/.test(state.salt) ||
          !/^[A-Za-z0-9+/]{40,50}={0,2}$/.test(state.hash)) {
        throw Error('Invalid password format');
      }
      savedPassword={salt:Buffer.from(state.salt,'base64'),hash:Buffer.from(state.hash,'base64')};
      if (savedPassword.salt.length!==16 || savedPassword.hash.length!==32) throw Error('Invalid password length');
    } catch (err) {
      if (err.code!=='ENOENT') throw Error('Saved Work-Mode password configuration is unreadable; refusing insecure fallback');
    }
  }
  function passwordMatches(candidate) {
    if (!savedPassword) return safeEqual(candidate,password);
    const attempt=scryptSync(String(candidate),savedPassword.salt,32);
    return timingSafeEqual(attempt,savedPassword.hash);
  }

  // Keep only hashes of random cookie identifiers on the private persistent volume.
  // This prevents every Railway deployment from logging the owner out.
  if (sessionFile) {
    try {
      const saved = JSON.parse(readFileSync(sessionFile, 'utf8'));
      if (!saved || Array.isArray(saved) || typeof saved !== 'object') throw Error('Invalid session file format');
      for (const [key, expires] of Object.entries(saved)) {
        if (/^[a-f0-9]{64}$/.test(key) && Number.isFinite(expires) && expires > now() && expires <= now() + SESSION_TTL) {
          sessions.set(key, { expires });
        }
      }
    } catch (err) {
      if (err?.code !== 'ENOENT') console.error('Work-Mode session storage could not be read; existing sessions will require sign-in.');
    }
  }
  function persistSessions() {
    if (!sessionFile) return;
    const active = {};
    for (const [hash, session] of sessions) if (session.expires > now()) active[hash] = session.expires;
    mkdirSync(path.dirname(sessionFile), { recursive: true, mode: 0o700 });
    const temporaryFile = sessionFile + '.' + process.pid + '.tmp';
    writeFileSync(temporaryFile, JSON.stringify(active), { mode: 0o600 });
    renameSync(temporaryFile, sessionFile);
  }

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
    if (input.length > 500 || !passwordMatches(input)) {
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
    try { persistSessions(); }
    catch {
      sessions.delete(hash);
      return res.status(503).json({ error: 'Private login storage is unavailable; please try again later' });
    }
    res.setHeader('Set-Cookie', COOKIE_NAME + '=' + id + '; Max-Age=43200; ' + cookieAttributes);
    res.set('Cache-Control','no-store').json({ ok: true, authenticated: true });
  }
  function changePassword(req,res) {
    if (!passwordFile) return res.status(409).json({error:'Private password change is unavailable on this server'});
    const throttle=throttleKey(req);
    const failed=attempts.get(throttle)||{count:0,until:now()+FIFTEEN_MINUTES};
    if (failed.until<=now()) {failed.count=0;failed.until=now()+FIFTEEN_MINUTES;}
    if (failed.count>=8) return res.status(429).json({error:'Too many password attempts'});
    const current=String(req.body?.currentPassword||'');
    const replacement=String(req.body?.newPassword||'');
    if (!passwordMatches(current)) {
      failed.count++;attempts.set(throttle,failed);
      return res.status(401).json({error:'Current password was incorrect'});
    }
    if (replacement.length<20 || replacement.length>200 || replacement===current) {
      return res.status(400).json({error:'Choose a different password between 20 and 200 characters'});
    }
    const salt=randomBytes(16);
    const hash=scryptSync(replacement,salt,32);
    try {
      // Revoke all existing cookies before accepting a new credential.
      sessions.clear();
      persistSessions();
      mkdirSync(path.dirname(passwordFile),{recursive:true,mode:0o700});
      const temp=passwordFile+'.'+process.pid+'.tmp';
      writeFileSync(temp,JSON.stringify({salt:salt.toString('base64'),hash:hash.toString('base64')}),{mode:0o600});
      renameSync(temp,passwordFile);
      savedPassword={salt,hash};
      attempts.delete(throttle);
      res.setHeader('Set-Cookie',COOKIE_NAME+'=; Max-Age=0; '+cookieAttributes);
      return res.set('Cache-Control','no-store').json({ok:true,signInAgain:true});
    } catch {
      return res.status(503).json({error:'Could not securely save the new password'});
    }
  }
  function logout(req,res) {
    const id = parseCookie(req.headers.cookie);
    if (id) sessions.delete(createHash('sha256').update(secret + id).digest('hex'));
    try { persistSessions(); }
    catch { return res.status(503).json({ error: 'Private login storage is unavailable' }); }
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
    if (req.path === '/api/auth/change-password' && req.method === 'POST') return changePassword(req,res);
    next();
  }

  return { enabled, middleware, currentSession, origin: origin.origin, register: () => {} };
}
