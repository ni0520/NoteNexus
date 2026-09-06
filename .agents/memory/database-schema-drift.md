---
name: Database schema drift
description: Safety guidance for reconciling the development database with ownership-aware schema changes.
---

When the application schema adds required ownership columns to tables that already contain rows, do not run an unattended schema push. First determine how existing rows should be assigned or migrated, because the migration tool may classify the change as irreversible data loss.

**Why:** The development database can outlive the source schema and may contain legacy rows without an owner. Automatically adding a non-null owner column cannot preserve those rows without an explicit migration policy.

**How to apply:** Before changing a database schema, inspect row counts and column definitions. If existing rows cannot be mapped safely, keep verification isolated from the database until an owner-assignment migration is approved.