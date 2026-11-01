PRAGMA foreign_keys = ON;

CREATE TABLE auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_auth_rate_limits_updated ON auth_rate_limits(updated_at);

CREATE TABLE game_scores (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  rounds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id, game_type)
);

ALTER TABLE imposter_round_state ADD COLUMN score_awarded INTEGER NOT NULL DEFAULT 0;

CREATE TABLE mafia_round_state (
  round_id TEXT PRIMARY KEY REFERENCES rounds(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'reveal' CHECK (phase IN ('reveal', 'night', 'day', 'vote', 'defense', 'results')),
  phase_deadline TEXT,
  night_number INTEGER NOT NULL DEFAULT 1,
  vote_round INTEGER NOT NULL DEFAULT 1,
  defense_order TEXT NOT NULL DEFAULT '[]',
  defense_index INTEGER NOT NULL DEFAULT 0,
  speaker_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  speaker_deadline TEXT,
  discussion_remaining_seconds INTEGER,
  last_result_json TEXT,
  winner TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE mafia_ready (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ready_at TEXT NOT NULL,
  PRIMARY KEY (round_id, user_id)
);

CREATE TABLE mafia_night_actions (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  night_number INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  targets_json TEXT,
  confirmed_at TEXT NOT NULL,
  PRIMARY KEY (round_id, night_number, user_id, action_type)
);

CREATE TABLE mafia_role_results (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  night_number INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result_json TEXT NOT NULL,
  PRIMARY KEY (round_id, night_number, user_id)
);

CREATE TABLE mafia_ballots (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  vote_round INTEGER NOT NULL,
  voter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmed_at TEXT NOT NULL,
  PRIMARY KEY (round_id, vote_round, voter_user_id)
);

CREATE TABLE mafia_speech_queue (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  requested_at TEXT NOT NULL,
  PRIMARY KEY (round_id, user_id)
);

CREATE INDEX idx_mafia_actions_round ON mafia_night_actions(round_id, night_number);
CREATE INDEX idx_mafia_ballots_round ON mafia_ballots(round_id, vote_round);
CREATE INDEX idx_mafia_speech_round ON mafia_speech_queue(round_id, position);
