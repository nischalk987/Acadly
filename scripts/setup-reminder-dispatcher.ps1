# Acadly background reminder dispatcher setup (Windows PowerShell)
# Requires Supabase CLI, a linked project, and permission to manage Edge Function secrets.
# This script generates a private cron secret locally and never writes it to Git.

$ErrorActionPreference = "Stop"
$ProjectRef = "pcvkmsbtlszsuvuuvpnq"
$FunctionUrl = "https://$ProjectRef.supabase.co/functions/v1/reminder-dispatcher"

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Install the Supabase CLI first: https://supabase.com/docs/guides/cli"
}

$CronSecretBytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($CronSecretBytes)
$CronSecret = [Convert]::ToBase64String($CronSecretBytes).TrimEnd('=').Replace('+','-').Replace('/','_')

Write-Host "Setting the dispatcher secret in Supabase Edge Function secrets..."
supabase secrets set "ACADLY_CRON_SECRET=$CronSecret" --project-ref $ProjectRef

Write-Host ""
Write-Host "Now add the following secrets in Supabase Dashboard > Edge Functions > Secrets:"
Write-Host "  SUPABASE_SECRET_KEY = your Supabase Secret key (server-side; never commit)"
Write-Host "  WEB_PUSH_VAPID_PUBLIC_KEY = generated Web Push VAPID public key"
Write-Host "  WEB_PUSH_VAPID_PRIVATE_KEY = generated Web Push VAPID private key"
Write-Host "  WEB_PUSH_VAPID_SUBJECT = mailto:your-admin-email"
Write-Host ""
Write-Host "Keep the cron secret somewhere private; it is required for the SQL schedule header:"
Write-Host $CronSecret
Write-Host ""
Write-Host "The SQL schedule is intentionally not auto-created by this script because secrets should be stored in Supabase Vault, not pasted into SQL history."
Write-Host "Create Vault secrets for project_url, publishable_key, and acadly_cron_secret, then run the SQL in docs/REMINDER_DISPATCHER_SETUP.md."
