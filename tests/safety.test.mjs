import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivateIp, assertPublicUrl, isSecretField, isHighImpactAction,
  assertLocalRequest, redactForLog
} from '../lib/safety.js';

test('rejects internal hosts and unsupported protocols', () => {
  for (const url of ['file:///etc/passwd', 'http://localhost:3000', 'http://127.0.0.1',
    'http://192.168.0.1', 'http://10.1.2.3', 'http://169.254.169.254',
    'http://metadata.google.internal', 'http://[::1]/', 'http://2130706433/']) {
    assert.throws(() => assertPublicUrl(url), url);
  }
  assert.equal(assertPublicUrl('https://www.google.com/'), 'https://www.google.com/');
});

test('private address checks include mapped IPv4', () => {
  assert.equal(isPrivateIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateIp('192.168.1.5'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);
});

test('high-impact actions require approval', () => {
  for (const label of ['Release number', 'Confirm', 'Save settings', 'Send message', 'Delete account', 'Submit payment']) {
    assert.equal(isHighImpactAction({ label }), true, label);
  }
  assert.equal(isHighImpactAction({ label: 'Search websites' }), false);
  assert.equal(isHighImpactAction({ label: '', type: 'submit' }), true);
});

test('secret fields are blocked', () => {
  assert.equal(isSecretField({ type: 'password' }), true);
  assert.equal(isSecretField({ auto: 'one-time-code' }), true);
  assert.equal(isSecretField({ name: 'cc-number' }), true);
  assert.equal(isSecretField({ label: 'Google Voice phone number' }), false);
});

test('local API rejects external origins and hostname rebinding', () => {
  const req = host => ({ headers: { host } });
  assert.doesNotThrow(() => assertLocalRequest(req('127.0.0.1:3168')));
  assert.throws(() => assertLocalRequest(req('example.com:3168')));
  assert.throws(() => assertLocalRequest({ headers: { host: '127.0.0.1:3168', origin: 'https://evil.example' } }));
  assert.doesNotThrow(() => assertLocalRequest({ headers: { host: '127.0.0.1:3168', origin: 'http://127.0.0.1:3168' } }));
});

test('sensitive values are redacted in logs', () => {
  assert.match(redactForLog('api_key=abcd1234'), /\[REDACTED\]/);
  assert.doesNotMatch(redactForLog('password=hunter2'), /hunter2/);
});
