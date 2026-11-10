-- Enable the scheduler and async HTTP client used by the Acadly reminder dispatcher.
create extension if not exists pg_cron;
create extension if not exists pg_net;
