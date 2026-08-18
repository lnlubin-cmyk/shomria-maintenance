-- New limited role: גבאי — may update only the religious content (זמני תפילות,
-- שיעורי תורה, זמנים הלכתיים). No other admin access.
-- (Adding an enum value is committed here; it's first *used* in 0044.)
alter type user_role add value if not exists 'gabbai';
