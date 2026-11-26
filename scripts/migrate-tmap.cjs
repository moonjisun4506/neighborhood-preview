require('@next/env').loadEnvConfig(process.cwd());const {neon}=require('@neondatabase/serverless');
(async()=>{try{const sql=neon(process.env.DATABASE_URL);await sql.transaction([
 sql`CREATE TABLE IF NOT EXISTS np_tmap_cache (id text PRIMARY KEY, content jsonb NOT NULL, expires_at timestamptz NOT NULL)`,
 sql`CREATE TABLE IF NOT EXISTS np_tmap_daily (namespace text NOT NULL, day date NOT NULL, kind text NOT NULL, used integer NOT NULL DEFAULT 0, blocked boolean NOT NULL DEFAULT false, PRIMARY KEY(namespace,day,kind))`,
 sql`CREATE TABLE IF NOT EXISTS np_tmap_locks (id text PRIMARY KEY, until_at timestamptz NOT NULL)`,
 sql`ALTER TABLE np_tmap_locks ADD COLUMN IF NOT EXISTS token text`,
 sql`CREATE INDEX IF NOT EXISTS np_tmap_cache_expiry ON np_tmap_cache(expires_at)`]);console.log('TMAP cache/quota tables ready. No credentials printed.');}catch{console.error('TMAP DB initialization failed. Check DATABASE_URL and permissions.');process.exitCode=1;}})();
