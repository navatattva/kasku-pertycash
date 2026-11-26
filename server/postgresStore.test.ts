import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPoolOptions,
  getPostgresConnectionConfig,
} from './postgresStore.ts';

test('getPostgresConnectionConfig resolves DATABASE_URL and DATABASE_URL_UNPOOLED safely', () => {
  const prevDb = process.env.DATABASE_URL;
  const prevUnpooled = process.env.DATABASE_URL_UNPOOLED;
  const prevDirect = process.env.DIRECT_URL;

  try {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_UNPOOLED;
    delete process.env.DIRECT_URL;
    assert.deepEqual(getPostgresConnectionConfig(), {
      enabled: false,
      pooledUrl: '',
      directUrl: '',
    });

    process.env.DATABASE_URL =
      'postgresql://neondb_owner:secret@ep-demo-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
    process.env.DATABASE_URL_UNPOOLED =
      'postgresql://neondb_owner:secret@ep-demo.us-east-2.aws.neon.tech/neondb?sslmode=require';

    const cfg = getPostgresConnectionConfig();
    assert.equal(cfg.enabled, true);
    assert.ok(cfg.pooledUrl.includes('-pooler.'));
    assert.ok(!cfg.directUrl.includes('-pooler.'));
  } finally {
    if (prevDb !== undefined) process.env.DATABASE_URL = prevDb;
    else delete process.env.DATABASE_URL;
    if (prevUnpooled !== undefined)
      process.env.DATABASE_URL_UNPOOLED = prevUnpooled;
    else delete process.env.DATABASE_URL_UNPOOLED;
    if (prevDirect !== undefined) process.env.DIRECT_URL = prevDirect;
    else delete process.env.DIRECT_URL;
  }
});

test('buildPoolOptions enforces strict TLS on Neon hosts and respects local/disable modes', () => {
  const neonOpts = buildPoolOptions(
    'postgresql://user:pass@ep-cool-sun-123.us-east-2.aws.neon.tech/neondb?sslmode=require'
  );
  assert.ok(neonOpts.connectionString?.includes('sslmode=verify-full'));
  assert.deepEqual(neonOpts.ssl, { rejectUnauthorized: true });
  assert.equal(neonOpts.max, 10);

  const localOpts = buildPoolOptions('postgresql://postgres:postgres@localhost:5432/kasku');
  assert.equal(localOpts.ssl, undefined);

  const disabledOpts = buildPoolOptions(
    'postgresql://postgres:postgres@db.internal:5432/kasku?sslmode=disable'
  );
  assert.equal(disabledOpts.ssl, false);
});
