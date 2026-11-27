import {neon} from '@neondatabase/serverless';
import type {AddressRecord} from './demo-data';
import type {AiSummary} from './ai-summary';
import {cleanAddress,validAddress} from './saved.server';
// Data access layer for signed-in users. Every query is scoped by the user id taken from the session row.
const db=()=>{if(!process.env.DATABASE_URL)throw new Error('DB configuration');return neon(process.env.DATABASE_URL);};

export async function listUserSaved(userId:string){
  const sql=db();
  await sql`DELETE FROM np_user_summaries WHERE user_id=${userId}::uuid AND content ? 'expiresAt' AND (content->>'expiresAt')::timestamptz<=now()`;
  return sql`SELECT a.address,a.memo,a.created_at,s.content AS ai_summary FROM np_user_addresses a LEFT JOIN np_user_summaries s ON s.user_id=a.user_id AND s.address_id=a.address_id WHERE a.user_id=${userId}::uuid ORDER BY a.created_at,a.address_id`;
}
export async function putUserSaved(userId:string,address:AddressRecord,memo:string){
  await db()`INSERT INTO np_user_addresses(user_id,address_id,address,memo) VALUES(${userId}::uuid,${address.id},${JSON.stringify(cleanAddress(address))}::jsonb,${memo}) ON CONFLICT(user_id,address_id) DO UPDATE SET address=EXCLUDED.address,memo=EXCLUDED.memo,updated_at=now()`;
}
export async function deleteUserSaved(userId:string,addressId:string){await db()`DELETE FROM np_user_addresses WHERE user_id=${userId}::uuid AND address_id=${addressId}`;}
/** The generation must belong to this device's anonymous generator and the address to this account. */
export async function saveUserGeneration(userId:string,generatorOwner:string,generationId:string,addressId:string){
  const rows=await db()`INSERT INTO np_user_summaries(user_id,address_id,generation_id,content) SELECT ${userId}::uuid,${addressId},g.id,g.result FROM np_ai_generations g JOIN np_user_addresses a ON a.user_id=${userId}::uuid AND a.address_id=${addressId} WHERE g.id=${generationId}::uuid AND g.owner_hash=${generatorOwner} AND g.expires_at>now() AND g.result IS NOT NULL AND jsonb_array_length(g.address_ids)=1 AND g.address_ids->>0=${addressId} ON CONFLICT(user_id,address_id) DO UPDATE SET generation_id=EXCLUDED.generation_id,content=EXCLUDED.content,updated_at=now() RETURNING content`;
  return rows[0]?.content as AiSummary|undefined;
}

// --- Synced settings: destination, commute days, comparison selection, search radius ---
export type AccountSettings={destinationLocation:AddressRecord|null;commuteDays:number;commuteRoundTrip:boolean;compare:string[];radius:300|500|1000};
export function validSettings(value:unknown):value is AccountSettings{
  if(!value||typeof value!=='object')return false;const s=value as AccountSettings;
  return (s.destinationLocation===null||(validAddress(s.destinationLocation)&&s.destinationLocation.source==='kakao'&&!!s.destinationLocation.coordinates))&&Number.isInteger(s.commuteDays)&&s.commuteDays>=0&&s.commuteDays<=31&&typeof s.commuteRoundTrip==='boolean'&&Array.isArray(s.compare)&&s.compare.length<=3&&s.compare.every(id=>typeof id==='string'&&id.length>0&&id.length<=200)&&[300,500,1000].includes(s.radius);
}
export async function getSettings(userId:string){const rows=await db()`SELECT settings,updated_at FROM np_user_settings WHERE user_id=${userId}::uuid`;return rows[0]?{settings:rows[0].settings as AccountSettings,updatedAt:new Date(rows[0].updated_at).toISOString()}:null;}
export async function putSettings(userId:string,s:AccountSettings){
  const clean:AccountSettings={destinationLocation:s.destinationLocation?cleanAddress(s.destinationLocation):null,commuteDays:s.commuteDays,commuteRoundTrip:s.commuteRoundTrip,compare:[...new Set(s.compare)],radius:s.radius};
  await db()`INSERT INTO np_user_settings(user_id,settings) VALUES(${userId}::uuid,${JSON.stringify(clean)}::jsonb) ON CONFLICT(user_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=now()`;
}

// --- Importing this device's anonymous box (copy only; the anonymous rows stay untouched) ---
export async function importPreview(userId:string,owner:string){
  const sql=db();const claim=await sql`SELECT user_id::text FROM np_anonymous_claims WHERE owner_hash=${owner}`;
  if(claim.length&&claim[0].user_id!==userId)return {status:'claimed' as const,newAddresses:0,duplicates:0,summaries:0};
  const rows=await sql`SELECT count(*) FILTER (WHERE u.address_id IS NULL)::int AS fresh,count(*) FILTER (WHERE u.address_id IS NOT NULL)::int AS dup,count(s.address_id) FILTER (WHERE u.address_id IS NULL)::int AS summaries FROM np_saved_addresses a LEFT JOIN np_user_addresses u ON u.user_id=${userId}::uuid AND u.address_id=a.address_id LEFT JOIN np_address_summaries s ON s.owner_hash=a.owner_hash AND s.address_id=a.address_id WHERE a.owner_hash=${owner}`;
  return {status:'ok' as const,newAddresses:rows[0].fresh as number,duplicates:rows[0].dup as number,summaries:rows[0].summaries as number};
}
export async function importAnonymous(userId:string,owner:string){
  const sql=db();
  // One anonymous box can belong to one account only, so a shared device never merges two people's data.
  const claim=await sql`INSERT INTO np_anonymous_claims(owner_hash,user_id) VALUES(${owner},${userId}::uuid) ON CONFLICT(owner_hash) DO UPDATE SET claimed_at=now() WHERE np_anonymous_claims.user_id=EXCLUDED.user_id RETURNING user_id`;
  if(!claim.length)return null;
  const [added,memos,summaries]=await sql.transaction([
    // Existing account records win; duplicates are skipped instead of overwritten.
    sql`INSERT INTO np_user_addresses(user_id,address_id,address,memo,created_at) SELECT ${userId}::uuid,a.address_id,a.address,a.memo,a.created_at FROM np_saved_addresses a WHERE a.owner_hash=${owner} ON CONFLICT(user_id,address_id) DO NOTHING RETURNING address_id`,
    // A duplicate address only receives the device memo when the account memo is empty.
    sql`UPDATE np_user_addresses u SET memo=a.memo,updated_at=now() FROM np_saved_addresses a WHERE a.owner_hash=${owner} AND u.user_id=${userId}::uuid AND u.address_id=a.address_id AND u.memo='' AND a.memo<>'' RETURNING u.address_id`,
    sql`INSERT INTO np_user_summaries(user_id,address_id,generation_id,content,updated_at) SELECT ${userId}::uuid,s.address_id,s.generation_id,s.content,s.updated_at FROM np_address_summaries s JOIN np_user_addresses u ON u.user_id=${userId}::uuid AND u.address_id=s.address_id WHERE s.owner_hash=${owner} AND NOT (s.content ? 'expiresAt' AND (s.content->>'expiresAt')::timestamptz<=now()) ON CONFLICT(user_id,address_id) DO NOTHING RETURNING address_id`,
  ]);
  await sql`UPDATE np_anonymous_claims SET imported_count=imported_count+${added.length} WHERE owner_hash=${owner}`;
  return {addresses:added.length,memos:memos.length,summaries:summaries.length};
}
