/*
 * Minimal database access for the nightly scripts (service key, server side only).
 * The browser never uses this: it only inserts through the anon key.
 */
export interface DbEnv {
  url: string;
  key: string;
}

export function dbEnv(env = process.env): DbEnv | null {
  return env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY ? { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY } : null;
}

const headers = (db: DbEnv, extra: Record<string, string> = {}) => ({ apikey: db.key, authorization: `Bearer ${db.key}`, ...extra });

export async function fetchAll<T>(db: DbEnv, table: string, query: string): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(`${db.url}/rest/v1/${table}?${query}`, { headers: headers(db, { range: `${from}-${from + page - 1}`, 'range-unit': 'items' }) });
    if (!res.ok) throw new Error(`${table} ${res.status}: ${await res.text()}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

export async function patchRow(db: DbEnv, table: string, id: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${db.url}/rest/v1/${table}?id=eq.${id}`, { method: 'PATCH', headers: headers(db, { 'content-type': 'application/json', prefer: 'return=minimal' }), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${table} patch ${res.status}: ${await res.text()}`);
}

export async function deleteRow(db: DbEnv, table: string, id: string): Promise<void> {
  const res = await fetch(`${db.url}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: headers(db, { prefer: 'return=minimal' }) });
  if (!res.ok) throw new Error(`${table} delete ${res.status}: ${await res.text()}`);
}
