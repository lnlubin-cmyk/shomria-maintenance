-- New residents default to NON-member (לא חבר).
--
-- Originally (0028) is_member defaulted to true so the existing roster kept its
-- voting rights. Going forward, newly added residents — whether bulk-imported
-- from Excel (which omits the column and so takes this default) or added
-- individually — should start as non-members; the admin marks members
-- explicitly. Existing rows are unchanged (a default only affects new inserts).
alter table residents alter column is_member set default false;
