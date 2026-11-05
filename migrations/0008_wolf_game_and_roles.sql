PRAGMA foreign_keys = OFF;

CREATE TABLE game_pages_next (
  game_type TEXT PRIMARY KEY CHECK (game_type IN ('mafia', 'wolf', 'imposter', 'bluff')),
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
  'wolf',
  'loup-garou',
  'ذئاب القرية',
  'القرية تنام… والذئاب تستيقظ',
  'احمِ القرية، اكشف الذئاب واستعمل قدراتك السرية قبل أن يبتلع الليل الجميع.',
  'ذئاب القرية | لعبة Loup-Garou عربية أونلاين — قِناع',
  'العب ذئاب القرية على قِناع: لعبة Loup-Garou عربية جماعية بالصوت والدردشة والأدوار السرية.',
  'لوب غارو عربي, لعبة الذئب العربية, Loup Garou اونلاين, ألعاب جماعية عربية, قناع',
  'ذئاب القرية — لعبة Loup-Garou عربية على قِناع',
  'قرية نائمة، ذئاب خفية وأدوار خاصة تغيّر مصير كل ليلة.',
  datetime('now')
);

UPDATE room_members SET role = 'المافيا' WHERE role IN ('عضو المافيا', 'أفراد الظل');
UPDATE room_members SET role = 'الطبيب' WHERE role = 'المُنقذ';
UPDATE room_members SET role = 'المواطن الصالح' WHERE role IN ('البريء', 'الكشّاف', 'الخطّابة');

PRAGMA foreign_keys = ON;
