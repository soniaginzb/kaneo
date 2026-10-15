# Updating this fork

This fork (soniaginzb/kaneo, branch `recurring-tasks`) adds recurring tasks; the live image is built from this branch. (An older add-on, a My tasks page on branch `my-tasks`, was dropped when updating to 2.46.2 because upstream now ships its own My tasks page.) It is never sent upstream: the `upstream` remote is fetch-only and `gh` defaults to the fork.

The live instance runs from `../kaneo` (compose + `.env`); this folder only builds the `kaneo-custom` image.

1. Back up the live database:
   `cd ../kaneo && docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/kaneo-$(date +%Y%m%d-%H%M%S).dump`
2. Merge upstream:
   `cd ../kaneo-source && git fetch upstream && git switch recurring-tasks && git merge <latest release tag, e.g. v2.46.2>`
3. If `apps/api/drizzle` conflicts (upstream added a migration with our number): take upstream's versions of every conflicting file under `apps/api/drizzle`, delete our `*_task_recurrence.sql` and its snapshot, run `pnpm install`, then
   `cd apps/api && DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm exec drizzle-kit generate --name task_recurrence`
   and make the regenerated SQL idempotent exactly like the current one (`CREATE TABLE IF NOT EXISTS` and the foreign key inside a `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block). Keep `meta/_journal.json` in upstream's indentation (2 spaces) so its diff stays small. The live database will run the regenerated file once more; because it is idempotent, that is a no-op.
4. Run the checks (needs the throwaway test database: `docker run -d --name kaneo-test-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5434:5432 postgres:16-alpine`):
   - `pnpm lint && pnpm typecheck`
   - `pnpm --filter @kaneo/api exec vp test run --config vitest.config.ts`
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts`
   - `pnpm --filter @kaneo/web exec vp test run --config vitest.config.ts`
5. Build and restart:
   `docker build -f Dockerfile.kaneo -t kaneo-custom:latest .`, then `cd ../kaneo && docker compose up -d`.
6. Push the branch to the fork only: `git push origin recurring-tasks`.

Rollback: in `../kaneo/compose.yml` set the image back to `ghcr.io/usekaneo/kaneo:latest` and run `docker compose up -d`. The extra `task_recurrence` table is ignored by the official image.
