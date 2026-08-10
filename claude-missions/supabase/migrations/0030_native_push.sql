-- Native push: the store shell's devices live in the same table as the web ones.
--
-- Web Push does not exist inside WKWebView or Android's WebView, so a device
-- that installed FitMess from a store cannot produce an endpoint + p256dh/auth
-- triple. It produces a single opaque device token instead — from APNs on iOS,
-- from FCM on Android — and delivery goes through the OS rather than a browser
-- push service.
--
-- What does NOT change is everything above the transport: `src/lib/push/due.ts`
-- still decides who gets a reminder and when, and the payloads in `send.ts` are
-- still one shape. Only the last hop differs. That is why native rows join the
-- existing table instead of getting one of their own: the sender fans out with
-- a single "every device this user has" query, and adding a platform must not
-- turn that into a union of two tables that can silently drift apart.
--
-- Shape per row, enforced by a CHECK rather than by convention:
--   web            -> endpoint + p256dh + auth,   device_token null
--   ios / android  -> device_token,               endpoint null
--
-- Applied to the live project via the Management API (see
-- `docs/izlazak-u-store.md`).

alter table public.push_subscriptions
  add column if not exists platform text not null default 'web',
  add column if not exists device_token text;

-- Existing rows predate the column and are all browsers; the default already
-- labelled them 'web'. Native rows carry none of the Web Push triple, so those
-- three columns stop being universally required.
alter table public.push_subscriptions
  alter column endpoint drop not null,
  alter column p256dh drop not null,
  alter column auth drop not null;

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_platform_shape;

alter table public.push_subscriptions
  add constraint push_subscriptions_platform_shape check (
    (
      platform = 'web'
      and endpoint is not null
      and p256dh is not null
      and auth is not null
      and device_token is null
    )
    or (
      platform in ('ios', 'android')
      and device_token is not null
      and endpoint is null
      and p256dh is null
      and auth is null
    )
  );

-- The same guarantee `endpoint`'s UNIQUE gives the web rows: re-registering a
-- device must UPDATE its row, never add a second one. Partial, because every
-- web row has a null token and Postgres would otherwise be fine with exactly
-- one of them.
--
-- Device tokens do rotate (a reinstall, an OS restore), and the old token is
-- then dead: APNs answers 410 and FCM answers UNREGISTERED, which the sender
-- already treats as "gone" and deletes — the same rule that keeps dead browser
-- endpoints from being paid for on every run.
create unique index if not exists push_subscriptions_device_token_key
  on public.push_subscriptions (device_token)
  where device_token is not null;

create index if not exists push_subscriptions_platform_idx
  on public.push_subscriptions (platform);

comment on column public.push_subscriptions.platform is
  'Delivery transport for this device: web (Web Push), ios (APNs), android (FCM). Decides which branch of src/lib/push/send.ts sends to it.';
comment on column public.push_subscriptions.device_token is
  'APNs/FCM device token for a store-installed app. Null for web rows, which are addressed by endpoint instead.';

-- RLS is unchanged: the existing own-row policies are written against user_id,
-- which every row still has regardless of platform.
