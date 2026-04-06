export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    const response = await fetch(
      process.env.DATA_URL,
      {
        headers: {
          Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        },
      }
    )
    if (!response.ok) {
      return res.status(404).json({ error: 'Data file not found in blob store.' })
    }
    const data = await response.json()
    res.setHeader('Cache-Control', 's-maxage=300')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
