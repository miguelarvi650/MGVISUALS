const { Redis } = require("@upstash/redis");
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});
const P = (v) => (typeof v === "string" ? JSON.parse(v) : v);
async function all(hash) {
  const h = (await redis.hgetall(hash)) || {};
  return Object.entries(h).map(([id, v]) => ({ ...P(v), id }));
}
async function get(hash, id) {
  const v = await redis.hget(hash, id);
  return v ? { ...P(v), id } : null;
}
async function put(hash, id, obj) {
  const { id: _omit, ...rec } = obj;
  await redis.hset(hash, { [id]: JSON.stringify(rec) });
}
async function del(hash, id) { await redis.hdel(hash, id); }
async function getKey(k) { const v = await redis.get(k); return v ? P(v) : null; }
async function setKey(k, obj) { await redis.set(k, JSON.stringify(obj)); }
module.exports = { redis, all, get, put, del, getKey, setKey };
