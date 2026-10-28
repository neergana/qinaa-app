ALTER TABLE rooms ADD COLUMN game_type TEXT NOT NULL DEFAULT 'mafia';

CREATE INDEX idx_rooms_game_type_status ON rooms(game_type, status, is_private, created_at);

CREATE TABLE game_pages (
  game_type TEXT PRIMARY KEY CHECK (game_type IN ('mafia', 'imposter')),
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

INSERT INTO game_pages (
  game_type, slug, name, eyebrow, short_description, meta_title, meta_description,
  keywords, og_title, og_description, updated_at
) VALUES (
  'mafia',
  'afrad-alzil',
  'أفراد الظل',
  'لعبة الأدوار والاستنتاج',
  'اكشف أفراد الظل عبر النقاش والأدوار السرية قبل أن يسيطروا على الجولة.',
  'أفراد الظل | لعبة مافيا عربية أونلاين — قِناع',
  'العب أفراد الظل على قِناع: لعبة مافيا عربية جماعية بالصوت والدردشة والأدوار السرية.',
  'لعبة مافيا عربية, مافيا اونلاين, أفراد الظل, ألعاب جماعية عربية, قناع',
  'أفراد الظل — لعبة مافيا عربية على قِناع',
  'خداع وأدوار سرية وتصويت مباشر في لعبة أفراد الظل من قِناع.',
  datetime('now')
), (
  'imposter',
  'aldakhil',
  'الدخيل',
  'كلمة واحدة وشكوك كثيرة',
  'يعرف الجميع الكلمة إلا الدخيل. اسألوا بعضكم واكشفوه قبل أن يخمّن السر.',
  'الدخيل | لعبة كشف الكلمة بالعربية — قِناع',
  'العب الدخيل على قِناع: لعبة عربية جماعية بالكلمات والأسئلة والتصويت السري.',
  'لعبة الدخيل, امبوستر بالعربية, ألعاب كلمات جماعية, ألعاب عربية اونلاين, قناع',
  'الدخيل — لعبة الكلمات والتصويت السري على قِناع',
  'الجميع يعرف الكلمة إلا الدخيل. اسأل وصوّت واكشف الحقيقة خلف القناع.',
  datetime('now')
);

CREATE TABLE imposter_round_state (
  round_id TEXT PRIMARY KEY REFERENCES rounds(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'reveal' CHECK (phase IN ('reveal', 'questions', 'vote', 'results')),
  secret_word TEXT NOT NULL,
  candidate_words TEXT NOT NULL,
  question_order TEXT NOT NULL,
  current_index INTEGER NOT NULL DEFAULT 0,
  turn_stage TEXT NOT NULL DEFAULT 'question' CHECK (turn_stage IN ('question', 'answer')),
  imposter_count INTEGER NOT NULL,
  vote_deadline TEXT,
  results_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE imposter_assignments (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_imposter INTEGER NOT NULL DEFAULT 0,
  ready_at TEXT,
  word_choice TEXT,
  word_confirmed_at TEXT,
  PRIMARY KEY (round_id, user_id)
);

CREATE TABLE imposter_ballots (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  voter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selections_json TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  PRIMARY KEY (round_id, voter_user_id)
);

CREATE INDEX idx_imposter_assignments_round ON imposter_assignments(round_id, is_imposter, ready_at);
CREATE INDEX idx_imposter_ballots_round ON imposter_ballots(round_id, confirmed_at);
