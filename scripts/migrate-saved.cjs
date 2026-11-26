const fs=require('node:fs');const {neon}=require('@neondatabase/serverless');require('@next/env').loadEnvConfig(process.cwd());
(async()=>{try{
  if(!process.env.DATABASE_URL)throw new Error('missing');
  const sql=neon(process.env.DATABASE_URL);
  await sql.transaction([
    sql`CREATE TABLE IF NOT EXISTS np_anonymous_sessions (token_hash text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days')`,
    sql`CREATE TABLE IF NOT EXISTS np_saved_addresses (owner_hash text NOT NULL REFERENCES np_anonymous_sessions(token_hash) ON DELETE CASCADE, address_id text NOT NULL CHECK(length(address_id) BETWEEN 1 AND 200), address jsonb NOT NULL, memo text NOT NULL DEFAULT '' CHECK(length(memo)<=4000), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_hash,address_id))`,
    sql`CREATE INDEX IF NOT EXISTS np_sessions_expiry_idx ON np_anonymous_sessions(expires_at)`,
    sql`CREATE TABLE IF NOT EXISTS np_ai_generations (id uuid PRIMARY KEY, owner_hash text NOT NULL REFERENCES np_anonymous_sessions(token_hash) ON DELETE CASCADE, address_ids jsonb NOT NULL, result jsonb, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day')`,
    sql`CREATE INDEX IF NOT EXISTS np_ai_owner_time_idx ON np_ai_generations(owner_hash,created_at)`,
    sql`CREATE TABLE IF NOT EXISTS np_address_summaries (owner_hash text NOT NULL, address_id text NOT NULL, generation_id uuid NOT NULL, content jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_hash,address_id), FOREIGN KEY(owner_hash,address_id) REFERENCES np_saved_addresses(owner_hash,address_id) ON DELETE CASCADE)`
  ]);
  const path='.env.local';let content=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
  if(!/^DATABASE_URL=.+/m.test(content)){content=content.replace(/^DATABASE_URL=.*\r?\n?/m,'');fs.writeFileSync(path,content+'\n# Server-only Neon connection.\nDATABASE_URL='+JSON.stringify(process.env.DATABASE_URL)+'\n');}
  console.log('Neon connection: OK. Saved-address tables ready. DATABASE_URL configured in .env.local.');
}catch{console.error('Neon initialization failed. Check DATABASE_URL and database permissions. No credentials logged.');process.exitCode=1;}})();
