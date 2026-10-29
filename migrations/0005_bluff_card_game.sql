PRAGMA foreign_keys = OFF;

CREATE TABLE game_pages_next (
  game_type TEXT PRIMARY KEY CHECK (game_type IN ('mafia', 'imposter', 'bluff')),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  eyebrow TEXT NOT NULL,
  short_description TEXT NOT NULL,
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  keywords TEXT NOT NULL,
  og_title TEXT NOT NULL,
  og_description TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO game_pages_next SELECT * FROM game_pages;
DROP TABLE game_pages;
ALTER TABLE game_pages_next RENAME TO game_pages;

INSERT INTO game_pages (
  game_type, slug, name, eyebrow, short_description, meta_title, meta_description,
  keywords, og_title, og_description, updated_at
) VALUES (
  'bluff',
  'bluff-card',
  'بطاقة الخداع',
  'تُصدّق الادعاء… أم تكشف الكذبة؟',
  'مرّر البطاقة مقلوبة وادّعِ ما تشاء. اكشف كذب خصومك، وتجنّب تراكم البطاقات أمامك.',
  'بطاقة الخداع | لعبة كذب وبطاقات عربية — قِناع',
  'العب بطاقة الخداع على قِناع: مرّر بطاقة سرية، غيّر الادعاء واكشف من يقول الحقيقة ومن يكذب.',
  'بطاقة الخداع, لعبة كذب عربية, ألعاب بطاقات جماعية, ألعاب خداع اونلاين, قناع',
  'بطاقة الخداع — تُصدّق الادعاء أم تكشف الكذبة؟',
  'مرّر البطاقة مقلوبة، ادّعِ ما تشاء واكشف الكذبة قبل أن تتراكم البطاقات أمامك.',
  datetime('now')
);

CREATE TABLE bluff_round_state (
  round_id TEXT PRIMARY KEY REFERENCES rounds(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'select' CHECK (phase IN ('select', 'respond', 'pass', 'results')),
  current_player_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  active_card_id TEXT,
  sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  receiver_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  claimed_type TEXT,
  seen_user_ids TEXT NOT NULL DEFAULT '[]',
  action_deadline TEXT,
  last_result_json TEXT,
  winner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE bluff_cards (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  animal_type TEXT NOT NULL CHECK (animal_type IN ('cockroach', 'butterfly', 'frog', 'fly', 'bedbug', 'spider', 'worm', 'snail')),
  variant INTEGER NOT NULL CHECK (variant BETWEEN 1 AND 8),
  zone TEXT NOT NULL CHECK (zone IN ('hand', 'penalty', 'transit', 'recycle')),
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE bluff_players (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  eliminated_at TEXT,
  placement INTEGER,
  PRIMARY KEY (round_id, user_id)
);

CREATE INDEX idx_bluff_cards_round_zone_owner ON bluff_cards(round_id, zone, owner_user_id);
CREATE INDEX idx_bluff_players_round_active ON bluff_players(round_id, eliminated_at);

PRAGMA foreign_keys = ON;
