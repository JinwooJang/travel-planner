-- 실시간 공유용 표. Supabase → SQL Editor에 붙여 넣고 Run 하세요(여러 번 돌려도 괜찮아요).
-- 표에는 정책(policy)을 일부러 하나도 만들지 않아요: 공개 키(anon)로는 아무것도 읽거나 쓸 수 없고,
-- Vercel 함수(api/)가 service_role 키로만 읽고 써요.

create table if not exists public.trips (
  id          text primary key,                       -- 공유 링크의 ID (/s/<id>)
  name        text not null default '',
  data        jsonb not null,                         -- 플랜 파일과 같은 형식 { format, version, plans, routes }
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table if not exists public.locations (
  id       bigint generated always as identity primary key,
  trip_id  text not null references public.trips(id) on delete cascade,   -- 공유를 끝내면 위치도 같이 지워져요
  t        timestamptz not null,
  lat      double precision not null,
  lng      double precision not null,
  acc      real,                                      -- 오차(m)
  spd      real,                                      -- 속도(km/h)
  hdg      real,                                      -- 방향(도)
  src      text                                       -- 'owntracks' | 'web'
);

create index if not exists locations_trip_t on public.locations (trip_id, t desc);

alter table public.trips enable row level security;
alter table public.locations enable row level security;
