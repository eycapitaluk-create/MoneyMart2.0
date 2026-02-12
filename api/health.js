export default function handler(_req, res) {
  return res.status(200).json({
    ok: true,
    service: 'moneymart2-0',
    now: new Date().toISOString(),
  })
}
