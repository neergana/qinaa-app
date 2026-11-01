PRAGMA foreign_keys = ON;

UPDATE game_pages
SET
  slug = 'mafia',
  name = 'المافيا',
  eyebrow = 'لعبة الأدوار والاستنتاج',
  short_description = 'اكشف أعضاء المافيا عبر النقاش والأدوار السرية قبل أن يسيطروا على الجولة.',
  meta_title = 'المافيا | لعبة مافيا عربية أونلاين — قِناع',
  meta_description = 'العب المافيا على قِناع: لعبة مافيا عربية جماعية بالصوت والدردشة والأدوار السرية.',
  keywords = 'لعبة مافيا عربية, مافيا اونلاين, لعبة المافيا, ألعاب جماعية عربية, قناع',
  og_title = 'المافيا — لعبة مافيا عربية على قِناع',
  og_description = 'خداع وأدوار سرية وتصويت مباشر في لعبة المافيا من قِناع.',
  updated_at = datetime('now')
WHERE game_type = 'mafia';

UPDATE room_members
SET role = 'عضو المافيا'
WHERE role = 'أفراد الظل';
