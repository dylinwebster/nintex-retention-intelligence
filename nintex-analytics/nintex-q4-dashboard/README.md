# Nintex Q4 FY26 Renewal Intelligence Dashboard

React + Recharts dashboard reading from `q4_data.json` produced by `extract_q4_data.py`.

## Local dev setup

```bash
# 1. Install dependencies
npm install

# 2. Copy q4_data.json into public/
cp ~/nintex-analytics/q4_data.json public/

# 3. Start dev server
npm run dev
```

The dashboard will be at http://localhost:5173.

## Claude API (chat drawer)

Local dev uses the Vercel dev server to run `api/chat.js` as a serverless function.

```bash
# Install Vercel CLI if not already done
npm install -g vercel

# Run with Vercel dev (enables /api/chat route)
vercel dev
```

Set your API key in a `.env` file (copy from `.env.example`):
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Production deployment

```bash
# First deploy creates the Vercel project
vercel deploy

# Set environment variables in Vercel dashboard:
# - ANTHROPIC_API_KEY
# - VITE_DATA_URL (after Vercel Blob is set up)
```

## Data refresh

Run the extraction script weekly (Wednesday recommended):
```bash
cd ~/nintex-analytics
python3 extract_q4_data.py
```

Then copy the output to `public/` for local dev, or upload to Vercel Blob for production.

## Architecture

```
Databricks (finance.*) 
  → extract_q4_data.py 
  → q4_data.json 
  → React dashboard (reads JSON on load)
  → /api/chat.js (proxies Claude API with full data context)
```
