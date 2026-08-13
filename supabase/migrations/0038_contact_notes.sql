-- Free-text note per contact (e.g. office hours), shown under email/phone.
alter table contacts add column if not exists notes text not null default '';
comment on column contacts.notes is 'מידע חופשי נוסף (למשל שעות פעילות), מוצג מתחת לטלפון/דוא״ל.';
