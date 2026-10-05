-- Invite resending + password-reset throttling. Run once in the Supabase SQL editor.

-- When the invite email was last sent; resending is throttled on this.
alter table invites add column if not exists last_sent_at timestamptz not null default now();
update invites set last_sent_at = created_at;

-- When a password reset email was last sent to this person; the public
-- "forgot password" form is throttled on this so it can't be used to spam.
alter table profiles add column if not exists password_reset_sent_at timestamptz;
