// api/property/lookup.js
import { getPropertyInfo } from "../_lib/geocode-service.js";
import { get, set } from "../_lib/cache.js";

function asString(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export default async function handler(req, res) {
  try {
    let geocode = "";

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      geocode = asString(body.geocode).trim();
    } else if (req.method === "GET") {
      geocode = asString(req.query?.geocode).trim();
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!geocode) {
      return res.status(400).json({ error: 'Missing "geocode"' });
    }

    // Check cache first
    const cached = get(geocode);
    if (cached) {
  return res.status(200).json({ success: true, data: cached, cached: true });
}


    const info = await getPropertyInfo(geocode);
    set(geocode, info);
    return res.status(200).json({ success: true, data: info });
  } catch (err) {
    console.error("lookup error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
}
