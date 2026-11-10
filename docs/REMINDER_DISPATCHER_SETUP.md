# Background reminder dispatcher setup

This runbook finishes the secure scheduled invocation for the deployed
\`reminder-dispatcher\` Edge Function.

## 1. Generate and set the dispatcher secret (Windows PowerShell)

From the repository root:

\`\`\`powershell
.\scripts\setup-reminder-dispatcher.ps1
\`\`\`

The script generates a random secret locally and sets
\`ACADLY_CRON_SECRET\` as a Supabase Edge Function secret. It prints the value
once so you can put it in Vault. Do not commit it or paste it in a GitHub issue.

## 2. Set the Edge Function server secrets

In Supabase Dashboard → Edge Functions → Secrets, set:

- \`SUPABASE_SECRET_KEY\`: project server-side Secret key (never put this in frontend config).
- \`WEB_PUSH_VAPID_PUBLIC_KEY\`: Web Push VAPID public key.
- \`WEB_PUSH_VAPID_PRIVATE_KEY\`: Web Push VAPID private key.
- \`WEB_PUSH_VAPID_SUBJECT\`: a valid contact URI, e.g. \`mailto:admin@example.com\`.

Generate the VAPID pair locally with a trusted Web Push VAPID generator/library.
Keep the private key private. The deployed dispatcher intentionally leaves
reminders pending when VAPID credentials are missing.

## 3. Store invocation material in Supabase Vault

In the Supabase SQL Editor, run the following, replacing the URL and
publishable key with the project's values, and paste the generated secret
into the psql/SQL editor session only. Do not commit this SQL with literal
secrets or save it in a shared query collection.

\`\`\`sql
select vault.create_secret('https://pcvkmsbtlszsuvuuvpnq.supabase.co', 'acadly_project_url');
select vault.create_secret('<PROJECT_PUBLISHABLE_KEY>', 'acadly_publishable_key');
select vault.create_secret('<GENERATED_CRON_SECRET>', 'acadly_cron_secret');
\`\`\`

If \`vault.create_secret\` is not available in this project, use the Dashboard
Vault secret manager or ask the project owner to enable supported Vault
secret-management functions. Do not replace Vault with a plaintext table.

## 4. Schedule invocation every minute

After the Vault secrets exist, run:

\`\`\`sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'acadly-reminder-dispatcher';

select cron.schedule(
  'acadly-reminder-dispatcher',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'acadly_project_url')
        || '/functions/v1/reminder-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'acadly_publishable_key'),
        'x-acadly-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'acadly_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $$
);
\`\`\`

Verify:

\`\`\`sql
select jobid, jobname, schedule, active from cron.job
where jobname = 'acadly-reminder-dispatcher';

select id, status_code, error_msg, created
from net._http_response
order by created desc
limit 20;
\`\`\`

## 5. Web Push status

The database stores subscriptions in \`web_push_subscriptions\` and per-reminder
deliveries in \`push_delivery_jobs\`. Browser subscription capture and the
VAPID-signed delivery worker still need implementation before real Web Push
can be described as active. The dispatcher will only enqueue jobs after all
three VAPID secrets are set; it will not mark reminders delivered in their
absence.

## Current limitations

- Edge Function deployed: \`reminder-dispatcher\`.
- Hosted migrations applied: event deduplication/dispatch state and push table RLS.
- Edge Function secrets are not set by the connected management tool, so cron
  is not scheduled yet.
- Web Push VAPID credentials and a sender worker are not yet configured.
- No delivery guarantee should be advertised until the cron run and push worker
  are verified end-to-end.
