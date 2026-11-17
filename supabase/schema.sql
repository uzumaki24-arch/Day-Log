-- =====================================================================
-- Day-Log BPS - Skema database Supabase (PostgreSQL)
-- Cara pakai: Supabase Dashboard > SQL Editor > New query > tempel semua
-- isi file ini > Run. Aman dijalankan ulang (idempotent) pada proyek baru.
-- =====================================================================

-- ---------- 1. TABEL ----------
create table if not exists public.pegawai (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete set null,
  nip         text,
  nama        text not null,
  jabatan     text,
  unit        text,
  role        text not null default 'pegawai' check (role in ('admin', 'pegawai')),
  aktif       boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.kegiatan (
  id          uuid primary key default gen_random_uuid(),
  pegawai_id  uuid not null references public.pegawai(id) on delete restrict,
  tanggal     date not null,
  uraian      text not null check (char_length(btrim(uraian)) > 0),
  output      text,
  kategori    text default 'Lainnya',
  status      text not null default 'Selesai' check (status in ('Selesai', 'Dalam Proses', 'Tertunda')),
  keterangan  text,
  evidence_url text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

alter table public.kegiatan add column if not exists evidence_url text;

create index if not exists kegiatan_tanggal_idx on public.kegiatan (tanggal);
create index if not exists kegiatan_pegawai_tanggal_idx on public.kegiatan (pegawai_id, tanggal);

create table if not exists public.pengaturan (
  id              int primary key default 1 check (id = 1),
  instansi        text not null default 'BADAN PUSAT STATISTIK',
  satker          text not null default 'BPS Kota Palopo',
  alamat          text default '',
  kota            text default 'Palopo',
  kepala          text default '',
  nip_kepala      text default '',
  jabatan_kepala  text default 'Kepala BPS Kota Palopo'
);
insert into public.pengaturan (id) values (1) on conflict (id) do nothing;

-- kalender hari libur nasional / cuti bersama / libur daerah
create table if not exists public.hari_libur (
  tanggal     date primary key,
  keterangan  text not null default '',
  sumber      text not null default 'manual' check (sumber in ('api', 'manual')),
  created_at  timestamptz not null default now()
);

create index if not exists hari_libur_tanggal_idx on public.hari_libur (tanggal);

-- ---------- 2. FUNGSI BANTU ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pegawai where user_id = auth.uid() and role = 'admin' and aktif);
$$;

create or replace function public.my_pegawai_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.pegawai where user_id = auth.uid() and aktif limit 1;
$$;

-- ---------- 3. TRIGGER ----------
-- Saat ada akun baru: buat baris pegawai otomatis.
-- Pendaftar PERTAMA (belum ada admin) otomatis menjadi admin aktif.
-- Pendaftar berikutnya berstatus "menunggu" sampai diaktifkan admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.pegawai where role = 'admin') into first_user;
  insert into public.pegawai (user_id, nama, nip, role, aktif)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nama'), ''), split_part(new.email, '@', 1)),
    nullif(btrim(new.raw_user_meta_data ->> 'nip'), ''),
    case when first_user then 'admin' else 'pegawai' end,
    first_user
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mencegah sistem tanpa admin aktif.
create or replace function public.protect_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and old.aktif
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.aktif) then
    if not exists (select 1 from public.pegawai where role = 'admin' and aktif and id <> old.id) then
      raise exception 'Tidak bisa: harus ada minimal satu admin aktif.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_last_admin_trg on public.pegawai;
create trigger protect_last_admin_trg
  before update or delete on public.pegawai
  for each row execute function public.protect_last_admin();

-- Mengisi updated_at otomatis.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kegiatan_touch on public.kegiatan;
create trigger kegiatan_touch
  before update on public.kegiatan
  for each row execute function public.touch_updated_at();

-- ---------- 4. KEAMANAN (Row Level Security) ----------
alter table public.pegawai    enable row level security;
alter table public.kegiatan   enable row level security;
alter table public.pengaturan enable row level security;
alter table public.hari_libur enable row level security;

-- pegawai: user login boleh melihat daftar pegawai bila akunnya aktif (atau baris miliknya sendiri)
drop policy if exists pegawai_select on public.pegawai;
create policy pegawai_select on public.pegawai for select to authenticated
  using (user_id = auth.uid() or public.my_pegawai_id() is not null);

drop policy if exists pegawai_insert on public.pegawai;
create policy pegawai_insert on public.pegawai for insert to authenticated
  with check (public.is_admin());

