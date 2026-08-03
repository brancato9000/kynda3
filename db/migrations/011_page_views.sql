-- V3-66: demo-page visit log. Tony sent Sydney the share links and had no
-- way to know if they were opened. Self-rolled and minimal — no third-party
-- script, no cookies: path, timestamp, user agent, referer, and a one-way
-- hashed IP for rough unique-visitor counting. Server-rendered pages log
-- on serve; writes are best-effort and never break a request.

CREATE TABLE IF NOT EXISTS page_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path        TEXT NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent  TEXT,
  referer     TEXT,
  ip_hash     TEXT
);
CREATE INDEX IF NOT EXISTS page_views_path_ts ON page_views (path, ts DESC);
