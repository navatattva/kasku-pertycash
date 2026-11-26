import pg from 'pg';
import type { ActivityLogEntry } from '../src/types/pettycash.ts';
import type { PersistedDatabase } from './db.ts';
import { createSeedDatabase, CURRENT_SCHEMA_VERSION } from './seed.ts';

const { Pool } = pg;

type PoolType = InstanceType<typeof Pool>;

const COLLECTION_KEYS = [
  'departments',
  'employees',
  'categories',
  'vehicles',
  'requests',
  'topUps',
  'opnames',
  'downPayments',
  'dailyClosings',
  'closedPeriods',
  'taxModule',
  'forecastModule',
  'fraudGuard',
  'whatsappModule',
  'whatsappLogs',
  'rbacRoles',
  'authUsers',
  'authSessions',
  'securityPolicy',
] as const;

type CollectionKey = (typeof COLLECTION_KEYS)[number];

export interface PostgresConnectionConfig {
  enabled: boolean;
  pooledUrl: string;
  directUrl: string;
}

export function getPostgresConnectionConfig(): PostgresConnectionConfig {
  const pooledUrl = (process.env.DATABASE_URL ?? '').trim();
  const directUrl = (
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DIRECT_URL ??
    ''
  ).trim();
  return {
    enabled: Boolean(pooledUrl || directUrl),
    pooledUrl: pooledUrl || directUrl,
    directUrl: directUrl || pooledUrl,
  };
}

export function buildPoolOptions(rawUrl: string, maxConnections = 10): pg.PoolConfig {
  let normalizedUrl = rawUrl.trim();
  let sslOption: pg.PoolConfig['ssl'];

  try {
    const parsed = new URL(normalizedUrl);
    const hostname = parsed.hostname.toLowerCase();
    const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1';

    if (sslMode === 'disable') {
      sslOption = false;
    } else if (sslMode === 'no-verify') {
      parsed.searchParams.delete('sslmode');
      normalizedUrl = parsed.toString();
      sslOption = { rejectUnauthorized: false };
    } else if (sslMode === 'require' && hostname.endsWith('.neon.tech')) {
      parsed.searchParams.set('sslmode', 'verify-full');
      normalizedUrl = parsed.toString();
      sslOption = { rejectUnauthorized: true };
    } else if (!isLocal && !sslMode) {
      sslOption = { rejectUnauthorized: true };
    }
  } catch {
    // Keep original connectionString if URL parsing fails; Pool will validate on connect
  }

  return {
    connectionString: normalizedUrl,
    ...(sslOption !== undefined ? { ssl: sslOption } : {}),
    max: maxConnections,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  };
}

let runtimePool: PoolType | null = null;
let activePoolUrl = '';
let initializedSchemaForUrl = '';
let persistQueue: Promise<void> = Promise.resolve();
let lastPersistedCollections = new Map<CollectionKey, string>();
let lastPersistedMetaKey = '';
let lastPersistedActivitySequences = new Set<number>();
let lastPersistError: string | null = null;

function getRuntimePool(pooledUrl: string): PoolType {
  if (runtimePool && activePoolUrl === pooledUrl) {
    return runtimePool;
  }
  if (runtimePool) {
    void runtimePool.end().catch(() => {});
    runtimePool = null;
  }
  const pool = new Pool(buildPoolOptions(pooledUrl, 10));
  pool.on('error', (err) => {
    const msg = err instanceof Error ? err.message : 'Unknown pool error';
    lastPersistError = msg;
    console.error('[KasKu Kargo][Postgres] Idle pool error:', msg);
  });
  runtimePool = pool;
  activePoolUrl = pooledUrl;
  return pool;
}

