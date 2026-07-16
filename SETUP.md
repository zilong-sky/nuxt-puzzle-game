# ?????? (SETUP)

?????????????????????????????????

## 1. ???????

?? Vercel Blob / Vercel Postgres ??????????????

**Vercel Blob**
- `BLOB_READ_WRITE_TOKEN` (`@vercel/blob` ????)

**Vercel Postgres**
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

## 2. ????? SQL

? Vercel ????? Postgres ??? -> Query ??????????? SQL ????

```sql
CREATE TABLE IF NOT EXISTS cloud_images (
  id SERIAL PRIMARY KEY,
  seq INT UNIQUE,                                  -- ????????? 1 ??
  code TEXT UNIQUE,                                -- 'CLOUD-0001' ??
  url TEXT NOT NULL,                               -- Blob ?? URL
  blob_pathname TEXT NOT NULL,                     -- Blob ???? (???)
  uploader TEXT DEFAULT 'anonymous',
  fingerprint TEXT NOT NULL,                       -- ?????
  uploaded_at BIGINT NOT NULL,                     -- ms
  reviewed_at BIGINT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  reject_reason TEXT,
  width INT,
  height INT
);
CREATE INDEX IF NOT EXISTS idx_cloud_status ON cloud_images (status);
CREATE INDEX IF NOT EXISTS idx_cloud_seq ON cloud_images (seq) WHERE status='approved';
```

```sql
CREATE TABLE IF NOT EXISTS upload_quota (
  fingerprint TEXT NOT NULL,
  day TEXT NOT NULL,                               -- 'YYYY-MM-DD' UTC+8
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (fingerprint, day)
);
```

```sql
CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  fingerprint TEXT,
  score INT NOT NULL,
  level_reached INT DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_desc ON scores (score DESC, created_at DESC);
```

## 3. ?????? (????)

???????????? `pending`?????????

```sql
WITH nx AS (
  SELECT COALESCE(MAX(seq),0)+1 AS n FROM cloud_images WHERE status='approved'
)
UPDATE cloud_images
SET status='approved',
    seq=(SELECT n FROM nx),
    code='CLOUD-' || LPAD((SELECT n FROM nx)::text, 4, '0'),
    reviewed_at=EXTRACT(EPOCH FROM now())*1000
WHERE id=1;
```

## 4. ????

```bash
npm i
vercel link
vercel env pull .env.local
npm run dev
```

## 5. ????

- ??????? canvas ?? 1200px ?? JPEG 0.85????? <= 3MB?
- ?????`fingerprint + day(UTC+8)`??????? 3 ??
- ?????? `/api/images/cloud`?? `seq ASC` ?????
- ?????? `player_name / fingerprint / score / level_reached`?? 50 ????
- ??????????????1-12 ????? localStorage ????
