// api/hello.ts
export default async function handler(_req: any, res: any) {
  res.status(200).json({ ok: true, now: new Date().toISOString() });
}