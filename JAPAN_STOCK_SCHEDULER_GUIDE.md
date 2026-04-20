# Japanese Stock Data Scheduler - Complete Setup Guide
## 일본 주식 데이터 자동 수집 가이드

---

## Overview
```
Google Colab (or Local Python)
        ↓
    Fetch JP Stock Data (yfinance)
        ↓
    Save JSON file (jp_prices_YYYY-MM-DD.json)
        ↓
    Upsert to Cursor App
        ↓
    Cursor App → Supabase
```

---

## STEP 1: Install Python & Dependencies

### On Your Local Machine (macOS/Linux/Windows)

```bash
# 1. Install Python 3.9+ (if not already installed)
python3 --version

# 2. Navigate to project root
cd /path/to/MoneyMart2.0

# 3. Install dependencies
pip install -r scripts/requirements.txt
```

**Windows Users:** Use `python` instead of `python3`

---

## STEP 2: Test the Script Manually

```bash
# Run the script
python3 scripts/fetch_jp_stocks.py

# Expected output:
# 📊 Fetching 20 Japanese stocks for 2026-04-20
# ✅ [1/20] 7203.T: 1234.56
# ✅ [2/20] 8306.T: 2345.67
# ...
# 💾 Saved to: scripts/data/jp_prices_2026-04-20.json
```

**Output location:** `scripts/data/jp_prices_YYYY-MM-DD.json`

---

## STEP 3: Schedule Daily Execution

### Option A: Linux/macOS (Cron Job)

```bash
# Edit crontab
crontab -e

# Add this line (runs at 3:40 PM daily):
40 15 * * * cd /path/to/MoneyMart2.0 && python3 scripts/fetch_jp_stocks.py >> logs/jp_stocks_cron.log 2>&1

# Make sure logs directory exists
mkdir -p /path/to/MoneyMart2.0/logs
```

**Time Format:** `40 15` = 3:40 PM (24-hour format)

---

### Option B: Windows (Task Scheduler)

1. Open **Task Scheduler**
2. Create Basic Task:
   - **Name:** `Japan Stock Fetcher`
   - **Trigger:** Daily at 3:40 PM
   - **Action:** Start a program
   - **Program:** `python3` (or `python`)
   - **Arguments:** `scripts/fetch_jp_stocks.py`
   - **Start in:** `C:\path\to\MoneyMart2.0`

---

### Option C: GitHub Actions (Free Cloud Scheduling)

Create `.github/workflows/jp_stocks.yml`:

```yaml
name: Daily JP Stock Fetch

on:
  schedule:
    - cron: '40 15 * * *'  # 3:40 PM UTC (adjust timezone)
  workflow_dispatch:

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: pip install -r scripts/requirements.txt
      
      - name: Fetch JP stocks
        run: python3 scripts/fetch_jp_stocks.py
      
      - name: Push data
        run: |
          git config user.name "Stock Bot"
          git config user.email "bot@moneymart.com"
          git add scripts/data/
          git commit -m "📊 Update JP stock data"
          git push
```

---

## STEP 4: Set Up Supabase Table (SQL)

Run this in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS jp_stocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    trade_date DATE NOT NULL,
    open DECIMAL(10, 2),
    high DECIMAL(10, 2),
    low DECIMAL(10, 2),
    close DECIMAL(10, 2),
    volume BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, trade_date)
);

CREATE INDEX idx_jp_stocks_date ON jp_stocks(trade_date);
CREATE INDEX idx_jp_stocks_symbol ON jp_stocks(symbol);
```

---

## STEP 5: Create Upsert Handler in Your Node.js App

Create `api/routes/jp-stocks-upsert.js`:

```javascript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    // Get the latest JP stocks data file
    const today = new Date().toISOString().split('T')[0];
    const dataDir = path.join(__dirname, '../scripts/data');
    const filename = `jp_prices_${today}.json`;
    const filepath = path.join(dataDir, filename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Data file not found' });
    }

    // Read data
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    // Upsert into Supabase
    const { data: result, error } = await supabase
      .from('jp_stocks')
      .upsert(data, { onConflict: 'symbol,trade_date' });

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      count: result?.length || data.length,
      message: `Upserted ${result?.length || data.length} JP stock records`
    });

  } catch (error) {
    console.error('Error upserting JP stocks:', error);
    res.status(500).json({ error: error.message });
  }
};
```

---

## STEP 6: Trigger Upsert After Data Fetch

### Option A: Add to Cron Script (Linux/macOS)

```bash
# In crontab, add:
40 15 * * * cd /path/to/MoneyMart2.0 && python3 scripts/fetch_jp_stocks.py && curl -X POST https://your-app.com/api/routes/jp-stocks-upsert.js
```

### Option B: Call API from Python Script

Modify `fetch_jp_stocks.py` to call the upsert endpoint:

```python
import requests

# After saving JSON...
if results:
    output_file = OUTPUT_DIR / f"jp_prices_{TARGET_DATE}.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    
    # Call upsert API
    try:
        response = requests.post(
            "https://your-app.com/api/routes/jp-stocks-upsert.js",
            json={
                "data": results,
                "date": TARGET_DATE
            }
        )
        print(f"✅ Upserted: {response.json()['count']} records")
    except Exception as e:
        print(f"⚠️  Upsert failed: {e}")
```

---

## STEP 7: Environment Variables

Add to `.env` or `.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_secret_key_here
```

---

## Testing Checklist

- [ ] Python script runs manually: `python3 scripts/fetch_jp_stocks.py`
- [ ] JSON file is created in `scripts/data/`
- [ ] Upsert API endpoint returns 200 status
- [ ] Data appears in Supabase `jp_stocks` table
- [ ] Scheduler is configured (cron/Task Scheduler/GitHub Actions)
- [ ] Test run at 3:40 PM succeeds

---

## Monitoring

### Check Last Run
```bash
tail -f logs/jp_stocks_cron.log  # Linux/macOS
```

### Query Latest Data in Supabase
```sql
SELECT * FROM jp_stocks 
WHERE trade_date = CURRENT_DATE 
ORDER BY symbol;
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: yfinance` | Run `pip install -r scripts/requirements.txt` |
| Script runs but no JSON file | Check `scripts/data/` folder exists, check cron logs |
| Upsert fails | Verify Supabase credentials in `.env` |
| Scheduler doesn't run | Check crontab/Task Scheduler settings, verify time format |

---

## Next Steps

1. ✅ Run script manually to verify
2. ✅ Set up scheduler (pick A, B, or C)
3. ✅ Create Supabase table
4. ✅ Set up upsert API
5. ✅ Test end-to-end
6. ✅ Monitor logs

