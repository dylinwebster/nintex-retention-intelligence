# Nintex Retention Intelligence Dashboard

Interactive retention analytics dashboard with AI-powered conversational layer.

## Deploy to Vercel (5 minutes)

### Step 1: Push to GitHub
```bash
cd nintex-retention-intelligence
git init
git add .
git commit -m "Initial dashboard deploy"
gh repo create nintex-retention-intelligence --private --push
```

Or create a repo manually at github.com and push.

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your `nintex-retention-intelligence` repo
4. In the **Environment Variables** section, add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key (starts with `sk-ant-`)
5. Click "Deploy"

Vercel will give you a URL like `nintex-retention-intelligence.vercel.app`

### Step 3: Open and test
- Visit your Vercel URL
- Click through the 5 tabs to verify charts render
- Click the "Ask a question" button (bottom right)
- Try: "Which products have the worst annualized GRR?"

## Project Structure

```
/api/chat.js          - Serverless function proxying to Anthropic API
/public/index.html    - Complete dashboard with embedded data + chat panel
/vercel.json          - Vercel routing config
/package.json         - Project metadata
```

## Notes
- All retention data is embedded in the HTML (no database needed)
- The chat panel sends the full dataset as context to Claude on each query
- To update data: regenerate the JSON blocks and replace in index.html
- API costs: each chat message uses ~3-4K tokens of context + response
- The API key is stored as a server-side environment variable (never exposed to the browser)