async function ensureSchemaTables(directUrl: string): Promise<void> {
  if (initializedSchemaForUrl === directUrl) {
    return;
  }

  const ddlPool = new Pool(buildPoolOptions(directUrl, 2));
  ddlPool.on('error', () => {});

  try {
    await ddlPool.query(`
      CREATE TABLE IF NOT EXISTS kasku_state_meta (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        sequence_counter INTEGER NOT NULL,
        opname_counter INTEGER NOT NULL,
        dp_counter INTEGER NOT NULL,
        closing_counter INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await ddlPool.query(`
      CREATE TABLE IF NOT EXISTS kasku_collections (
        collection_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await ddlPool.query(`
      CREATE TABLE IF NOT EXISTS kasku_activity_logs (
        sequence INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        timestamp TIMESTAMPTZ NOT NULL,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        entry_hash TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        record JSONB NOT NULL
      );
    `);

    await ddlPool.query(`
      CREATE INDEX IF NOT EXISTS idx_kasku_activity_logs_ts
      ON kasku_activity_logs (timestamp DESC);
    `);

    initializedSchemaForUrl = directUrl;
  } finally {
    await ddlPool.end().catch(() => {});
  }
}

function validateLoadedDatabase(candidate: unknown): candidate is PersistedDatabase {
  if (!candidate || typeof candidate !== 'object') return false;
  const parsed = candidate as PersistedDatabase;
  return (
    parsed.schemaVersion === CURRENT_SCHEMA_VERSION &&
    Array.isArray(parsed.departments) &&
    Array.isArray(parsed.employees) &&
    Array.isArray(parsed.categories) &&
    Array.isArray(parsed.vehicles) &&
    Array.isArray(parsed.requests) &&
    Array.isArray(parsed.topUps) &&
    Array.isArray(parsed.opnames) &&
    Array.isArray(parsed.downPayments) &&
    Array.isArray(parsed.dailyClosings) &&
    Array.isArray(parsed.closedPeriods) &&
    Boolean(parsed.taxModule) &&
    typeof parsed.taxModule.enabled === 'boolean' &&
    Boolean(parsed.forecastModule) &&
    typeof parsed.forecastModule.enabled === 'boolean' &&
    Boolean(parsed.fraudGuard) &&
    typeof parsed.fraudGuard.enabled === 'boolean' &&
    Boolean(parsed.whatsappModule) &&
    typeof parsed.whatsappModule.enabled === 'boolean' &&
    Array.isArray(parsed.whatsappLogs) &&
    Array.isArray(parsed.activityLogs) &&
    Array.isArray(parsed.rbacRoles) &&
    Array.isArray(parsed.authUsers) &&
    Array.isArray(parsed.authSessions) &&
    Boolean(parsed.securityPolicy)
  );
}

function snapshotCollectionCache(db: PersistedDatabase): void {
  lastPersistedCollections = new Map();
  for (const key of COLLECTION_KEYS) {
    lastPersistedCollections.set(key, JSON.stringify(db[key]));
  }
  lastPersistedMetaKey = `${db.schemaVersion}:${db.sequenceCounter}:${db.opnameCounter}:${db.dpCounter}:${db.closingCounter}`;
  lastPersistedActivitySequences = new Set(
    db.activityLogs.map((entry) => entry.sequence)
  );
}

async function writeFullSeedToPostgres(
  pool: PoolType,
  db: PersistedDatabase
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
      INSERT INTO kasku_state_meta (
        id, schema_version, sequence_counter, opname_counter, dp_counter, closing_counter, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET
        schema_version = EXCLUDED.schema_version,
        sequence_counter = EXCLUDED.sequence_counter,
        opname_counter = EXCLUDED.opname_counter,
        dp_counter = EXCLUDED.dp_counter,
        closing_counter = EXCLUDED.closing_counter,
        updated_at = NOW()
      `,
      [
        'main',
        db.schemaVersion,
        db.sequenceCounter,
        db.opnameCounter,
        db.dpCounter,
        db.closingCounter,
      ]
    );

    for (const key of COLLECTION_KEYS) {
      const serialized = JSON.stringify(db[key]);
      await client.query(
        `
        INSERT INTO kasku_collections (collection_key, payload, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (collection_key) DO UPDATE SET
          payload = EXCLUDED.payload,
          updated_at = NOW()
        `,
        [key, serialized]
      );
    }

    for (const entry of db.activityLogs) {
      await client.query(
        `
        INSERT INTO kasku_activity_logs (
          sequence, id, timestamp, category, action, actor_name, actor_role,
          target_type, target_id, entry_hash, prev_hash, record
        ) VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
        ON CONFLICT (sequence) DO UPDATE SET
          id = EXCLUDED.id,
          timestamp = EXCLUDED.timestamp,
          category = EXCLUDED.category,
          action = EXCLUDED.action,
          actor_name = EXCLUDED.actor_name,
          actor_role = EXCLUDED.actor_role,
          target_type = EXCLUDED.target_type,
          target_id = EXCLUDED.target_id,
          entry_hash = EXCLUDED.entry_hash,
          prev_hash = EXCLUDED.prev_hash,
          record = EXCLUDED.record
        `,
        [
          entry.sequence,
          entry.id,
          entry.timestamp,
          entry.entityType,
          entry.actionType,
          entry.actorName,
          entry.actorRole,
          entry.entityType,
          entry.entityId,
          entry.entryHash,
          entry.previousHash,
          JSON.stringify(entry),
        ]
      );
    }

    await client.query('COMMIT');
    snapshotCollectionCache(db);
    lastPersistError = null;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function initPostgresDatabase(): Promise<PersistedDatabase> {
  const cfg = getPostgresConnectionConfig();
  if (!cfg.enabled) {
    throw new Error('DATABASE_URL is not configured.');
  }

  await ensureSchemaTables(cfg.directUrl);
  const pool = getRuntimePool(cfg.pooledUrl);

  const metaRes = await pool.query<{
    schema_version: number;
    sequence_counter: number;
    opname_counter: number;
    dp_counter: number;
    closing_counter: number;
  }>(
    `SELECT schema_version, sequence_counter, opname_counter, dp_counter, closing_counter
     FROM kasku_state_meta
     WHERE id = $1`,
    ['main']
  );

  if (metaRes.rows.length === 0) {
    const seed = createSeedDatabase();
    await writeFullSeedToPostgres(pool, seed);
    return seed;
  }

  const meta = metaRes.rows[0];
  const [collectionsRes, logsRes] = await Promise.all([
    pool.query<{ collection_key: string; payload: unknown }>(
      `SELECT collection_key, payload FROM kasku_collections`
    ),
    pool.query<{ record: ActivityLogEntry }>(
      `SELECT record FROM kasku_activity_logs ORDER BY sequence DESC`
    ),
  ]);

  const rawMap: Record<string, unknown> = {};
  for (const row of collectionsRes.rows) {
    rawMap[row.collection_key] = row.payload;
  }

  const candidate: Record<string, unknown> = {
    schemaVersion: meta.schema_version,
    sequenceCounter: meta.sequence_counter,
    opnameCounter: meta.opname_counter,
    dpCounter: meta.dp_counter,
    closingCounter: meta.closing_counter,
    activityLogs: logsRes.rows.map((r) => r.record),
  };

  for (const key of COLLECTION_KEYS) {
    candidate[key] = rawMap[key];
  }

  if (!validateLoadedDatabase(candidate)) {
    const seed = createSeedDatabase();
    await writeFullSeedToPostgres(pool, seed);
    return seed;
  }

  snapshotCollectionCache(candidate);
  lastPersistError = null;
  return candidate;
}

function cloneDbForAsyncPersist(db: PersistedDatabase): {
  meta: {
    schemaVersion: number;
    sequenceCounter: number;
    opnameCounter: number;
    dpCounter: number;
    closingCounter: number;
    key: string;
  };
  collections: Array<{ key: CollectionKey; json: string }>;
  newActivityLogs: ActivityLogEntry[];
} {
  const collections = COLLECTION_KEYS.map((key) => ({
    key,
    json: JSON.stringify(db[key]),
  }));
  const newActivityLogs = db.activityLogs.filter(
    (entry) => !lastPersistedActivitySequences.has(entry.sequence)
  );
  return {
    meta: {
      schemaVersion: db.schemaVersion,
      sequenceCounter: db.sequenceCounter,
      opnameCounter: db.opnameCounter,
      dpCounter: db.dpCounter,
      closingCounter: db.closingCounter,
      key: `${db.schemaVersion}:${db.sequenceCounter}:${db.opnameCounter}:${db.dpCounter}:${db.closingCounter}`,
    },
    collections,
    newActivityLogs: newActivityLogs.map((e) => ({ ...e })),
  };
}

export function schedulePostgresPersist(db: PersistedDatabase): void {
  const cfg = getPostgresConnectionConfig();
  if (!cfg.enabled) return;

  const snapshot = cloneDbForAsyncPersist(db);
  persistQueue = persistQueue
    .then(async () => {
      const pool = getRuntimePool(cfg.pooledUrl);
      const changedCollections = snapshot.collections.filter(
        ({ key, json }) => lastPersistedCollections.get(key) !== json
      );
      const metaChanged = snapshot.meta.key !== lastPersistedMetaKey;

      if (
        changedCollections.length === 0 &&
        !metaChanged &&
        snapshot.newActivityLogs.length === 0
      ) {
        return;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        if (metaChanged) {
          await client.query(
            `
            INSERT INTO kasku_state_meta (
              id, schema_version, sequence_counter, opname_counter, dp_counter, closing_counter, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (id) DO UPDATE SET
              schema_version = EXCLUDED.schema_version,
              sequence_counter = EXCLUDED.sequence_counter,
              opname_counter = EXCLUDED.opname_counter,
              dp_counter = EXCLUDED.dp_counter,
              closing_counter = EXCLUDED.closing_counter,
              updated_at = NOW()
            `,
            [
              'main',
              snapshot.meta.schemaVersion,
              snapshot.meta.sequenceCounter,
              snapshot.meta.opnameCounter,
              snapshot.meta.dpCounter,
              snapshot.meta.closingCounter,
            ]
          );
        }

        for (const col of changedCollections) {
          await client.query(
            `
            INSERT INTO kasku_collections (collection_key, payload, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (collection_key) DO UPDATE SET
              payload = EXCLUDED.payload,
              updated_at = NOW()
            `,
            [col.key, col.json]
          );
        }

        for (const entry of snapshot.newActivityLogs) {
          await client.query(
            `
            INSERT INTO kasku_activity_logs (
              sequence, id, timestamp, category, action, actor_name, actor_role,
              target_type, target_id, entry_hash, prev_hash, record
            ) VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
            ON CONFLICT (sequence) DO NOTHING
            `,
            [
              entry.sequence,
              entry.id,
              entry.timestamp,
              entry.entityType,
              entry.actionType,
              entry.actorName,
              entry.actorRole,
              entry.entityType,
              entry.entityId,
              entry.entryHash,
              entry.previousHash,
              JSON.stringify(entry),
            ]
          );
        }

        await client.query('COMMIT');

        if (metaChanged) {
          lastPersistedMetaKey = snapshot.meta.key;
        }
        for (const col of changedCollections) {
          lastPersistedCollections.set(col.key, col.json);
        }
        for (const entry of snapshot.newActivityLogs) {
          lastPersistedActivitySequences.add(entry.sequence);
        }
        lastPersistError = null;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const msg = err instanceof Error ? err.message : 'Postgres persist error';
        lastPersistError = msg;
        console.error('[KasKu Kargo][Postgres] Failed to persist state:', msg);
      } finally {
        client.release();
      }
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : 'Postgres queue error';
      lastPersistError = msg;
      console.error('[KasKu Kargo][Postgres] Persist queue error:', msg);
    });
}

export async function flushPostgresWrites(): Promise<void> {
  await persistQueue;
}

export async function checkPostgresHealth(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const cfg = getPostgresConnectionConfig();
  if (!cfg.enabled) {
    return { ok: true };
  }
  try {
    const pool = getRuntimePool(cfg.pooledUrl);
    await pool.query('SELECT 1');
    if (lastPersistError) {
      return { ok: false, error: lastPersistError };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Database connection error',
    };
  }
}

export async function closePostgresPool(): Promise<void> {
  await flushPostgresWrites();
  if (runtimePool) {
    const poolToClose = runtimePool;
    runtimePool = null;
    activePoolUrl = '';
    await poolToClose.end().catch(() => {});
  }
}
