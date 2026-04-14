import { readFileSync } from 'fs'
import { join } from 'path'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Local fallback: if no Blob token, read from public/q4_data.json
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const filePath = join(process.cwd(), 'public', 'q4_data.json')
      const data = JSON.parse(readFileSync(filePath, 'utf8'))
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json(data)
    } catch (err) {
      return res.status(500).json({ error: `Local fallback failed: ${err.message}` })
    }
  }

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