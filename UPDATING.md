# Updating this fork

This fork (soniaginzb/kaneo) adds recurring tasks and a My tasks page. The live image is built from branch `my-tasks`, which contains `recurring-tasks`. It is never sent upstream: the `upstream` remote is fetch-only and `gh` defaults to the fork.

The live instance runs from `../kaneo` (compose + `.env`); this folder only builds the `kaneo-custom` image.

1. Back up the live database:
   `cd ../kaneo && docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/kaneo-$(date +%Y%m%d-%H%M%S).dump`
2. Merge upstream:
   `cd ../kaneo-source && git fetch upstream && git switch my-tasks && git merge upstream/main`
3. If `apps/api/drizzle` conflicts (upstream added a migration with our number): take upstream's versions of every conflicting file under `apps/api/drizzle`, delete our `*_task_recurrence.sql` and its snapshot, run `pnpm install`, then
   `cd apps/api && DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm exec drizzle-kit generate --name task_recurrence`
   and make the regenerated SQL idempotent exactly like the current one (`CREATE TABLE IF NOT EXISTS` and the foreign key inside a `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block). Re-indent `meta/_journal.json` with tabs so its diff stays small. The live database will run the regenerated file once more; because it is idempotent, that is a no-op.
4. Run the checks (needs the throwaway test database: `docker run -d --name kaneo-test-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5434:5432 postgres:16-alpine`):
   - `pnpm lint && pnpm typecheck`
   - `pnpm --filter @kaneo/api exec vp test run --config vitest.config.ts`
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts`
   - `pnpm --filter @kaneo/web exec vp test run --config vitest.config.ts`
5. Build and restart:
   `docker build -f Dockerfile.kaneo -t kaneo-custom:latest .`, then `cd ../kaneo && docker compose up -d`.
6. Push the branch to the fork only: `git push origin my-tasks`.

Rollback: in `../kaneo/compose.yml` set the image back to `ghcr.io/usekaneo/kaneo:latest` and run `docker compose up -d`. The extra `task_recurrence` table is ignored by the official image.

My tasks needs no database changes, so rolling back to the official image leaves nothing behind.
