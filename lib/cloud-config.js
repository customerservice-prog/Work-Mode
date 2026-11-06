import path from 'node:path';

export function cloudRequirements(env = process.env) {
  const dataRoot = String(env.WORKMODE_DATA_DIR || '').trim();
  const attachedMount = String(env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
  const isRailway = Boolean(env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID);
  const aiConfigured = Boolean(String(env.OPENAI_API_KEY || '').trim());
  const dataDirectoryConfigured = Boolean(dataRoot && path.isAbsolute(dataRoot));
  const volumeAttached = isRailway
    ? Boolean(attachedMount && dataDirectoryConfigured && path.resolve(attachedMount) === path.resolve(dataRoot))
    : Boolean(dataDirectoryConfigured && env.WORKMODE_PERSISTENCE_ACK === '1');
  return { aiConfigured, dataDirectoryConfigured, volumeAttached, platform:isRailway ? 'railway' : 'other' };
}

export function assertCloudRequirements(env = process.env) {
  if (env.WORKMODE_CLOUD_MODE !== '1') return;
  if (env.NODE_ENV === 'test') return;
  const checks = cloudRequirements(env);
  const missing = [];
  if (!checks.aiConfigured) missing.push('OPENAI_API_KEY');
  if (!checks.dataDirectoryConfigured) missing.push('WORKMODE_DATA_DIR (absolute persistent path)');
  if (!checks.volumeAttached) {
    missing.push(checks.platform === 'railway'
      ? 'Railway volume mounted at WORKMODE_DATA_DIR'
      : 'WORKMODE_PERSISTENCE_ACK=1 after verifying an encrypted persistent volume');
  }
  if (missing.length) {
    throw new Error('Cloud deployment not ready: ' + missing.join('; ') + '. The browser service will not start.');
  }
}
