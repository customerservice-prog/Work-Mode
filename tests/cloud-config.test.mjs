import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCloudRequirements, cloudRequirements } from '../lib/cloud-config.js';

const base={
  WORKMODE_CLOUD_MODE:'1', NODE_ENV:'production',
  WORKMODE_DATA_DIR:'/data', OPENAI_API_KEY:'test-only-api-key',
  RAILWAY_PROJECT_ID:'railway-project', RAILWAY_VOLUME_MOUNT_PATH:'/data'
};
test('Railway cloud mode requires attached persistent volume, but AI access can be configured later',()=>{
  assert.deepEqual(cloudRequirements(base),{
    aiConfigured:true,dataDirectoryConfigured:true,volumeAttached:true,platform:'railway'
  });
  assert.doesNotThrow(()=>assertCloudRequirements(base));
  assert.throws(()=>assertCloudRequirements({...base, RAILWAY_VOLUME_MOUNT_PATH:''}),/Railway volume/);
  assert.throws(()=>assertCloudRequirements({...base, RAILWAY_VOLUME_MOUNT_PATH:'/other'}),/Railway volume/);
  assert.doesNotThrow(()=>assertCloudRequirements({...base, OPENAI_API_KEY:''}));
  assert.equal(cloudRequirements({...base,OPENAI_API_KEY:''}).aiConfigured,false);
  assert.throws(()=>assertCloudRequirements({...base, WORKMODE_DATA_DIR:''}),/WORKMODE_DATA_DIR/);
  assert.throws(()=>assertCloudRequirements({...base, WORKMODE_DATA_DIR:'relative'}),/WORKMODE_DATA_DIR/);
});
test('Other hosts require an explicit persistent-storage confirmation',()=>{
  const {RAILWAY_PROJECT_ID,RAILWAY_VOLUME_MOUNT_PATH,...other}=base;
  assert.equal(cloudRequirements(other).volumeAttached,false);
  assert.throws(()=>assertCloudRequirements(other),/PERSISTENCE_ACK/);
  assert.doesNotThrow(()=>assertCloudRequirements({...other,WORKMODE_PERSISTENCE_ACK:'1'}));
  assert.doesNotThrow(()=>assertCloudRequirements({...other,WORKMODE_CLOUD_MODE:'0'}));
  assert.doesNotThrow(()=>assertCloudRequirements({...other,NODE_ENV:'test'}));
});
