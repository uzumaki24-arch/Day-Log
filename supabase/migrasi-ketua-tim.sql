-- =====================================================================
-- Day-Log BPS - Pembaruan: Ketua Tim, Asal Tim Tugas, dan Penilaian
-- Untuk database yang SUDAH berjalan: Supabase Dashboard > SQL Editor >
-- New query > tempel semua isi file ini > Run. Aman dijalankan ulang.
-- (Proyek baru cukup menjalankan schema.sql, bagian ini sudah termasuk.)
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
