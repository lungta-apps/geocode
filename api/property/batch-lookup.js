// api/property/batch-lookup.js
import { getPropertyInfo } from "../_lib/geocode-service.js";

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

export default async function handler(req, res) {
  try {
    let codes = [];

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      codes = toArray(body.codes || body.geocodes || body.geocode);
    } else if (req.method === "GET") {
      codes = toArray(req.query?.codes || req.query?.geocodes || req.query?.geocode);
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!codes.length) {
      return res.status(400).json({ error: "No geocodes provided" });
    }

    const start = Date.now();
    const settled = await Promise.allSettled(
      codes.map(async (geocode) => {
        const data = await getPropertyInfo(String(geocode || "").trim());
        return { geocode, success: true, data, processedAt: new Date().toISOString() };
      })
    );

    const results = settled.map((s, i) => {
      if (s.status === "fulfilled") return s.value;
      return {
        geocode: codes[i],
        success: false,
        error: s.reason?.message || String(s.reason || "Unknown error"),
        processedAt: new Date().toISOString(),
      };
    });

    return res.status(200).json({
      success: true,
      totalGeocodes: codes.length,
      durationMs: Date.now() - start,
      results,
    });
  } catch (err) {
    console.error("batch-lookup error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
}