drop policy if exists pegawai_update on public.pegawai;
create policy pegawai_update on public.pegawai for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists pegawai_delete on public.pegawai;
create policy pegawai_delete on public.pegawai for delete to authenticated
  using (public.is_admin() and user_id is null);

-- kegiatan: admin melihat/ubah semua, pegawai hanya miliknya sendiri
drop policy if exists kegiatan_select on public.kegiatan;
create policy kegiatan_select on public.kegiatan for select to authenticated
  using (public.is_admin() or pegawai_id = public.my_pegawai_id());

drop policy if exists kegiatan_insert on public.kegiatan;
create policy kegiatan_insert on public.kegiatan for insert to authenticated
  with check (public.is_admin() or pegawai_id = public.my_pegawai_id());

drop policy if exists kegiatan_update on public.kegiatan;
create policy kegiatan_update on public.kegiatan for update to authenticated
  using (public.is_admin() or pegawai_id = public.my_pegawai_id())
  with check (public.is_admin() or pegawai_id = public.my_pegawai_id());

drop policy if exists kegiatan_delete on public.kegiatan;
create policy kegiatan_delete on public.kegiatan for delete to authenticated
  using (public.is_admin() or pegawai_id = public.my_pegawai_id());

-- pengaturan: semua pegawai aktif boleh membaca, hanya admin yang mengubah
drop policy if exists pengaturan_select on public.pengaturan;
create policy pengaturan_select on public.pengaturan for select to authenticated
  using (public.my_pegawai_id() is not null);

drop policy if exists pengaturan_update on public.pengaturan;
create policy pengaturan_update on public.pengaturan for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- hari libur: semua pegawai aktif boleh membaca, hanya admin yang mengubah
drop policy if exists hari_libur_select on public.hari_libur;
create policy hari_libur_select on public.hari_libur for select to authenticated
  using (public.my_pegawai_id() is not null);

drop policy if exists hari_libur_insert on public.hari_libur;
create policy hari_libur_insert on public.hari_libur for insert to authenticated
  with check (public.is_admin());

drop policy if exists hari_libur_update on public.hari_libur;
create policy hari_libur_update on public.hari_libur for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists hari_libur_delete on public.hari_libur;
create policy hari_libur_delete on public.hari_libur for delete to authenticated
  using (public.is_admin());

