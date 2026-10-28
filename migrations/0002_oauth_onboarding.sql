ALTER TABLE users ADD COLUMN profile_completed INTEGER NOT NULL DEFAULT 1;

UPDATE users
SET profile_completed = 0
WHERE birth_date IS NULL
  AND EXISTS (
    SELECT 1 FROM oauth_accounts WHERE oauth_accounts.user_id = users.id
  );
