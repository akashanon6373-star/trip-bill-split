// Shared bill list stored in Upstash Redis (Vercel Marketplace → "Upstash for Redis").
// No login: anyone with the site link can view, add, edit and delete bills.
const seed = require("../seed.json");

const NAMES = ["Akash", "Nitish", "Badal", "Suraj", "Abhiraj"];
const KEY = "trip:bills";
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function ensureSeeded() {
  const done = await redis(["SET", "trip:seeded", "1", "NX"]);
  if (done === "OK" && seed.length) {
    const args = ["HSET", KEY];
    for (const b of seed) args.push(b.id, JSON.stringify(b));
    await redis(args);
  }
}

function clean(b) {
  if (!b || typeof b !== "object") return null;
  const id = String(b.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  const item = String(b.item || "").trim().slice(0, 80);
  const amount = Math.round(Number(b.amount) * 100) / 100;
  const charged = Array.isArray(b.charged) ? NAMES.filter((n) => b.charged.includes(n)) : [];
  if (!id || !item || !(amount > 0 && amount < 1e8) || !NAMES.includes(b.paidBy) || !charged.length) return null;
  return { id, item, amount, paidBy: b.paidBy, charged, createdAt: Number(b.createdAt) || Date.now(), hl: !!b.hl };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) {
    return res.status(500).send("Storage isn't connected. In Vercel: Storage → Create → Upstash for Redis → connect to this project, then redeploy.");
  }
  try {
    await ensureSeeded();
    if (req.method === "GET") {
      const flat = (await redis(["HGETALL", KEY])) || [];
      const bills = [];
      for (let i = 1; i < flat.length; i += 2) { try { bills.push(JSON.parse(flat[i])); } catch {} }
      bills.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return res.status(200).json({ bills });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const b = clean(body);
      if (!b) return res.status(400).send("Bill is missing an item, amount, payer or people to charge.");
      const count = await redis(["HLEN", KEY]);
      if (count >= 2000) return res.status(400).send("Too many bills.");
      await redis(["HSET", KEY, b.id, JSON.stringify(b)]);
      return res.status(200).json({ ok: true, bill: b });
    }
    if (req.method === "DELETE") {
      const id = String(req.query.id || "").replace(/[^A-Za-z0-9_-]/g, "");
      if (!id) return res.status(400).send("Missing id.");
      await redis(["HDEL", KEY, id]);
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).send("Method not allowed");
  } catch (e) {
    return res.status(500).send("Storage error: " + e.message);
  }
};