-- ---------- 5. FUNGSI PROFIL (pegawai mengubah profilnya sendiri) ----------
create or replace function public.update_profil(p_nama text, p_nip text, p_jabatan text, p_unit text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Belum login.';
  end if;
  if btrim(coalesce(p_nama, '')) = '' then
    raise exception 'Nama wajib diisi.';
  end if;
  update public.pegawai
     set nama = btrim(p_nama),
         nip = nullif(btrim(coalesce(p_nip, '')), ''),
         jabatan = nullif(btrim(coalesce(p_jabatan, '')), ''),
         unit = nullif(btrim(coalesce(p_unit, '')), '')
   where user_id = auth.uid();
end;
$$;

revoke all on function public.update_profil(text, text, text, text) from public, anon;
grant execute on function public.update_profil(text, text, text, text) to authenticated;

-- ---------- 6. HAK AKSES TABEL ----------
-- Pengguna anonim (belum login) tidak boleh menyentuh data sama sekali.
revoke all on public.pegawai, public.kegiatan, public.pengaturan, public.hari_libur from anon;
grant select, insert, update, delete on public.pegawai, public.kegiatan to authenticated;
grant select, update on public.pengaturan to authenticated;
grant select, insert, update, delete on public.hari_libur to authenticated;

-- =====================================================================
-- 7. KETUA TIM, ASAL TIM TUGAS, DAN PENILAIAN (sama dengan migrasi-ketua-tim.sql)
-- =====================================================================
-- ---------- 1. TABEL TIM ----------
create table if not exists public.tim (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null check (char_length(btrim(nama)) > 0),
  ketua_id    uuid references public.pegawai(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index if not exists tim_nama_uq on public.tim (lower(btrim(nama)));

-- ---------- 2. KOLOM BARU PADA KEGIATAN ----------
alter table public.kegiatan
  add column if not exists asal_tim_id  uuid references public.tim(id) on delete set null,
  add column if not exists nilai        int check (nilai between 0 and 100),
  add column if not exists nilai_catatan text,
  add column if not exists dinilai_oleh uuid references public.pegawai(id) on delete set null,
  add column if not exists dinilai_at   timestamptz;

create index if not exists kegiatan_asal_tim_idx on public.kegiatan (asal_tim_id);

-- ---------- 3. FUNGSI BANTU ----------
-- true bila pengguna yang login adalah ketua dari tim p_tim
create or replace function public.is_ketua_of(p_tim uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_tim is not null and exists (
    select 1 from public.tim t where t.id = p_tim and t.ketua_id = public.my_pegawai_id()
  );
$$;

-- ---------- 4. TRIGGER PENGAMAN NILAI ----------
-- Kolom nilai hanya boleh diubah oleh ketua tim asal tugas (lewat nilai_kegiatan),
-- tidak bisa diisi/ubah pegawai atau admin lewat update biasa.
-- Bila asal tim sebuah kegiatan diganti, nilai lama dihapus.
create or replace function public.protect_nilai()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.nilai is not null or new.nilai_catatan is not null or new.dinilai_oleh is not null or new.dinilai_at is not null then
      raise exception 'Nilai hanya dapat diberikan oleh ketua tim.';
    end if;
    return new;
  end if;

  if new.nilai is distinct from old.nilai
     or new.nilai_catatan is distinct from old.nilai_catatan
     or new.dinilai_oleh is distinct from old.dinilai_oleh
     or new.dinilai_at is distinct from old.dinilai_at then
    if not public.is_ketua_of(new.asal_tim_id) or new.pegawai_id = public.my_pegawai_id() then
      raise exception 'Nilai hanya dapat diberikan oleh ketua tim asal tugas.';
    end if;
  end if;

  if new.asal_tim_id is distinct from old.asal_tim_id and old.nilai is not null then
    new.nilai := null; new.nilai_catatan := null; new.dinilai_oleh := null; new.dinilai_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists kegiatan_protect_nilai on public.kegiatan;
create trigger kegiatan_protect_nilai
  before insert or update on public.kegiatan
  for each row execute function public.protect_nilai();

-- ---------- 5. KEAMANAN (RLS) ----------
alter table public.tim enable row level security;

drop policy if exists tim_select on public.tim;
create policy tim_select on public.tim for select to authenticated
  using (public.my_pegawai_id() is not null);
drop policy if exists tim_insert on public.tim;
create policy tim_insert on public.tim for insert to authenticated
  with check (public.is_admin());
drop policy if exists tim_update on public.tim;
create policy tim_update on public.tim for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists tim_delete on public.tim;
create policy tim_delete on public.tim for delete to authenticated
  using (public.is_admin());

-- Ketua tim boleh MELIHAT kegiatan yang tugasnya berasal dari timnya.
drop policy if exists kegiatan_select on public.kegiatan;
create policy kegiatan_select on public.kegiatan for select to authenticated
  using (public.is_admin() or pegawai_id = public.my_pegawai_id() or public.is_ketua_of(asal_tim_id));

-- ---------- 6. FUNGSI PENILAIAN ----------
-- Dipanggil ketua tim. p_nilai = null menghapus nilai.
create or replace function public.nilai_kegiatan(p_id uuid, p_nilai int, p_catatan text)
returns public.kegiatan language plpgsql security definer set search_path = public as $$
declare
  k  public.kegiatan;
  me uuid := public.my_pegawai_id();
begin
  if me is null then raise exception 'Belum login atau akun belum aktif.'; end if;
  select * into k from public.kegiatan where id = p_id;
  if not found then raise exception 'Kegiatan tidak ditemukan.'; end if;
  if not public.is_ketua_of(k.asal_tim_id) then raise exception 'Hanya ketua tim asal tugas yang dapat menilai.'; end if;
  if k.pegawai_id = me then raise exception 'Tidak dapat menilai kegiatan sendiri.'; end if;
  if p_nilai is not null and (p_nilai < 0 or p_nilai > 100) then raise exception 'Nilai harus antara 0 dan 100.'; end if;
  update public.kegiatan set
    nilai          = p_nilai,
    nilai_catatan  = case when p_nilai is null then null else nullif(btrim(coalesce(p_catatan, '')), '') end,
    dinilai_oleh   = case when p_nilai is null then null else me end,
    dinilai_at     = case when p_nilai is null then null else now() end
  where id = p_id
  returning * into k;
  return k;
end;
$$;

revoke all on function public.nilai_kegiatan(uuid, int, text) from public, anon;
grant execute on function public.nilai_kegiatan(uuid, int, text) to authenticated;

-- ---------- 7. HAK AKSES ----------
revoke all on public.tim from anon;
grant select, insert, update, delete on public.tim to authenticated;
