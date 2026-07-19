// 每日胜场排行榜 — Vercel serverless + Vercel KV (Upstash Redis)。
// 模式沿袭姊妹项目:KV 环境变量未配置时优雅降级(kvConfigured:false),
// 客户端安静地保持本地模式;在 Vercel 加 KV 集成即启用,零代码改动。
//
// GET  /api/leaderboard?date=YYYY-MM-DD          → 当日 top 50(胜场降序)
// POST /api/leaderboard  { date, name, wins }    → 上报当日胜场
//
// 分数 = 当日胜场(越高越好);每名字只保留最高值。

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const CONFIGURED = !!(KV_URL && KV_TOKEN);
const MAX_ROWS = 50;

async function kv(command) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`kv ${res.status}`);
  const json = await res.json();
  return json.result;
}

function safeDate(d) {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

async function topRows(date) {
  const flat = await kv(['ZRANGE', `wins:${date}`, '0', String(MAX_ROWS - 1), 'REV', 'WITHSCORES']);
  const rows = [];
  for (let i = 0; i < (flat?.length ?? 0); i += 2) {
    rows.push({ name: flat[i], wins: Number(flat[i + 1]) });
  }
  return rows;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!CONFIGURED) {
    return res.status(200).json({ kvConfigured: false, rows: [] });
  }

  try {
    if (req.method === 'GET') {
      const date = safeDate(req.query.date);
      if (!date) return res.status(400).json({ error: 'bad date' });
      return res.status(200).json({ kvConfigured: true, rows: await topRows(date) });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
      const date = safeDate(body.date);
      const wins = Number(body.wins);
      const name = String(body.name ?? '').trim().slice(0, 16) || '无名氏';
      if (!date || !Number.isFinite(wins) || wins <= 0 || wins > 10000) {
        return res.status(400).json({ error: 'bad submission' });
      }
      // 只保留每名字的最高胜场(GT:仅更大时写入)
      await kv(['ZADD', `wins:${date}`, 'GT', String(wins), name]);
      await kv(['EXPIRE', `wins:${date}`, String(60 * 60 * 24 * 30)]); // 30 天 TTL
      const rows = await topRows(date);
      const rank = rows.findIndex((r) => r.name === name);
      return res.status(200).json({ kvConfigured: true, rows, rank: rank >= 0 ? rank + 1 : null });
    }

    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(200).json({ kvConfigured: false, rows: [], error: String(e) });
  }
}
