/* =====================================================================
   Day-Log (Daily Work Log) - Laporan Kegiatan Harian Pegawai
   Frontend statis + Supabase (Auth + PostgreSQL + Row Level Security)
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------- Util ------------------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const BULAN_S = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const STATUS = ['Selesai', 'Dalam Proses', 'Tertunda'];
  const KATEGORI = ['Pengolahan Data', 'Pencacahan / Lapangan', 'Administrasi', 'Rapat / Koordinasi', 'Penyusunan Laporan', 'Pengawasan', 'Supervisi', 'Pemeriksaan Dokumen', 'Validasi Data', 'Penyusunan Publikasi', 'Memberikan Konsultasi', 'Lainnya'];

  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const fmtTgl = iso => { if (!iso) return '-'; const p = iso.split('-'); return +p[2] + ' ' + BULAN[+p[1] - 1] + ' ' + p[0]; };
  const fmtTglPendek = iso => { const p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  const dayName = iso => HARI[new Date(iso + 'T00:00:00').getDay()];
  const monthLabel = ym => { const p = ym.split('-'); return BULAN[+p[1] - 1] + ' ' + p[0]; };
  const lastDay = (y, m) => new Date(y, m, 0).getDate();
  const statusCls = s => s === 'Selesai' ? 'selesai' : s === 'Dalam Proses' ? 'proses' : 'tunda';
  const badge = s => '<span class="badge ' + statusCls(s) + '">' + esc(s) + '</span>';

  // Hari kerja (Senin-Jumat) pada bulan ym, dibatasi sampai hari ini untuk bulan berjalan.
  function workdaysInMonth(ym) {
    const p = ym.split('-'), y = +p[0], m = +p[1], t = todayISO();
    if (ym > t.slice(0, 7)) return [];
    const end = ym === t.slice(0, 7) ? +t.slice(8, 10) : lastDay(y, m);
    const libur = new Set((state.holidays || []).map(h => h.tanggal));
    const out = [];
    for (let d = 1; d <= end; d++) {
      const w = new Date(y, m - 1, d).getDay();
      const iso = ym + '-' + pad(d);
      if (w !== 0 && w !== 6 && !libur.has(iso)) out.push(iso);
    }
    return out;
  }
  function holidayOn(iso) { return (state.holidays || []).find(h => h.tanggal === iso) || null; }
  function missingWorkdays(pegId, ym) {
    const filled = new Set(state.kegiatan.filter(k => k.pegawaiId === pegId && k.tanggal.startsWith(ym)).map(k => k.tanggal));
    return workdaysInMonth(ym).filter(d => !filled.has(d));
  }
  function shortDateList(dates) {
    if (!dates.length) return '';
    const bulan = BULAN_S[+dates[0].slice(5, 7) - 1];
    return dates.map(d => +d.slice(8, 10)).join(', ') + ' ' + bulan;
  }

  const ICONS = {
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.2 4.1M6.1 6.1A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.2-.9"/>',
    idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h6"/><circle cx="16.5" cy="10" r="1.5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>'
  };
  const ico = n => '<i data-ico="' + n + '"></i>';
  function paintIcons(root) {
    $$('i[data-ico]', root).forEach(el => {
      if (!el.firstChild) el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[el.dataset.ico] || '') + '</svg>';
    });
  }
  function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const csv = rows => rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');

  /* ------------------------- Konfigurasi & State ------------------------- */
  const CFG = window.SIKHARI_CONFIG || {};
  const CONFIGURED = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && /^https?:\/\//.test(CFG.SUPABASE_URL));
  let sb = null;
  let recoveryDismissed = false;

  const DEFAULT_SETTINGS = {
    instansi: 'BADAN PUSAT STATISTIK', satker: 'BPS Kota Palopo', alamat: '', kota: 'Palopo',
    kepala: '', nipKepala: '', jabatanKepala: 'Kepala BPS Kota Palopo'
  };
  const state = { me: null, pegawai: [], kegiatan: [], penilaian: [], tims: [], timError: null, holidays: [], holidayError: null, settings: Object.assign({}, DEFAULT_SETTINGS), loadedAt: 0, since: '' };

  const isAdmin = () => !!state.me && state.me.role === 'admin';
  // Ketua tim = pegawai yang ditunjuk admin sebagai ketua pada menu Data Tim.
  const myTims = () => state.me ? state.tims.filter(t => t.ketuaId === state.me.id) : [];
  const isKetua = () => myTims().length > 0;
  const timById = id => state.tims.find(t => t.id === id);
  const timName = id => (timById(id) || {}).nama || '';
  // Kategori nilai: 96-100 Sangat Baik, 90-95 Baik, 85-89 Cukup, 0-84 Kurang.
  const nilaiKat = n => n >= 96 ? 'Sangat Baik' : n >= 90 ? 'Baik' : n >= 85 ? 'Cukup' : 'Kurang';
  const nilaiCls = n => n >= 96 ? 'nsb' : n >= 90 ? 'nb' : n >= 85 ? 'nc' : 'nk';
  const nilaiBadge = n => (n == null) ? '<span class="badge off">Belum dinilai</span>' : '<span class="badge ' + nilaiCls(n) + '">' + n + ' · ' + nilaiKat(n) + '</span>';
  const visiblePegawai = () => isAdmin() ? state.pegawai : state.pegawai.filter(p => state.me && p.id === state.me.id);
  const pegById = id => state.pegawai.find(p => p.id === id);
  const pegName = id => (pegById(id) || {}).nama || '(pegawai dihapus)';
  const sortKeg = (a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : (b.createdAt || 0) - (a.createdAt || 0));
  const sortKegAsc = (a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : (a.createdAt || 0) - (b.createdAt || 0));

  // pemetaan baris database <-> objek aplikasi
  const mapPeg = r => ({ id: r.id, userId: r.user_id || null, nip: r.nip || '', nama: r.nama, jabatan: r.jabatan || '', unit: r.unit || '', aktif: !!r.aktif, role: r.role || 'pegawai' });
  const mapKeg = r => ({ id: r.id, pegawaiId: r.pegawai_id, tanggal: r.tanggal, uraian: r.uraian, output: r.output || '', kategori: r.kategori || 'Lainnya', status: r.status, keterangan: r.keterangan || '', evidenceUrl: r.evidence_url || '', asalTimId: r.asal_tim_id || '', nilai: r.nilai == null ? null : Number(r.nilai), nilaiCatatan: r.nilai_catatan || '', dinilaiAt: r.dinilai_at ? Date.parse(r.dinilai_at) : 0, createdAt: r.created_at ? Date.parse(r.created_at) : 0 });
  const mapSet = r => ({ instansi: r.instansi, satker: r.satker, alamat: r.alamat || '', kota: r.kota || '', kepala: r.kepala || '', nipKepala: r.nip_kepala || '', jabatanKepala: r.jabatan_kepala || '' });
  const mapTim = r => ({ id: r.id, nama: r.nama, ketuaId: r.ketua_id || '' });
  const mapLibur = r => ({ tanggal: r.tanggal, keterangan: r.keterangan || '', sumber: r.sumber || 'manual' });

  function errMsg(e) {
    const m = (e && e.message) || String(e || '');
    if (/Invalid login credentials/i.test(m)) return 'Email atau password salah.';
    if (/already registered|already been registered/i.test(m)) return 'Email ini sudah terdaftar.';
    if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Cek kotak masuk email Anda.';
    if (/rate limit|too many/i.test(m)) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
    if (/row-level security|permission denied/i.test(m)) return 'Anda tidak memiliki izin untuk tindakan ini.';
    if (/duplicate key|already exists/i.test(m)) return 'Data dengan nama tersebut sudah ada.';
    if (/foreign key/i.test(m)) return 'Data tidak dapat dihapus karena masih dipakai data lain.';
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
    if (/Auth session missing|session.*missing/i.test(m)) return 'Sesi pemulihan tidak ditemukan. Silakan minta tautan reset password baru.';
    if (/New password should be different/i.test(m)) return 'Password baru harus berbeda dari password sebelumnya.';
    if (/Password should be at least/i.test(m)) return 'Password minimal 8 karakter.';
    if (/For security purposes|only request this after/i.test(m)) return 'Tunggu beberapa saat sebelum meminta tautan reset lagi.';
    return m;
  }
  async function dbCall(p) { const r = await p; if (r.error) throw r.error; return r.data; }
  async function fetchAll(build) {
    let out = [], from = 0; const step = 1000;
    for (;;) {
      const r = await build(from, from + step - 1);
      if (r.error) throw r.error;
      out = out.concat(r.data || []);
      if (!r.data || r.data.length < step) break;
      from += step;
    }
    return out;
  }
  async function busy(btns, fn) {
    btns.forEach(b => { if (b) b.disabled = true; });
    try { return await fn(); } finally { btns.forEach(b => { if (b) b.disabled = false; }); }
  }

  /* ------------------------- Gate: login / daftar / status ------------------------- */
  const gate = () => $('#gate');
  function showGate(html) {
    $('#app').classList.add('hidden');
    gate().classList.remove('hidden');
    gate().innerHTML = html;
    paintIcons(gate());
  }
  const gateHead = sub => '<div class="gate-brand"><img src="assets/day-log-logo.jpg" alt="Day-Log" class="gate-logo"><div><strong>Selamat datang</strong><span>' + esc(sub || 'Daily Work Log · Laporan Kegiatan Harian Pegawai') + '</span></div></div>';
  function gateLoading(msg) { showGate('<div class="gate-card center"><div class="spinner"></div><p class="muted">' + esc(msg || 'Memuat...') + '</p></div>'); }

  function showSetup() {
    showGate('<div class="gate-card wide">' + gateHead('Konfigurasi belum lengkap') +
      '<div class="info warn">Aplikasi belum terhubung ke database. Isi <b>SUPABASE_URL</b> dan <b>SUPABASE_ANON_KEY</b> di file <code>js/config.js</code>.</div>' +
      '<ol class="steps"><li>Buat proyek di <b>supabase.com</b>.</li><li>Buka <b>SQL Editor</b>, tempel isi <code>supabase/schema.sql</code>, lalu <b>Run</b>.</li>' +
      '<li>Salin <b>Project URL</b> dan <b>anon key</b> dari <b>Project Settings &gt; API</b> ke <code>js/config.js</code>.</li><li>Upload ulang ke GitHub, tunggu GitHub Pages memperbarui, lalu muat ulang halaman ini.</li></ol>' +
      '<p class="muted small">Langkah lengkap ada di README.md.</p></div>');
  }

  function showError(msg) {
    showGate('<div class="gate-card">' + gateHead() + '<div class="info warn">' + esc(msg) + '</div>' +
      '<div class="form-actions"><button class="btn primary" id="gRetry">' + ico('refresh') + 'Coba Lagi</button><button class="btn ghost" id="gOut">Keluar</button></div></div>');
    $('#gRetry').addEventListener('click', enter);
    $('#gOut').addEventListener('click', logout);
  }

  function showPending() {
    showGate('<div class="gate-card">' + gateHead() + '<h2 class="gate-title">Menunggu persetujuan admin</h2>' +
      '<p class="muted">Halo <b>' + esc(state.me.nama) + '</b>, akun Anda sudah terdaftar tetapi belum diaktifkan. Hubungi admin kantor agar akun Anda diaktifkan, lalu tekan <b>Cek Lagi</b>.</p>' +
      '<div class="form-actions"><button class="btn primary" id="gCheck">' + ico('refresh') + 'Cek Lagi</button><button class="btn ghost" id="gOut">Keluar</button></div></div>');
    $('#gCheck').addEventListener('click', enter);
    $('#gOut').addEventListener('click', logout);
  }

  function showAuth(tab, notice) {
    tab = tab || 'masuk';
    const passToggle = id => '<button type="button" class="pass-toggle" data-pass="' + id + '" aria-label="Tampilkan password"><i data-ico="eye"></i></button>';
    const loginMarkup =
      '<form id="fLogin" autocomplete="on" class="auth-form">' +
      '<div class="field"><label class="field-label" for="aEmail">Email</label><div class="input-wrap"><i data-ico="mail"></i>' +
      '<input type="email" id="aEmail" required autocomplete="username" placeholder="nama@bps.go.id"></div></div>' +
      '<div class="field"><label class="field-label" for="aPass">Password</label><div class="input-wrap has-toggle"><i data-ico="lock"></i>' +
      '<input type="password" id="aPass" required autocomplete="current-password" placeholder="Masukkan password Anda">' + passToggle('aPass') + '</div></div>' +
      '<div class="auth-row"><label class="remember"><input type="checkbox" id="aRemember"><span>Ingat email saya</span></label>' +
      '<button type="button" class="auth-link" id="gForgot">Lupa password?</button></div>' +
      '<button class="btn primary block" type="submit">Masuk ke Day-Log <span aria-hidden="true">→</span></button>' +
      '</form>';
    const regMarkup =
      '<form id="fReg" autocomplete="on" class="auth-form">' +
      '<div class="field"><label class="field-label" for="rNama">Nama Lengkap <b class="req">*</b></label><div class="input-wrap"><i data-ico="user"></i>' +
      '<input id="rNama" required placeholder="Nama lengkap Anda"></div></div>' +
      '<div class="field"><label class="field-label" for="rNip">NIP <span class="optional">(opsional)</span></label><div class="input-wrap"><i data-ico="idcard"></i>' +
      '<input id="rNip" inputmode="numeric" placeholder="Nomor induk pegawai"></div></div>' +
      '<div class="field"><label class="field-label" for="rEmail">Email <b class="req">*</b></label><div class="input-wrap"><i data-ico="mail"></i>' +
      '<input type="email" id="rEmail" required autocomplete="username" placeholder="nama@bps.go.id"></div></div>' +
      '<div class="grid2">' +
      '<div class="field"><label class="field-label" for="rPass">Password <b class="req">*</b></label><div class="input-wrap has-toggle"><i data-ico="lock"></i>' +
      '<input type="password" id="rPass" required minlength="8" autocomplete="new-password" placeholder="Minimal 8 karakter">' + passToggle('rPass') + '</div></div>' +
      '<div class="field"><label class="field-label" for="rPass2">Ulangi Password <b class="req">*</b></label><div class="input-wrap has-toggle"><i data-ico="lock"></i>' +
      '<input type="password" id="rPass2" required minlength="8" autocomplete="new-password" placeholder="Ulangi password">' + passToggle('rPass2') + '</div></div>' +
      '</div>' +
      '<button class="btn primary block" type="submit">Buat Akun <span aria-hidden="true">→</span></button>' +
      '<p class="muted small auth-note">Setelah mendaftar, akun perlu diaktifkan oleh admin kantor.</p>' +
      '</form>';
    const forgotMarkup =
      '<form id="fForgot" autocomplete="on" class="auth-form">' +
      '<div class="field"><label class="field-label" for="fpEmail">Email terdaftar</label><div class="input-wrap"><i data-ico="mail"></i>' +
      '<input type="email" id="fpEmail" required autocomplete="username" placeholder="nama@bps.go.id"></div></div>' +
      '<button class="btn primary block" type="submit">Kirim tautan reset <span aria-hidden="true">→</span></button>' +
      '<p class="muted small auth-note">Tautan pembuatan password baru akan dikirim ke email Anda. Periksa juga folder Spam/Junk.</p>' +
      '</form>';
    const resetMarkup =
      '<form id="fReset" autocomplete="on" class="auth-form">' +
      '<div class="field"><label class="field-label" for="nPass">Password baru <b class="req">*</b></label><div class="input-wrap has-toggle"><i data-ico="lock"></i>' +
      '<input type="password" id="nPass" required minlength="8" autocomplete="new-password" placeholder="Minimal 8 karakter">' + passToggle('nPass') + '</div></div>' +
      '<div class="field"><label class="field-label" for="nPass2">Ulangi password baru <b class="req">*</b></label><div class="input-wrap has-toggle"><i data-ico="lock"></i>' +
      '<input type="password" id="nPass2" required minlength="8" autocomplete="new-password" placeholder="Ulangi password baru">' + passToggle('nPass2') + '</div></div>' +
      '<button class="btn primary block" type="submit">Simpan password baru <span aria-hidden="true">→</span></button>' +
      '<p class="muted small auth-note">Gunakan minimal 8 karakter dan hindari password yang mudah ditebak.</p>' +
      '</form>';
    const formMarkup = tab === 'masuk' ? loginMarkup : tab === 'daftar' ? regMarkup : tab === 'lupa' ? forgotMarkup : resetMarkup;
    const HEADINGS = {
      masuk: ['Selamat datang kembali', 'Masuk ke akun Anda', 'Silakan masuk untuk melanjutkan pencatatan kegiatan harian Anda.'],
      daftar: ['Ruang kerja digital', 'Mulai bersama Day-Log', 'Lengkapi data berikut untuk membuat akun pegawai baru.'],
      lupa: ['Pemulihan akun', 'Lupa password?', 'Masukkan email terdaftar. Kami akan mengirim tautan untuk membuat password baru.'],
      reset: ['Password baru', 'Buat password baru', 'Buat password baru untuk akun Anda, lalu masuk kembali ke Day-Log.']
    };
    const HEAD = HEADINGS[tab] || HEADINGS.masuk;
    const showSeg = tab === 'masuk' || tab === 'daftar';
    const segMarkup = showSeg ? '<div class="seg"><button data-tab="masuk" type="button" class="' + (tab === 'masuk' ? 'on' : '') + '">Masuk</button><button data-tab="daftar" type="button" class="' + (tab === 'daftar' ? 'on' : '') + '">Daftar</button></div>' : '';
    const backMarkup = (tab === 'lupa' || tab === 'reset') ? '<button type="button" class="auth-back" id="gBack"><span aria-hidden="true">←</span> Kembali ke halaman masuk</button>' : '';
    showGate('<div class="auth-layout">' +
      '<section class="auth-showcase">' +
      '<div class="showcase-top"><div class="showcase-brand"><img src="assets/day-log-mark.png" alt="Day-Log">' +
      '<div class="showcase-brand-text"><strong>Day-Log</strong><span>BPS Kota Palopo</span></div></div>' +
      '<span class="showcase-badge">Daily Work Log</span></div>' +
      '<div class="showcase-copy"><span class="showcase-kicker">RUANG KERJA DIGITAL</span>' +
      '<h1>Luangkan Waktu<br><em>Lengkapi Laporan</em></h1>' +
      '<p>Kelola aktivitas harian dengan lebih teratur, praktis, dan profesional dalam satu tempat.</p>' +
      '<div class="showcase-points">' +
      '<div class="showcase-point"><span class="point-ic"><i data-ico="clipboard"></i></span><div><b>Pencatatan lebih rapi</b><small>Simpan kegiatan harian secara terstruktur.</small></div></div>' +
      '<div class="showcase-point"><span class="point-ic"><i data-ico="chart"></i></span><div><b>Pantau progres</b><small>Lihat capaian pekerjaan secara real-time.</small></div></div>' +
      '<div class="showcase-point"><span class="point-ic"><i data-ico="file"></i></span><div><b>Rekap lebih mudah</b><small>Cetak laporan PDF dalam beberapa klik.</small></div></div>' +
      '</div></div>' +
      '<div class="showcase-footer"><span>© ' + new Date().getFullYear() + ' Day-Log</span><span>Badan Pusat Statistik</span></div>' +
      '</section>' +
      '<section class="auth-panel"><div class="auth-card">' +
      '<div class="mobile-auth-logo"><img src="assets/day-log-mark.png" alt="Day-Log"><div><strong>Day-Log</strong><span>BPS Kota Palopo</span></div></div>' +
      '<div class="auth-heading"><span class="auth-eyebrow">' + HEAD[0] + '</span>' +
      '<h2>' + HEAD[1] + '</h2><p>' + HEAD[2] + '</p></div>' +
      segMarkup +
      (notice ? '<div class="info">' + esc(notice) + '</div>' : '') + '<div id="gMsg" class="info warn hidden"></div>' + formMarkup +
      backMarkup +
      '<div class="auth-security"><i data-ico="shield"></i> Akses aman untuk pegawai terdaftar</div></div>' +
      '<div class="auth-copyright">© Day-Log · Sistem pencatatan kegiatan harian</div></section></div>');
    const msg = t => { const m = $('#gMsg'); m.textContent = t; m.classList.toggle('hidden', !t); };
    try {
      const saved = localStorage.getItem('daylog.email') || '';
      if (saved && tab === 'masuk' && $('#aEmail')) { $('#aEmail').value = saved; const rem = $('#aRemember'); if (rem) rem.checked = true; }
      if (saved && tab === 'lupa' && $('#fpEmail')) $('#fpEmail').value = saved;
    } catch (e) { /* abaikan */ }
    $$('.pass-toggle', gate()).forEach(btn => btn.addEventListener('click', () => {
      const input = $('#' + btn.dataset.pass); if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
      const icon = $('i[data-ico]', btn);
      if (icon) { icon.dataset.ico = show ? 'eyeOff' : 'eye'; icon.innerHTML = ''; paintIcons(btn); }
    }));
    $$('.seg button', gate()).forEach(b => b.addEventListener('click', () => showAuth(b.dataset.tab)));
    const gf = $('#gForgot');
    if (gf) gf.addEventListener('click', () => showAuth('lupa'));
    const fl = $('#fLogin'), fr = $('#fReg');
    if (fl) fl.addEventListener('submit', async e => {
      e.preventDefault(); msg('');
      const btn = $('button[type=submit]', fl);
      try {
        if ($('#aRemember') && $('#aRemember').checked) localStorage.setItem('daylog.email', $('#aEmail').value.trim());
        else localStorage.removeItem('daylog.email');
      } catch (e2) { /* abaikan */ }
      await busy([btn], async () => {
        try {
          const r = await sb.auth.signInWithPassword({ email: $('#aEmail').value.trim(), password: $('#aPass').value });
          if (r.error) throw r.error;
          await enter();
        } catch (err) { msg(errMsg(err)); }
      });
    });
    if (fr) fr.addEventListener('submit', async e => {
      e.preventDefault(); msg('');
      const btn = $('button[type=submit]', fr);
      const nama = $('#rNama').value.trim(), email = $('#rEmail').value.trim(), p1 = $('#rPass').value, p2 = $('#rPass2').value;
      if (!nama) { msg('Nama lengkap wajib diisi.'); return; }
      if (p1.length < 8) { msg('Password minimal 8 karakter.'); return; }
      if (p1 !== p2) { msg('Password dan ulangi password tidak sama.'); return; }
      await busy([btn], async () => {
        try {
          const r = await sb.auth.signUp({ email, password: p1, options: { data: { nama, nip: $('#rNip').value.trim() } } });
          if (r.error) throw r.error;
          if (r.data && r.data.user && r.data.user.identities && r.data.user.identities.length === 0) { msg('Email ini sudah terdaftar.'); return; }
          if (r.data && r.data.session) { await enter(); return; }
          showAuth('masuk', 'Pendaftaran berhasil. Jika diminta, konfirmasi email Anda terlebih dahulu, lalu masuk. Akun juga perlu diaktifkan admin.');
        } catch (err) { msg(errMsg(err)); }
      });
    });

    const back = $('#gBack');
    if (back) back.addEventListener('click', async () => {
      recoveryDismissed = true;
      if (tab === 'reset') { try { await sb.auth.signOut(); } catch (e) { /* abaikan */ } clearState(); }
      try { localStorage.removeItem('daylog.recovery'); } catch (e) { /* abaikan */ }
      showAuth('masuk');
    });
    const ff = $('#fForgot');
    if (ff) ff.addEventListener('submit', async e => {
      e.preventDefault(); msg('');
      const btn = $('button[type=submit]', ff);
      const email = $('#fpEmail').value.trim();
      if (!email) { msg('Email wajib diisi.'); return; }
      await busy([btn], async () => {
        try {
          const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
          if (r.error) throw r.error;
          try { localStorage.setItem('daylog.resetEmail', email.toLowerCase()); } catch (e2) { /* abaikan */ }
          showAuth('lupa', 'Tautan pembuatan password baru telah dikirim ke ' + email + '. Buka email Anda (termasuk folder Spam/Junk) lalu ikuti tautannya.');
          const f = $('#fpEmail'); if (f) f.value = email;
        } catch (err) { msg(errMsg(err)); }
      });
    });
    const fReset = $('#fReset');
    if (fReset) fReset.addEventListener('submit', async e => {
      e.preventDefault(); msg('');
      const btn = $('button[type=submit]', fReset);
      const p1 = $('#nPass').value, p2 = $('#nPass2').value;
      if (p1.length < 8) { msg('Password minimal 8 karakter.'); return; }
      if (p1 !== p2) { msg('Password baru dan ulangi password tidak sama.'); return; }
      await busy([btn], async () => {
        try {
          let session = null;
          for (let i = 0; i < 15; i++) {
            const s = await sb.auth.getSession();
            session = s.data && s.data.session;
            if (session) break;
            await new Promise(r => setTimeout(r, 200));
          }
          if (!session) throw new Error('Tautan reset tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.');
          let expected = '';
          try { expected = (localStorage.getItem('daylog.resetEmail') || '').toLowerCase(); } catch (e2) { /* abaikan */ }
          if (expected && session.user && session.user.email && session.user.email.toLowerCase() !== expected) {
            throw new Error('Sesi reset tidak cocok dengan email yang meminta reset. Silakan buka tautan terbaru dari email Anda.');
          }
          const r = await sb.auth.updateUser({ password: p1 });
          if (r.error) throw r.error;
          try { await sb.auth.signOut(); } catch (e2) { /* abaikan */ }
          try { localStorage.removeItem('daylog.recovery'); } catch (e2) { /* abaikan */ }
          try { localStorage.removeItem('daylog.resetEmail'); } catch (e2) { /* abaikan */ }
          clearState();
          try { history.replaceState(null, '', location.origin + location.pathname); } catch (e2) { /* abaikan */ }
          showAuth('masuk', 'Password berhasil diperbarui. Silakan masuk dengan password baru Anda.');
        } catch (err) { msg(errMsg(err)); }
      });
    });
  }

  /* ------------------------- Sesi & pemuatan data ------------------------- */
  async function loadAll() {
    const since = (new Date().getFullYear() - 2) + '-01-01';
    state.since = since;
    const holidaysPromise = fetchAll((a, b) => sb.from('hari_libur').select('*').order('tanggal').range(a, b))
      .catch(e => { state.holidayError = e; return []; });
    const timPromise = fetchAll((a, b) => sb.from('tim').select('*').order('nama').range(a, b))
      .then(r => { state.timError = null; return r; })
      .catch(e => { state.timError = e; return []; });
    const res = await Promise.all([
      fetchAll((a, b) => sb.from('pegawai').select('*').order('nama').range(a, b)),
      fetchAll((a, b) => sb.from('kegiatan').select('*').gte('tanggal', since).order('tanggal', { ascending: false }).order('id').range(a, b)),
      dbCall(sb.from('pengaturan').select('*').eq('id', 1).maybeSingle()),
      holidaysPromise,
      timPromise
    ]);
    state.pegawai = res[0].map(mapPeg);
    state.tims = res[4].map(mapTim);
    // Ketua tim menerima juga kegiatan pegawai lain yang tugasnya berasal dari timnya.
    // Itu disimpan terpisah (state.penilaian) supaya riwayat, rekap, dan laporan tetap hanya memuat data milik sendiri.
    const allKeg = res[1].map(mapKeg);
    if (isAdmin()) { state.kegiatan = allKeg; state.penilaian = []; }
    else {
      state.kegiatan = allKeg.filter(k => k.pegawaiId === state.me.id);
      state.penilaian = allKeg.filter(k => k.pegawaiId !== state.me.id);
    }
    if (res[2]) state.settings = Object.assign({}, DEFAULT_SETTINGS, mapSet(res[2]));
    state.holidays = res[3].map(mapLibur);
    state.loadedAt = Date.now();
    const mine = state.pegawai.find(p => p.id === state.me.id);
    if (mine) Object.assign(state.me, mine);
  }

  async function enter() {
    gateLoading('Memuat data...');
    try {
      const s = await sb.auth.getSession();
      const session = s.data && s.data.session;
      if (!session) { showAuth(); return; }
      const row = await dbCall(sb.from('pegawai').select('*').eq('user_id', session.user.id).maybeSingle());
      if (!row) { showError('Profil pegawai untuk akun ini tidak ditemukan. Hubungi admin.'); return; }
      state.me = Object.assign(mapPeg(row), { email: session.user.email });
      if (!state.me.aktif) { showPending(); return; }
      await loadAll();
      startApp();
    } catch (e) { showError(errMsg(e)); }
  }

  function clearState() {
    state.me = null; state.pegawai = []; state.kegiatan = []; state.penilaian = []; state.tims = []; state.timError = null; state.holidays = []; state.holidayError = null; state.settings = Object.assign({}, DEFAULT_SETTINGS); state.loadedAt = 0;
    $('#view').innerHTML = '';
  }
  async function logout() {
    try { await sb.auth.signOut(); } catch (e) { /* abaikan */ }
    clearState(); location.hash = ''; showAuth();
  }

  function startApp() {
    gate().classList.add('hidden');
    $('#app').classList.remove('hidden');
    applyBrand(); applyRoleUI();
    render();
    if (!isAdmin() && state.me) {
      const t = todayISO(), w = new Date(t + 'T00:00:00').getDay();
      const workday = w !== 0 && w !== 6 && !holidayOn(t);
      const filled = state.kegiatan.some(k => k.pegawaiId === state.me.id && k.tanggal === t);
      if (workday && !filled) setTimeout(() => toast('Pengingat: Anda belum mengisi laporan kegiatan hari ini.', 'err'), 700);
    }
  }
  function applyRoleUI() {
    $$('[data-admin]').forEach(el => el.classList.toggle('hidden', !isAdmin()));
    $$('[data-ketua]').forEach(el => el.classList.toggle('hidden', !isKetua()));
    $('#topUser').textContent = state.me ? state.me.nama + ' · ' + (isAdmin() ? 'Admin' : isKetua() ? 'Ketua ' + myTims().map(t => t.nama).join(', ') : 'Pegawai') : '';
  }
  function applyBrand() {
    $('#brandSub').textContent = 'Daily Work Log · Laporan Kegiatan Harian Pegawai' + (state.settings.satker ? ' - ' + state.settings.satker : '');
  }

  /* ------------------------- Router ------------------------- */
  const routes = {};
  const ADMIN_ONLY = ['pegawai', 'data', 'tim'];
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('?');
    return { route: parts[0] || 'dashboard', params: new URLSearchParams(parts[1] || '') };
  }
  function go(route) { location.hash = '#/' + route; }
  function render() {
    if (!state.me) return;
    const r = parseHash();
    let key = routes[r.route] ? r.route : 'dashboard';
    if (ADMIN_ONLY.indexOf(key) >= 0 && !isAdmin()) key = 'dashboard';
    if (key === 'penilaian' && !isKetua()) key = 'dashboard';
    const view = $('#view');
    view.innerHTML = '';
    routes[key](view, r.params);
    paintIcons(view);
    $$('#sidebar nav a').forEach(a => a.classList.toggle('active', a.dataset.route === key));
    closeSide();
    window.scrollTo(0, 0);
  }
  function closeSide() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }

  const pageHead = (title, sub, actions) =>
    '<div class="page-head"><div><h1>' + title + '</h1><p>' + sub + '</p></div><div class="actions">' + (actions || '') + '</div></div>';
  const pegOpts = (list, selected, placeholder) =>
    (placeholder ? '<option value="">' + placeholder + '</option>' : '') +
    list.map(p => '<option value="' + p.id + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.nama) + '</option>').join('');

  /* ------------------------- Dashboard ------------------------- */
  let dashboardDate = todayISO();
  let dashboardMonth = todayISO().slice(0, 7);
  routes.dashboard = function (el) {
    const admin = isAdmin();
    const today = todayISO();
    const ym = dashboardMonth || today.slice(0, 7);
    const day = dashboardDate || today;
    const monthList = state.kegiatan.filter(k => k.tanggal.startsWith(ym));
    const dayList = state.kegiatan.filter(k => k.tanggal === day);
    const dayOfWeek = new Date(day + 'T00:00:00').getDay();
    const dayHoliday = holidayOn(day);
    const isWorkday = dayOfWeek !== 0 && dayOfWeek !== 6;
    const requiredDay = isWorkday && !dayHoliday;
    const todayDow = new Date(today + 'T00:00:00').getDay();
    const todayHoliday = holidayOn(today);
    const todayIsWorkday = todayDow !== 0 && todayDow !== 6 && !todayHoliday;
    const selesai = monthList.filter(k => k.status === 'Selesai').length;
    const recent = state.kegiatan.slice().sort(sortKeg).slice(0, 8);
    const aktif = state.pegawai.filter(p => p.aktif);
    const sudahIds = new Set(monthList.map(k => k.pegawaiId));
    const sudah = aktif.filter(p => sudahIds.has(p.id)).length;
    const belumHarian = requiredDay ? aktif.filter(p => !dayList.some(k => k.pegawaiId === p.id)) : [];
    const sudahHarian = aktif.filter(p => dayList.some(k => k.pegawaiId === p.id)).length;
    const pctHarian = aktif.length && requiredDay ? Math.round(sudahHarian / aktif.length * 100) : 0;
    const pctBulan = aktif.length ? Math.round(sudah / aktif.length * 100) : 0;
    const todayFilledIds = new Set(state.kegiatan.filter(k => k.tanggal === today).map(k => k.pegawaiId));
    const todayMissing = todayIsWorkday ? aktif.filter(p => !todayFilledIds.has(p.id)) : [];
    const myToday = state.kegiatan.filter(k => k.pegawaiId === state.me.id && k.tanggal === today).length;
    const myMonthDays = workdaysInMonth(today.slice(0, 7));
    const myMissing = missingWorkdays(state.me.id, today.slice(0, 7));
    const myMonthFilled = myMonthDays.length - myMissing.length;
    const myMonthHolidays = (state.holidays || []).filter(h => h.tanggal.startsWith(today.slice(0, 7))).length;
    const stats = admin
      ? [[aktif.length, 'Pegawai aktif', 'users', ''], [dayList.length, 'Laporan tanggal dipilih', 'clipboard', 'p'], [sudahHarian + '/' + aktif.length, 'Sudah mengisi tanggal dipilih', 'check', 'g'], [belumHarian.length, 'Belum mengisi tanggal dipilih', 'user', 'a']]
      : [[myToday, 'Kegiatan hari ini', 'clipboard', 'p'], [monthList.filter(k => k.pegawaiId === state.me.id).length, 'Kegiatan bulan ini', 'list', ''], [selesai, 'Kegiatan selesai bulan ini', 'check', 'g'], [myMissing.length, 'Hari kerja belum terisi', 'user', 'a']];
    const counts = aktif.map(p => {
      const days = new Set(monthList.filter(k => k.pegawaiId === p.id).map(k => k.tanggal)).size;
      const workdays = weekdaysInMonthToDate(ym);
      return { p, days, missing: missingWorkdays(p.id, ym), pct: workdays ? Math.min(100, Math.round(days / workdays * 100)) : 0 };
    });
    const missingNames = todayMissing.slice(0, 6).map(p => p.nama).join(', ') + (todayMissing.length > 6 ? ', +' + (todayMissing.length - 6) + ' lainnya' : '');
    const alertHtml = admin
      ? (todayIsWorkday && todayMissing.length
        ? '<div class="alert-strip warn"><div class="alert-ic">' + ico('user') + '</div><div class="alert-copy"><b>' + todayMissing.length + ' pegawai belum mengisi laporan hari ini</b><span>' + esc(missingNames) + ' · ' + dayName(today) + ', ' + fmtTgl(today) + '</span></div><a class="btn ghost sm" href="#/rekap">Lihat rekap</a></div>'
        : '')
      : (todayIsWorkday && myToday === 0
        ? '<div class="alert-strip warn"><div class="alert-ic">' + ico('clipboard') + '</div><div class="alert-copy"><b>Anda belum mengisi laporan hari ini</b><span>Lengkapi laporan ' + dayName(today) + ', ' + fmtTgl(today) + ' agar tidak tercatat sebagai hari kosong pada rekap bulanan.</span></div><a class="btn primary sm" href="#/input">Isi sekarang</a></div>'
        : '');
    const tIds = new Set(myTims().map(t => t.id));
    const toRate = state.penilaian.filter(k => tIds.has(k.asalTimId) && k.nilai == null).length;
    const ketuaAlert = (!admin && isKetua() && toRate)
      ? '<div class="alert-strip warn"><div class="alert-ic">' + ico('clipboard') + '</div><div class="alert-copy"><b>' + toRate + ' tugas dari ' + esc(myTims().map(t => t.nama).join(', ')) + ' menunggu penilaian Anda</b><span>Pegawai tim lain telah mencatat kegiatan yang berasal dari tim Anda.</span></div><a class="btn primary sm" href="#/penilaian">Nilai sekarang</a></div>'
      : '';
    const now = new Date(), trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + pad(d.getMonth() + 1);
      trend.push({ label: BULAN_S[d.getMonth()], n: state.kegiatan.filter(k => k.tanggal.startsWith(key)).length });
    }
    const maxT = Math.max(1, ...trend.map(t => t.n));
    const dailyMonitor = admin
      ? '<section class="card monitor-card"><div class="monitor-head"><div><span class="eyebrow">MONITORING HARIAN</span><h2>Aktivitas pengisian pegawai</h2><p class="sub">Pantau siapa yang sudah dan belum mengirim laporan.</p></div><label class="compact-label">Pilih tanggal<input type="date" id="dashDate" value="' + esc(day) + '"></label></div>' +
        '<div class="completion"><div class="completion-copy"><strong>' + sudahHarian + ' dari ' + aktif.length + ' pegawai</strong><span>' + (requiredDay ? pctHarian + '% telah mengisi pada ' + fmtTgl(day) : (dayHoliday ? 'Tanggal merah · ' + esc(dayHoliday.keterangan || 'Libur') + ' · tidak dihitung sebagai hari kerja' : 'Akhir pekan · tidak dihitung sebagai hari kerja')) + '</span></div><div class="bar large"><span style="width:' + pctHarian + '%"></span></div></div>' +
        '<div class="monitor-columns"><div><h3><span class="dot success"></span>Sudah mengisi <b>' + sudahHarian + '</b></h3>' +
        (sudahHarian ? '<ul class="person-list">' + aktif.filter(p => dayList.some(k => k.pegawaiId === p.id)).map(p => '<li><span class="avatar-mini">' + esc((p.nama || '?').trim().slice(0,1).toUpperCase()) + '</span><span>' + esc(p.nama) + '</span><span class="tag-done">Terkirim</span></li>').join('') + '</ul>' : '<div class="empty compact">Belum ada laporan pada tanggal ini.</div>') +
        '</div><div><h3><span class="dot warning"></span>Belum mengisi <b>' + belumHarian.length + '</b></h3>' +
        (belumHarian.length ? '<ul class="person-list">' + belumHarian.map(p => '<li><span class="avatar-mini muted-avatar">' + esc((p.nama || '?').trim().slice(0,1).toUpperCase()) + '</span><span>' + esc(p.nama) + '</span><span class="tag-pending">Belum</span></li>').join('') + '</ul>' : '<div class="empty compact">' + (requiredDay ? 'Semua pegawai sudah mengisi.' : (dayHoliday ? 'Tanggal merah · tidak ada kewajiban mengisi.' : 'Akhir pekan · tidak ada kewajiban mengisi.')) + '</div>') +
        '</div></div></section>'
      : '';
    const monthlyMonitor = admin
      ? '<section class="card monitor-card"><div class="monitor-head"><div><span class="eyebrow">MONITORING BULANAN</span><h2>Rekap pengisian per pegawai</h2><p class="sub">Perbandingan hari yang sudah diisi dengan hari kerja berjalan (Senin–Jumat, di luar tanggal merah).</p></div><label class="compact-label">Pilih bulan<input type="month" id="dashMonth" value="' + esc(ym) + '"></label></div>' +
        '<div class="completion"><div class="completion-copy"><strong>' + sudah + ' dari ' + aktif.length + ' pegawai telah mengisi</strong><span>' + pctBulan + '% pegawai aktif mengirim minimal satu laporan</span></div><div class="bar large"><span style="width:' + pctBulan + '%"></span></div></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>Nama Pegawai</th><th>Hari Terisi</th><th>Hari Kosong</th><th>Progres Hari Kerja</th></tr></thead><tbody>' +
        (counts.length ? counts.map(c => '<tr><td><b>' + esc(c.p.nama) + '</b></td><td>' + c.days + ' hari</td><td class="missing-cell">' + (c.missing.length ? '<b>' + c.missing.length + ' hari</b><div class="muted small" title="' + esc(c.missing.map(fmtTgl).join(', ')) + '">' + esc(shortDateList(c.missing)) + '</div>' : '<span class="tag-done">Lengkap</span>') + '</td><td><div class="progress-cell"><div class="bar"><span style="width:' + c.pct + '%"></span></div><b>' + c.pct + '%</b></div></td></tr>').join('') : '<tr><td colspan="4" class="empty">Belum ada pegawai aktif.</td></tr>') +
        '</tbody></table></div><p class="note-inline">Hari kosong dihitung dari hari kerja Senin–Jumat yang belum ada laporan hingga hari ini. Akhir pekan serta tanggal merah/cuti bersama pada kalender hari libur tidak dihitung.</p></section>'
      : '<section class="card"><div class="monitor-head"><div><span class="eyebrow">KEPATUHAN BULAN INI</span><h2>Progres laporan Anda</h2><p class="sub">' + monthLabel(today.slice(0, 7)) + ' · hari kerja Senin–Jumat' + (myMonthHolidays ? ' · ' + myMonthHolidays + ' tanggal merah dikecualikan' : '') + '</p></div></div>' +
        '<div class="completion"><div class="completion-copy"><strong>' + myMonthFilled + ' dari ' + myMonthDays.length + ' hari kerja terisi</strong><span>' + (myMissing.length ? myMissing.length + ' hari belum terisi' : 'Semua hari kerja sudah terisi') + '</span></div><div class="bar large"><span style="width:' + (myMonthDays.length ? Math.min(100, Math.round(myMonthFilled / myMonthDays.length * 100)) : 0) + '%"></span></div></div>' +
        (myMissing.length
          ? '<div class="missing-box"><b>Hari kerja belum terisi (' + myMissing.length + ')</b><div class="date-chips">' + myMissing.map(d => '<span class="date-chip">' + (+d.slice(8, 10)) + ' ' + BULAN_S[+d.slice(5, 7) - 1] + '</span>').join('') + '</div><p>Anda masih bisa mengisi laporan susulan untuk tanggal tersebut melalui menu Input Kegiatan.</p></div>'
          : '<div class="info ok" style="margin:0">Semua hari kerja bulan ini sudah terisi. Terima kasih telah disiplin mencatat kegiatan.</div>') +
        '<div class="form-actions" style="margin-top:14px"><a class="btn primary" href="#/input">' + ico('plus') + 'Input Kegiatan</a><a class="btn ghost" href="#/rekap">' + ico('chart') + 'Lihat Rekap</a></div></section>';
    el.innerHTML =
      pageHead('Dashboard', (admin ? 'Monitoring laporan kegiatan harian pegawai · ' : 'Ringkasan kegiatan Anda · ') + esc(state.settings.satker),
        '<a class="btn primary" href="#/input">' + ico('plus') + 'Input Kegiatan</a>') +
      '<div class="welcome-strip"><div><span class="eyebrow">DAY-LOG · DAILY WORK LOG</span><h2>' + (admin ? 'Selamat datang di pusat monitoring' : 'Selamat datang kembali') + '</h2><p>Catat aktivitas, pantau progres, dan kelola laporan harian dalam satu tempat.</p></div><div class="welcome-mark">' + ico('clipboard') + '</div></div>' +
      alertHtml + ketuaAlert +
      '<div class="stats">' + stats.map(s => '<div class="card stat ' + s[3] + '"><div><b>' + s[0] + '</b><span>' + s[1] + '</span></div><div class="ic">' + ico(s[2]) + '</div></div>').join('') + '</div>' +
      (admin ? dailyMonitor + monthlyMonitor : '') +
      '<div class="grid-main"><div class="stack">' +
      '<div class="card"><h2>Kegiatan Terbaru</h2><p class="sub">8 kegiatan terakhir yang dicatat</p>' +
      (recent.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Pegawai</th><th>Kegiatan dan Output</th><th>Status</th></tr></thead><tbody>' +
        recent.map(k => '<tr><td class="small">' + fmtTgl(k.tanggal) + '</td><td>' + esc(pegName(k.pegawaiId)) + '</td><td>' + esc(k.uraian) + (k.output ? '<div class="muted small">Output: ' + esc(k.output) + '</div>' : '') + '</td><td>' + badge(k.status) + '</td></tr>').join('') +
        '</tbody></table></div>' : '<div class="empty">Belum ada kegiatan. Mulai dengan menekan tombol <b>Input Kegiatan</b>.</div>') + '</div>' +
      '<div class="card"><h2>Tren 6 Bulan Terakhir</h2><p class="sub">Jumlah kegiatan yang dicatat per bulan</p><div class="chart">' +
      trend.map((t, i) => '<div class="col' + (i === trend.length - 1 ? ' cur' : '') + '"><span class="v">' + t.n + '</span><div class="b" style="height:' + Math.round(t.n / maxT * 100) + '%"></div><span class="l">' + t.label + '</span></div>').join('') +
      '</div></div></div></div>';
    if (admin) {
      $('#dashDate').addEventListener('change', e => { dashboardDate = e.target.value || todayISO(); render(); });
      $('#dashMonth').addEventListener('change', e => { dashboardMonth = e.target.value || todayISO().slice(0,7); render(); });
    }
  };
  function weekdaysInMonthToDate(ym) { return workdaysInMonth(ym).length; }

  /* ------------------------- Input Kegiatan ------------------------- */
  routes.input = function (el, params) {
    const id = params.get('id');
    const edit = id ? state.kegiatan.find(k => k.id === id) : null;
    const admin = isAdmin();
    const pegs = admin ? state.pegawai.filter(p => p.aktif || (edit && p.id === edit.pegawaiId)) : [state.me];
    const last = store('lastPeg');
    const v = edit || { pegawaiId: admin ? (pegs.some(p => p.id === last) ? last : '') : state.me.id, tanggal: todayISO(), uraian: '', output: '', kategori: KATEGORI[0], status: 'Selesai', keterangan: '', evidenceUrl: '', asalTimId: '' };

    el.innerHTML =
      pageHead(edit ? 'Ubah Kegiatan' : 'Input Kegiatan', 'Catat kegiatan harian dengan singkat dan jelas') +
      '<div class="card" style="max-width:820px"><form id="fKeg">' +
      '<div class="grid2"><label>Nama Pegawai *<select id="kPeg" required' + (admin ? '' : ' disabled') + '>' + pegOpts(pegs, v.pegawaiId, admin ? '-- Pilih pegawai --' : '') + '</select></label>' +
      '<label>Tanggal *<input type="date" id="kTgl" required value="' + v.tanggal + '"></label></div>' +
      '<label>Uraian Kegiatan *<textarea id="kUr" required maxlength="2000" placeholder="Tuliskan kegiatan yang dikerjakan...">' + esc(v.uraian) + '</textarea></label>' +
      '<div class="grid2"><label>Output / Hasil Kerja<input id="kOut" maxlength="200" value="' + esc(v.output) + '" placeholder="Contoh: 1 laporan, 45 dokumen"></label>' +
      '<label>Kategori<select id="kKat">' + KATEGORI.map(k => '<option' + (k === v.kategori ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></label></div>' +
      '<div class="grid2"><label>Status<select id="kSt">' + STATUS.map(s => '<option' + (s === v.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label>' +
      '<label>Keterangan<input id="kKet" maxlength="255" value="' + esc(v.keterangan) + '" placeholder="Opsional"></label></div>' +
      (state.tims.length ? '<label>Tugas berasal dari tim <span class="optional">(opsional)</span><select id="kTim"><option value="">-- Tidak dipilih --</option>' + state.tims.map(t => '<option value="' + t.id + '"' + (t.id === v.asalTimId ? ' selected' : '') + '>' + esc(t.nama) + '</option>').join('') + '</select><small class="field-hint">Pilih bila tugas ini diberikan oleh tim lain. Ketua tim tersebut dapat menilai kegiatan ini.' + (edit && edit.nilai != null ? ' Mengubah asal tim akan menghapus nilai yang sudah diberikan.' : '') + '</small></label>' : '') +
      '<label>Link Bukti Dukung (Google Drive / OneDrive)<input id="kEvidence" type="url" maxlength="1000" value="' + esc(v.evidenceUrl || '') + '" placeholder="https://drive.google.com/..." ><small class="field-hint">Simpan tautan ke file atau folder bukti kegiatan. Atur akses agar Kepala BPS dapat melihatnya.</small></label>' +
      '<div class="form-actions"><button class="btn primary" type="submit">' + ico('check') + (edit ? 'Simpan Perubahan' : 'Simpan') + '</button>' +
      (edit ? '' : '<button class="btn ghost" type="submit" data-again="1">' + ico('plus') + 'Simpan &amp; Tambah Lagi</button>') +
      '<a class="btn ghost" href="#/riwayat">Batal</a></div></form></div>';

    let again = false;
    $$('#fKeg button[type=submit]').forEach(b => b.addEventListener('click', () => { again = !!b.dataset.again; }));
    $('#fKeg').addEventListener('submit', async e => {
      e.preventDefault();
      const row = { pegawai_id: $('#kPeg').value, tanggal: $('#kTgl').value, uraian: $('#kUr').value.trim(), output: $('#kOut').value.trim(), kategori: $('#kKat').value, status: $('#kSt').value, keterangan: $('#kKet').value.trim(), evidence_url: $('#kEvidence').value.trim() || null };
      if (!state.timError) row.asal_tim_id = ($('#kTim') && $('#kTim').value) || null;
      if (row.evidence_url && !/^https:\/\//i.test(row.evidence_url)) { toast('Link bukti dukung harus diawali https://', 'err'); return; }
      if (!row.pegawai_id || !row.tanggal || !row.uraian) { toast('Pegawai, tanggal, dan uraian wajib diisi.', 'err'); return; }
      await busy($$('#fKeg button[type=submit]'), async () => {
        try {
          if (edit) {
            const d = await dbCall(sb.from('kegiatan').update(row).eq('id', edit.id).select().single());
            Object.assign(edit, mapKeg(d));
          } else {
            const d = await dbCall(sb.from('kegiatan').insert(row).select().single());
            state.kegiatan.push(mapKeg(d));
          }
          if (admin) store('lastPeg', row.pegawai_id);
          toast(edit ? 'Perubahan disimpan.' : 'Kegiatan berhasil disimpan.', 'ok');
          if (!edit && again) { $('#kUr').value = ''; $('#kOut').value = ''; $('#kKet').value = ''; $('#kUr').focus(); }
          else go('riwayat');
        } catch (err) { toast(errMsg(err), 'err'); }
      });
    });
  };
  function store(k, v) { try { if (v === undefined) return localStorage.getItem('sikhari.' + k) || ''; localStorage.setItem('sikhari.' + k, v); } catch (e) { return ''; } }

  /* ------------------------- Riwayat ------------------------- */
  const fl = { q: '', peg: '', bulan: null, status: '' };
  routes.riwayat = function (el) {
    if (fl.bulan === null) fl.bulan = todayISO().slice(0, 7);
    const admin = isAdmin();
    el.innerHTML =
      pageHead('Riwayat Kegiatan', 'Cari, ubah, atau hapus kegiatan yang sudah dicatat', '<a class="btn primary" href="#/input">' + ico('plus') + 'Input Kegiatan</a>') +
      '<div class="card"><div class="filters">' +
      '<label>Cari<input id="fQ" placeholder="Cari uraian, output..." value="' + esc(fl.q) + '"></label>' +
      (admin ? '<label>Pegawai<select id="fP">' + pegOpts(state.pegawai, fl.peg, 'Semua pegawai') + '</select></label>' : '<div></div>') +
      '<label>Bulan<input type="month" id="fB" value="' + fl.bulan + '"></label>' +
      '<label>Status<select id="fS"><option value="">Semua</option>' + STATUS.map(s => '<option' + (s === fl.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label>' +
      '</div><div id="rwInfo" class="muted small" style="margin:8px 2px 12px"></div><div id="rwTable"></div></div>';

    const draw = () => {
      let list = state.kegiatan.filter(k =>
        (!fl.peg || k.pegawaiId === fl.peg) && (!fl.bulan || k.tanggal.startsWith(fl.bulan)) && (!fl.status || k.status === fl.status) &&
        (!fl.q || (k.uraian + ' ' + k.output + ' ' + k.keterangan + ' ' + pegName(k.pegawaiId)).toLowerCase().includes(fl.q.toLowerCase())));
      list.sort(sortKeg);
      const total = list.length; list = list.slice(0, 200);
      $('#rwInfo').textContent = 'Menampilkan ' + list.length + ' dari ' + total + ' kegiatan' + (fl.bulan ? ' (' + monthLabel(fl.bulan) + ')' : '') + '. Data dimuat sejak ' + fmtTgl(state.since) + '.';
      $('#rwTable').innerHTML = list.length ?
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Pegawai</th><th>Uraian Kegiatan</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(k => '<tr><td class="small" style="white-space:nowrap">' + dayName(k.tanggal) + '<br>' + fmtTgl(k.tanggal) + '</td><td>' + esc(pegName(k.pegawaiId)) + '</td><td>' + esc(k.uraian) +
          (k.output ? '<div class="muted small">Output: ' + esc(k.output) + '</div>' : '') + (k.keterangan ? '<div class="muted small">Ket: ' + esc(k.keterangan) + '</div>' : '') +
          (k.evidenceUrl ? '<div class="muted small"><a href="' + esc(k.evidenceUrl) + '" target="_blank" rel="noopener">Lihat bukti dukung ↗</a></div>' : '') +
          (k.asalTimId ? '<div class="muted small">Tugas dari: ' + esc(timName(k.asalTimId) || '(tim dihapus)') + '</div>' : '') +
          (k.nilai != null ? '<div class="nilai-note">' + nilaiBadge(k.nilai) + (k.nilaiCatatan ? '<span class="small"> Catatan ketua tim: ' + esc(k.nilaiCatatan) + '</span>' : '') + '</div>' : '') +
          '<span class="tag">' + esc(k.kategori || 'Lainnya') + '</span></td><td>' + badge(k.status) + '</td>' +
          '<td><div class="row-actions"><a class="btn ghost sm" href="#/input?id=' + k.id + '" title="Ubah">' + ico('edit') + '</a><button class="btn danger sm" data-del="' + k.id + '" title="Hapus">' + ico('trash') + '</button></div></td></tr>').join('') +
        '</tbody></table></div>' : '<div class="empty">Tidak ada kegiatan yang cocok dengan filter.</div>';
      paintIcons($('#rwTable'));
      $$('[data-del]', $('#rwTable')).forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Hapus kegiatan ini? Tindakan tidak dapat dibatalkan.')) return;
        await busy([b], async () => {
          try {
            await dbCall(sb.from('kegiatan').delete().eq('id', b.dataset.del));
            state.kegiatan = state.kegiatan.filter(k => k.id !== b.dataset.del); draw(); toast('Kegiatan dihapus.');
          } catch (err) { toast(errMsg(err), 'err'); }
        });
      }));
    };
    $('#fQ').addEventListener('input', e => { fl.q = e.target.value; draw(); });
    if (admin) $('#fP').addEventListener('change', e => { fl.peg = e.target.value; draw(); });
    $('#fB').addEventListener('change', e => { fl.bulan = e.target.value; draw(); });
    $('#fS').addEventListener('change', e => { fl.status = e.target.value; draw(); });
    draw();
  };

  /* ------------------------- Data Tim (admin) ------------------------- */
  routes.tim = function (el) {
    const rows = state.tims.map(t => {
      const ks = state.kegiatan.filter(k => k.asalTimId === t.id), dn = ks.filter(k => k.nilai != null);
      const avg = dn.length ? Math.round(dn.reduce((a, k) => a + k.nilai, 0) / dn.length * 10) / 10 : null;
      return { t, total: ks.length, dinilai: dn.length, avg };
    });
    el.innerHTML =
      pageHead('Data Tim', 'Kelola daftar tim dan tunjuk ketua tim', '<button class="btn primary" id="btnAddTim"' + (state.timError ? ' disabled' : '') + '>' + ico('plus') + 'Tambah Tim</button>') +
      (state.timError ? '<div class="info warn">Tabel <b>tim</b> belum tersedia di database. Jalankan file <code>supabase/migrasi-ketua-tim.sql</code> di SQL Editor Supabase, lalu muat ulang halaman.</div>' : '') +
      '<div class="info">Ketua tim ditunjuk di sini. Pegawai yang menjadi ketua tim otomatis mendapat menu <b>Penilaian Tugas</b> untuk menilai kegiatan pegawai lain yang tugasnya berasal dari timnya.</div>' +
      '<div class="card">' + (rows.length ?
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>No</th><th>Nama Tim</th><th>Ketua Tim</th><th class="num">Tugas Diberikan</th><th class="num">Sudah Dinilai</th><th class="num">Rata-rata Nilai</th><th></th></tr></thead><tbody>' +
        rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><b>' + esc(r.t.nama) + '</b></td><td>' + (r.t.ketuaId ? esc(pegName(r.t.ketuaId)) : '<span class="muted">Belum ditunjuk</span>') + '</td><td class="num">' + r.total + '</td><td class="num">' + r.dinilai + '</td><td class="num">' + (r.avg == null ? '-' : r.avg + ' · ' + nilaiKat(r.avg)) + '</td>' +
          '<td><div class="row-actions"><button class="btn ghost sm" data-edit-tim="' + r.t.id + '" title="Ubah">' + ico('edit') + '</button><button class="btn danger sm" data-del-tim="' + r.t.id + '" title="Hapus">' + ico('trash') + '</button></div></td></tr>').join('') +
        '</tbody></table></div>' : '<div class="empty">Belum ada tim. Tekan <b>Tambah Tim</b> untuk membuat daftar tim kantor.</div>') + '</div>';
    $('#btnAddTim').addEventListener('click', () => openTim());
    $$('[data-edit-tim]', el).forEach(b => b.addEventListener('click', () => openTim(b.dataset.editTim)));
    $$('[data-del-tim]', el).forEach(b => b.addEventListener('click', async () => {
      const t = timById(b.dataset.delTim);
      const n = state.kegiatan.filter(k => k.asalTimId === t.id).length;
      if (!confirm('Hapus tim "' + t.nama + '"?' + (n ? '\n' + n + ' kegiatan akan kehilangan keterangan asal tim (nilai yang sudah ada tetap tersimpan).' : ''))) return;
      await busy([b], async () => {
        try {
          await dbCall(sb.from('tim').delete().eq('id', t.id));
          state.tims = state.tims.filter(x => x.id !== t.id);
          state.kegiatan.forEach(k => { if (k.asalTimId === t.id) k.asalTimId = ''; });
          applyRoleUI(); toast('Tim dihapus.'); render();
        } catch (err) { toast(errMsg(err), 'err'); }
      });
    }));
  };
  function openTim(id) {
    const t = id ? timById(id) : { id: '', nama: '', ketuaId: '' };
    $('#dlgTimTitle').textContent = id ? 'Ubah Tim' : 'Tambah Tim';
    $('#tId').value = t.id; $('#tNama').value = t.nama;
    $('#tKetua').innerHTML = pegOpts(state.pegawai.filter(p => p.aktif || p.id === t.ketuaId), t.ketuaId, '-- Belum ditunjuk --');
    $('#dlgTim').showModal();
  }
  function initTimDialog() {
    $('#tCancel').addEventListener('click', () => $('#dlgTim').close());
    $('#formTim').addEventListener('submit', async e => {
      e.preventDefault();
      const nama = $('#tNama').value.trim(); if (!nama) return;
      const row = { nama, ketua_id: $('#tKetua').value || null }, id = $('#tId').value;
      const btn = $('#formTim button[type=submit]');
      await busy([btn], async () => {
        try {
          if (id) { const d = await dbCall(sb.from('tim').update(row).eq('id', id).select().single()); Object.assign(timById(id), mapTim(d)); }
          else { const d = await dbCall(sb.from('tim').insert(row).select().single()); state.tims.push(mapTim(d)); }
          state.tims.sort((a, b) => a.nama.localeCompare(b.nama));
          $('#dlgTim').close(); applyRoleUI(); toast('Data tim disimpan.', 'ok');
          if (parseHash().route === 'tim') render();
        } catch (err) { toast(errMsg(err), 'err'); }
      });
    });
  }

  /* ------------------------- Penilaian Tugas (ketua tim) ------------------------- */
  const pf = { q: '', tim: '', bulan: null, status: 'belum' };
  routes.penilaian = function (el) {
    if (pf.bulan === null) pf.bulan = todayISO().slice(0, 7);
    const mine = myTims(), ids = new Set(mine.map(t => t.id));
    el.innerHTML =
      pageHead('Penilaian Tugas', 'Nilai kegiatan pegawai yang tugasnya berasal dari ' + esc(mine.map(t => t.nama).join(', '))) +
      '<div class="info">Skala penilaian: <b>96–100</b> Sangat Baik · <b>90–95</b> Baik · <b>85–89</b> Cukup · <b>0–84</b> Kurang. Pegawai yang bersangkutan dapat melihat nilai dan catatan Anda.</div>' +
      '<div class="card"><div class="filters">' +
      '<label>Cari<input id="pQ" placeholder="Cari pegawai atau uraian..." value="' + esc(pf.q) + '"></label>' +
      (mine.length > 1 ? '<label>Tim asal tugas<select id="pT"><option value="">Semua tim saya</option>' + mine.map(t => '<option value="' + t.id + '"' + (t.id === pf.tim ? ' selected' : '') + '>' + esc(t.nama) + '</option>').join('') + '</select></label>' : '<div></div>') +
      '<label>Bulan<input type="month" id="pB" value="' + pf.bulan + '"></label>' +
      '<label>Status<select id="pS"><option value="belum"' + (pf.status === 'belum' ? ' selected' : '') + '>Belum dinilai</option><option value="sudah"' + (pf.status === 'sudah' ? ' selected' : '') + '>Sudah dinilai</option><option value=""' + (pf.status === '' ? ' selected' : '') + '>Semua</option></select></label>' +
      '</div><div id="pInfo" class="muted small" style="margin:8px 2px 12px"></div><div id="pList"></div></div>';

    const itemHtml = k => {
      const p = pegById(k.pegawaiId) || {};
      return '<div class="nilai-item" data-id="' + k.id + '"><div class="nilai-top"><div><b>' + esc(pegName(k.pegawaiId)) + '</b>' + (p.unit ? ' <span class="muted small">· ' + esc(p.unit) + '</span>' : '') +
        '<div class="muted small">' + dayName(k.tanggal) + ', ' + fmtTgl(k.tanggal) + ' · Tugas dari ' + esc(timName(k.asalTimId)) + '</div></div>' + badge(k.status) + '</div>' +
        '<div class="nilai-body">' + esc(k.uraian) + (k.output ? '<div class="muted small">Output: ' + esc(k.output) + '</div>' : '') + (k.keterangan ? '<div class="muted small">Ket: ' + esc(k.keterangan) + '</div>' : '') +
        (k.evidenceUrl ? '<div class="muted small"><a href="' + esc(k.evidenceUrl) + '" target="_blank" rel="noopener">Lihat bukti dukung ↗</a></div>' : '') + '</div>' +
        '<div class="nilai-form"><label>Nilai (0–100)<input type="number" class="nv" min="0" max="100" step="1" inputmode="numeric" value="' + (k.nilai == null ? '' : k.nilai) + '" placeholder="0–100"></label>' +
        '<div class="nilai-kat">' + nilaiBadge(k.nilai) + '</div>' +
        '<label class="nc-wrap">Catatan (opsional)<input class="ncat" maxlength="500" value="' + esc(k.nilaiCatatan) + '" placeholder="Masukan untuk pegawai"></label>' +
        '<div class="row-actions"><button class="btn primary sm" data-save>' + ico('check') + 'Simpan</button>' + (k.nilai != null ? '<button class="btn ghost sm" data-clear title="Hapus nilai">Hapus nilai</button>' : '') + '</div></div></div>';
    };
    const info = () => {
      const all = state.penilaian.filter(k => ids.has(k.asalTimId) && (!pf.bulan || k.tanggal.startsWith(pf.bulan)) && (!pf.tim || k.asalTimId === pf.tim));
      const dn = all.filter(k => k.nilai != null);
      $('#pInfo').textContent = all.length + ' tugas' + (pf.bulan ? ' pada ' + monthLabel(pf.bulan) : '') + ' · ' + dn.length + ' sudah dinilai · ' + (all.length - dn.length) + ' belum' + (dn.length ? ' · rata-rata ' + (Math.round(dn.reduce((a, k) => a + k.nilai, 0) / dn.length * 10) / 10) : '') + '.';
    };
    const save = async (itemEl, clear) => {
      const k = state.penilaian.find(x => x.id === itemEl.dataset.id);
      const raw = $('.nv', itemEl).value.trim();
      let nilai = null;
      if (!clear) {
        if (raw === '' || !/^\d{1,3}$/.test(raw) || +raw > 100) { toast('Isi nilai berupa angka bulat 0 sampai 100.', 'err'); return; }
        nilai = +raw;
      }
      const btns = $$('button', itemEl);
      await busy(btns, async () => {
        try {
          const d = await dbCall(sb.rpc('nilai_kegiatan', { p_id: k.id, p_nilai: nilai, p_catatan: clear ? '' : $('.ncat', itemEl).value.trim() }));
          Object.assign(k, mapKeg(d));
          const tmp = document.createElement('div'); tmp.innerHTML = itemHtml(k);
          const fresh = tmp.firstChild; itemEl.replaceWith(fresh); paintIcons(fresh); bind(fresh); info();
          toast(clear ? 'Nilai dihapus.' : 'Nilai disimpan: ' + nilai + ' (' + nilaiKat(nilai) + ').', 'ok');
        } catch (err) { toast(errMsg(err), 'err'); }
      });
    };
    const bind = it => {
      $('.nv', it).addEventListener('input', e => { const v = e.target.value.trim(); $('.nilai-kat', it).innerHTML = (v !== '' && /^\d{1,3}$/.test(v) && +v <= 100) ? nilaiBadge(+v) : '<span class="badge off">—</span>'; });
      $('[data-save]', it).addEventListener('click', () => save(it, false));
      const c = $('[data-clear]', it); if (c) c.addEventListener('click', () => { if (confirm('Hapus nilai untuk kegiatan ini?')) save(it, true); });
    };
    const draw = () => {
      const q = pf.q.toLowerCase();
      let list = state.penilaian.filter(k => ids.has(k.asalTimId) && (!pf.tim || k.asalTimId === pf.tim) && (!pf.bulan || k.tanggal.startsWith(pf.bulan)) &&
        (pf.status === '' || (pf.status === 'belum') === (k.nilai == null)) &&
        (!q || (k.uraian + ' ' + k.output + ' ' + k.keterangan + ' ' + pegName(k.pegawaiId)).toLowerCase().includes(q)));
      list.sort(sortKeg); const total = list.length; list = list.slice(0, 100);
      info();
      $('#pList').innerHTML = list.length ? list.map(itemHtml).join('') + (total > list.length ? '<p class="muted small">Menampilkan ' + list.length + ' dari ' + total + ' tugas. Persempit filter untuk melihat sisanya.</p>' : '') :
        '<div class="empty">' + (pf.status === 'belum' ? 'Tidak ada tugas yang menunggu penilaian pada filter ini.' : 'Tidak ada tugas yang cocok dengan filter.') + '</div>';
      paintIcons($('#pList')); $$('.nilai-item', $('#pList')).forEach(bind);
    };
    $('#pQ').addEventListener('input', e => { pf.q = e.target.value; draw(); });
    if ($('#pT')) $('#pT').addEventListener('change', e => { pf.tim = e.target.value; draw(); });
    $('#pB').addEventListener('change', e => { pf.bulan = e.target.value; draw(); });
    $('#pS').addEventListener('change', e => { pf.status = e.target.value; draw(); });
    draw();
  };

  /* ------------------------- Data Pegawai (admin) ------------------------- */
  routes.pegawai = function (el) {
    const statusBadge = p => p.aktif ? '<span class="badge selesai">Aktif</span>' : (p.userId ? '<span class="badge proses">Menunggu</span>' : '<span class="badge off">Nonaktif</span>');
    el.innerHTML =
      pageHead('Data Pegawai', 'Kelola pegawai, peran, dan persetujuan akun', '<button class="btn primary" id="btnAddPeg">' + ico('plus') + 'Tambah Pegawai</button>') +
      '<div class="info">Pegawai yang mendaftar sendiri berstatus <b>Menunggu</b> sampai Anda menekan <b>Setujui</b>. Pegawai yang ditambahkan di sini tanpa akun bisa diinputkan kegiatannya oleh admin.</div>' +
      '<div class="card">' + (state.pegawai.length ?
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>No</th><th>Nama</th><th>NIP</th><th>Jabatan</th><th>Tim / Subbagian</th><th>Peran</th><th>Akun</th><th>Kegiatan</th><th>Status</th><th></th></tr></thead><tbody>' +
        state.pegawai.map((p, i) => '<tr><td>' + (i + 1) + '</td><td><b>' + esc(p.nama) + '</b></td><td class="small">' + esc(p.nip || '-') + '</td><td>' + esc(p.jabatan || '-') + '</td><td>' + esc(p.unit || '-') + '</td>' +
          '<td>' + (p.role === 'admin' ? '<span class="badge selesai">Admin</span>' : 'Pegawai') + '</td><td class="small">' + (p.userId ? 'Punya akun' : 'Tanpa akun') + '</td>' +
          '<td class="num">' + state.kegiatan.filter(k => k.pegawaiId === p.id).length + '</td><td>' + statusBadge(p) + '</td>' +
          '<td><div class="row-actions">' + (!p.aktif && p.userId ? '<button class="btn primary sm" data-approve="' + p.id + '">Setujui</button>' : '') +
          '<button class="btn ghost sm" data-edit="' + p.id + '" title="Ubah">' + ico('edit') + '</button>' +
          (p.userId ? '' : '<button class="btn danger sm" data-del="' + p.id + '" title="Hapus">' + ico('trash') + '</button>') + '</div></td></tr>').join('') +
        '</tbody></table></div>' : '<div class="empty">Belum ada pegawai.</div>') + '</div>';
    $('#btnAddPeg').addEventListener('click', () => openPeg());
    $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => openPeg(b.dataset.edit)));
    $$('[data-approve]', el).forEach(b => b.addEventListener('click', () => busy([b], async () => {
      try { const d = await dbCall(sb.from('pegawai').update({ aktif: true }).eq('id', b.dataset.approve).select().single()); Object.assign(pegById(b.dataset.approve), mapPeg(d)); toast('Akun diaktifkan.', 'ok'); render(); }
      catch (err) { toast(errMsg(err), 'err'); }
    })));
    $$('[data-del]', el).forEach(b => b.addEventListener('click', async () => {
      const p = pegById(b.dataset.del);
      if (state.kegiatan.some(k => k.pegawaiId === p.id)) { toast('Pegawai ini punya riwayat kegiatan. Nonaktifkan saja agar data tetap aman.', 'err'); return; }
      if (!confirm('Hapus pegawai "' + p.nama + '"?')) return;
      try { await dbCall(sb.from('pegawai').delete().eq('id', p.id)); state.pegawai = state.pegawai.filter(x => x.id !== p.id); toast('Pegawai dihapus.'); render(); }
      catch (err) { toast(errMsg(err), 'err'); }
    }));
  };
  function openPeg(id) {
    const p = id ? pegById(id) : { id: '', nip: '', nama: '', jabatan: '', unit: '', aktif: true, role: 'pegawai', userId: null };
    $('#dlgPegTitle').textContent = id ? 'Ubah Pegawai' : 'Tambah Pegawai';
    $('#pId').value = p.id; $('#pNip').value = p.nip || ''; $('#pNama').value = p.nama; $('#pJabatan').value = p.jabatan || '';
    $('#pUnit').value = p.unit || ''; $('#pAktif').checked = p.aktif !== false; $('#pRole').value = p.role;
    $('#pNote').textContent = p.userId ? 'Pegawai ini memiliki akun login sendiri.' : 'Pegawai tanpa akun: kegiatannya diinput oleh admin.';
    $('#dlgPeg').showModal();
  }
  function initDialog() {
    $('#pCancel').addEventListener('click', () => $('#dlgPeg').close());
    $('#formPeg').addEventListener('submit', async e => {
      e.preventDefault();
      const nama = $('#pNama').value.trim(); if (!nama) return;
      const row = { nip: $('#pNip').value.trim() || null, nama, jabatan: $('#pJabatan').value.trim() || null, unit: $('#pUnit').value.trim() || null, aktif: $('#pAktif').checked, role: $('#pRole').value };
      const id = $('#pId').value;
      if (id && id === state.me.id && (row.role !== 'admin' || !row.aktif)) { toast('Anda tidak dapat menonaktifkan atau menurunkan peran akun Anda sendiri.', 'err'); return; }
      const btn = $('#formPeg button[type=submit]');
      await busy([btn], async () => {
        try {
          if (id) { const d = await dbCall(sb.from('pegawai').update(row).eq('id', id).select().single()); Object.assign(pegById(id), mapPeg(d)); }
          else { const d = await dbCall(sb.from('pegawai').insert(row).select().single()); state.pegawai.push(mapPeg(d)); state.pegawai.sort((a, b) => a.nama.localeCompare(b.nama)); }
          $('#dlgPeg').close(); toast('Data pegawai disimpan.', 'ok');
          if (parseHash().route === 'pegawai') render();
        } catch (err) { toast(errMsg(err), 'err'); }
      });
    });
  }

  /* ------------------------- PDF helpers ------------------------- */
  function newDoc(orient) {
    if (!window.jspdf) { toast('Library PDF belum termuat. Pastikan folder js/vendor ikut ter-upload.', 'err'); return null; }
    return new window.jspdf.jsPDF({ orientation: orient || 'p', unit: 'mm', format: 'a4' });
  }
  function kop(doc) {
    const s = state.settings, w = doc.internal.pageSize.getWidth();
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(s.instansi.toUpperCase(), w / 2, 15, { align: 'center' });
    doc.setFontSize(11); doc.text(s.satker.toUpperCase(), w / 2, 21, { align: 'center' });
    let y = 26;
    if (s.alamat) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(s.alamat, w / 2, 25.5, { align: 'center' }); y = 29; }
    doc.setLineWidth(0.8); doc.line(14, y, w - 14, y);
    doc.setLineWidth(0.2); doc.line(14, y + 1.2, w - 14, y + 1.2);
    return y + 8;
  }
  function sigBlock(doc, y, peg) {
    const s = state.settings, w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
    if (y + 52 > h - 16) { doc.addPage(); y = 24; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const xR = w - 14 - 60, xL = 14;
    doc.text((s.kota ? s.kota + ', ' : '') + fmtTgl(todayISO()), xR, y);
    doc.text('Mengetahui,', xR, y + 5);
    doc.text(s.jabatanKepala || 'Kepala', xR, y + 10);
    if (peg) doc.text('Pegawai,', xL + 4, y + 5);
    const yn = y + 34;
    doc.setFont('helvetica', 'bold');
    doc.text(s.kepala || '(.................................)', xR, yn);
    doc.setFont('helvetica', 'normal');
    doc.text('NIP. ' + (s.nipKepala || '.............................'), xR, yn + 5);
    if (peg) {
      doc.setFont('helvetica', 'bold'); doc.text(peg.nama, xL + 4, yn);
      doc.setFont('helvetica', 'normal'); doc.text('NIP. ' + (peg.nip || '.............................'), xL + 4, yn + 5);
    }
    return yn + 8;
  }
  function footers(doc) {
    const n = doc.internal.getNumberOfPages(), w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(120);
      doc.text('Dicetak dari Day-Log BPS - ' + fmtTgl(todayISO()), 14, h - 8);
      doc.text('Halaman ' + i + ' dari ' + n, w - 14, h - 8, { align: 'right' });
    }
    doc.setTextColor(15, 23, 42);
  }
  const HEAD = { fillColor: [13, 36, 97], textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 9 };
  const kegiatanRange = (pegId, from, to) => state.kegiatan.filter(k => k.pegawaiId === pegId && k.tanggal >= from && k.tanggal <= to).sort(sortKegAsc);

  function addPegawaiPage(doc, peg, from, to, label, first) {
    if (!first) doc.addPage();
    let y = kop(doc);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('LAPORAN KEGIATAN HARIAN PEGAWAI', doc.internal.pageSize.getWidth() / 2, y + 2, { align: 'center' });
    y += 10; doc.setFontSize(10);
    [['Nama', peg.nama], ['NIP', peg.nip || '-'], ['Jabatan', peg.jabatan || '-'], ['Tim / Subbagian', peg.unit || '-'], ['Periode', label]].forEach((r, i) => {
      doc.setFont('helvetica', 'normal'); doc.text(r[0], 14, y + i * 5.5); doc.text(':', 46, y + i * 5.5);
      doc.setFont('helvetica', 'bold'); doc.text(String(r[1]), 49, y + i * 5.5);
    });
    y += 5 * 5.5 + 2;
    const list = kegiatanRange(peg.id, from, to);
    const body = list.length ? list.map((k, i) => [i + 1, dayName(k.tanggal) + ', ' + fmtTglPendek(k.tanggal), k.uraian, k.output || '-', k.status, k.keterangan || '-'])
      : [[{ content: 'Tidak ada kegiatan yang tercatat pada periode ini.', colSpan: 6, styles: { halign: 'center', fontStyle: 'italic', textColor: 110 } }]];
    doc.autoTable({
      startY: y, margin: { left: 14, right: 14, top: 20, bottom: 18 },
      head: [['No', 'Hari / Tanggal', 'Uraian Kegiatan', 'Output', 'Status', 'Keterangan']], body,
      theme: 'grid', styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, lineColor: [200, 208, 224], lineWidth: 0.2, valign: 'top' },
      headStyles: HEAD, alternateRowStyles: { fillColor: [247, 249, 253] },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 32 }, 2: { cellWidth: 62 }, 3: { cellWidth: 26 }, 4: { cellWidth: 22, halign: 'center' }, 5: { cellWidth: 30 } }
    });
    y = doc.lastAutoTable.finalY + 6;
    const c = s => list.filter(k => k.status === s).length;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Total kegiatan: ' + list.length + '   |   Selesai: ' + c('Selesai') + '   |   Dalam proses: ' + c('Dalam Proses') + '   |   Tertunda: ' + c('Tertunda') + '   |   Hari terisi: ' + new Set(list.map(k => k.tanggal)).size, 14, y);
    sigBlock(doc, y + 10, peg);
  }
  const pdfName = parts => parts.filter(Boolean).map(slug).join('_') + '.pdf';

  /* ------------------------- Laporan PDF ------------------------- */
  routes.laporan = function (el) {
    const ym = todayISO().slice(0, 7), admin = isAdmin();
    const pegs = visiblePegawai();
    el.innerHTML =
      pageHead('Laporan PDF', 'Unduh laporan kegiatan harian dalam format PDF') +
      '<div class="card" style="margin-bottom:18px"><div class="grid2">' +
      '<label>Pegawai<select id="lPeg">' + pegOpts(pegs, admin ? '' : state.me.id, admin ? '-- Pilih pegawai --' : '') + '</select></label>' +
      '<div><div style="font-weight:600;font-size:13px;color:#334155;margin-bottom:10px">Periode</div><div class="radio-row" style="margin-bottom:0;padding-top:8px">' +
      '<label><input type="radio" name="lMode" value="bulan" checked> Per bulan</label><label><input type="radio" name="lMode" value="rentang"> Rentang tanggal</label></div></div></div>' +
      '<div id="lBulan"><label style="max-width:300px">Bulan<input type="month" id="lB" value="' + ym + '"></label></div>' +
      '<div id="lRange" class="grid2 hidden"><label>Dari tanggal<input type="date" id="lFrom" value="' + ym + '-01"></label><label>Sampai tanggal<input type="date" id="lTo" value="' + todayISO() + '"></label></div>' +
      '<div class="form-actions"><button class="btn primary" id="btnPdf">' + ico('download') + 'Unduh PDF</button>' +
      (admin ? '<button class="btn ghost" id="btnPdfAll">' + ico('file') + 'Unduh Semua Pegawai (1 PDF)</button>' : '') + '</div></div>' +
      '<div class="card"><h2>Pratinjau</h2><p class="sub" id="lSub"></p><div id="lPrev"></div></div>';

    const mode = () => $('input[name=lMode]:checked').value;
    const range = () => {
      if (mode() === 'bulan') { const b = $('#lB').value || ym; const p = b.split('-'); return { from: b + '-01', to: b + '-' + pad(lastDay(+p[0], +p[1])), label: monthLabel(b) }; }
      const f = $('#lFrom').value, t = $('#lTo').value;
      return { from: f, to: t, label: fmtTgl(f) + ' s.d. ' + fmtTgl(t) };
    };
    const preview = () => {
      const r = range(), pid = $('#lPeg').value;
      $('#lSub').textContent = 'Periode: ' + r.label;
      if (!pid) { $('#lPrev').innerHTML = '<div class="empty">Pilih pegawai untuk melihat pratinjau.</div>'; return; }
      const list = kegiatanRange(pid, r.from, r.to);
      $('#lPrev').innerHTML = list.length ?
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>No</th><th>Hari / Tanggal</th><th>Uraian Kegiatan</th><th>Output</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>' +
        list.map((k, i) => '<tr><td>' + (i + 1) + '</td><td class="small" style="white-space:nowrap">' + dayName(k.tanggal) + ', ' + fmtTglPendek(k.tanggal) + '</td><td>' + esc(k.uraian) + '</td><td>' + esc(k.output || '-') + '</td><td>' + badge(k.status) + '</td><td>' + esc(k.keterangan || '-') + '</td></tr>').join('') +
        '</tbody></table></div>' : '<div class="empty">Tidak ada kegiatan pada periode ini.</div>';
    };
    $$('input[name=lMode]').forEach(r => r.addEventListener('change', () => { $('#lBulan').classList.toggle('hidden', mode() !== 'bulan'); $('#lRange').classList.toggle('hidden', mode() === 'bulan'); preview(); }));
    ['#lPeg', '#lB', '#lFrom', '#lTo'].forEach(s => $(s).addEventListener('change', preview));
    $('#btnPdf').addEventListener('click', () => {
      const pid = $('#lPeg').value; if (!pid) { toast('Pilih pegawai terlebih dahulu.', 'err'); return; }
      const r = range(); if (!r.from || !r.to || r.from > r.to) { toast('Periode tidak valid.', 'err'); return; }
      const doc = newDoc('p'); if (!doc) return;
      const peg = pegById(pid);
      addPegawaiPage(doc, peg, r.from, r.to, r.label, true); footers(doc);
      doc.save(pdfName(['laporan', peg.nama, r.from.slice(0, 7), mode() === 'rentang' ? r.to : '']));
      toast('PDF berhasil dibuat.', 'ok');
    });
    if (admin) $('#btnPdfAll').addEventListener('click', () => {
      const r = range(); if (!r.from || !r.to || r.from > r.to) { toast('Periode tidak valid.', 'err'); return; }
      const pegsA = state.pegawai.filter(p => p.aktif); if (!pegsA.length) { toast('Belum ada pegawai aktif.', 'err'); return; }
      const doc = newDoc('p'); if (!doc) return;
      pegsA.forEach((p, i) => addPegawaiPage(doc, p, r.from, r.to, r.label, i === 0)); footers(doc);
      doc.save(pdfName(['laporan', 'semua-pegawai', r.from.slice(0, 7)]));
      toast('PDF semua pegawai berhasil dibuat.', 'ok');
    });
    preview();
  };

  /* ------------------------- Rekap ------------------------- */
  let rekapTab = 'bulanan';
  function weekdaysUpTo(ym) { return workdaysInMonth(ym).length; }
  function rekapBulan(ym) {
    const list = state.kegiatan.filter(k => k.tanggal.startsWith(ym));
    const hk = weekdaysUpTo(ym);
    const peg = visiblePegawai().filter(p => p.aktif || list.some(k => k.pegawaiId === p.id));
    const rows = peg.map(p => {
      const ks = list.filter(k => k.pegawaiId === p.id), hari = new Set(ks.map(k => k.tanggal)).size;
      const missing = missingWorkdays(p.id, ym);
      return { p, total: ks.length, selesai: ks.filter(k => k.status === 'Selesai').length, proses: ks.filter(k => k.status === 'Dalam Proses').length, tunda: ks.filter(k => k.status === 'Tertunda').length, hari, missing, pct: hk ? Math.min(100, Math.round(hari / hk * 100)) : 0 };
    });
    return { rows, hk };
  }
  function rekapTahun(y) {
    const list = state.kegiatan.filter(k => k.tanggal.startsWith(y + '-'));
    const peg = visiblePegawai().filter(p => p.aktif || list.some(k => k.pegawaiId === p.id));
    const rows = peg.map(p => {
      const m = Array(12).fill(0);
      list.filter(k => k.pegawaiId === p.id).forEach(k => { m[+k.tanggal.slice(5, 7) - 1]++; });
      return { p, m, total: m.reduce((a, b) => a + b, 0) };
    });
    const tot = Array(12).fill(0); rows.forEach(r => r.m.forEach((v, i) => { tot[i] += v; }));
    return { rows, tot };
  }

  routes.rekap = function (el) {
    el.innerHTML = pageHead('Rekap Bulanan / Tahunan', isAdmin() ? 'Rekapitulasi jumlah kegiatan dan keaktifan pengisian pegawai' : 'Rekapitulasi kegiatan Anda') +
      '<div class="seg"><button data-tab="bulanan" class="' + (rekapTab === 'bulanan' ? 'on' : '') + '">Rekap Bulanan</button><button data-tab="tahunan" class="' + (rekapTab === 'tahunan' ? 'on' : '') + '">Rekap Tahunan</button></div><div id="rkBody"></div>';
    $$('.seg button', el).forEach(b => b.addEventListener('click', () => { rekapTab = b.dataset.tab; render(); }));
    (rekapTab === 'bulanan' ? drawBulanan : drawTahunan)($('#rkBody'));
  };

  function drawBulanan(box) {
    const ym0 = todayISO().slice(0, 7);
    box.innerHTML = '<div class="card"><div class="form-actions" style="align-items:flex-end;margin:0 0 12px"><label style="margin:0"><span>Bulan</span><input type="month" id="rkB" value="' + ym0 + '"></label>' +
      '<button class="btn primary" id="rkPdf">' + ico('download') + 'PDF</button><button class="btn ghost" id="rkCsv">' + ico('download') + 'CSV</button></div>' +
      '<div class="info" id="rkInfo"></div><div id="rkT"></div></div>';
    const draw = () => {
      const ym = $('#rkB').value || ym0, d = rekapBulan(ym), T = k => d.rows.reduce((a, r) => a + r[k], 0);
      const TM = d.rows.reduce((a, r) => a + r.missing.length, 0);
      const nLibur = (state.holidays || []).filter(h => h.tanggal.startsWith(ym)).length;
      $('#rkInfo').textContent = 'Kepatuhan = hari terisi dibagi hari kerja efektif (Senin-Jumat) yang sudah berjalan pada ' + monthLabel(ym) + ' (' + d.hk + ' hari). Kolom Hari Kosong menampilkan tanggal hari kerja yang belum ada laporan hingga hari ini. ' + (nLibur ? nLibur + ' tanggal merah/cuti bersama dikecualikan.' : 'Belum ada tanggal merah pada bulan ini.');
      $('#rkT').innerHTML = d.rows.length ? '<div class="table-wrap"><table class="tbl" style="min-width:760px"><thead><tr><th>No</th><th>Nama Pegawai</th><th class="num">Total</th><th class="num">Selesai</th><th class="num">Proses</th><th class="num">Tertunda</th><th class="num">Hari Terisi</th><th>Hari Kosong</th><th class="num">Kepatuhan</th></tr></thead><tbody>' +
        d.rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><b>' + esc(r.p.nama) + '</b></td><td class="num">' + r.total + '</td><td class="num">' + r.selesai + '</td><td class="num">' + r.proses + '</td><td class="num">' + r.tunda + '</td><td class="num">' + r.hari + '</td><td class="missing-cell">' + (r.missing.length ? '<b>' + r.missing.length + ' hari</b><div class="muted small" title="' + esc(r.missing.map(fmtTgl).join(', ')) + '">' + esc(shortDateList(r.missing)) + '</div>' : '<span class="tag-done">Lengkap</span>') + '</td><td class="num">' + r.pct + '%</td></tr>').join('') +
        '</tbody><tfoot><tr><td></td><td>Jumlah</td><td class="num">' + T('total') + '</td><td class="num">' + T('selesai') + '</td><td class="num">' + T('proses') + '</td><td class="num">' + T('tunda') + '</td><td class="num">' + T('hari') + '</td><td class="num">' + TM + ' hari</td><td></td></tr></tfoot></table></div>' : '<div class="empty">Belum ada data.</div>';
    };
    $('#rkB').addEventListener('change', draw);
    $('#rkPdf').addEventListener('click', () => {
      const ym = $('#rkB').value || ym0, d = rekapBulan(ym), doc = newDoc('p'); if (!doc) return;
      const w = doc.internal.pageSize.getWidth(); let y = kop(doc);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('REKAPITULASI KEGIATAN HARIAN PEGAWAI', w / 2, y + 2, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('Periode: ' + monthLabel(ym), w / 2, y + 8, { align: 'center' });
      const T = k => d.rows.reduce((a, r) => a + r[k], 0);
      const TM = d.rows.reduce((a, r) => a + r.missing.length, 0);
      const nLibur = (state.holidays || []).filter(h => h.tanggal.startsWith(ym)).length;
      doc.autoTable({
        startY: y + 14, margin: { left: 14, right: 14, bottom: 18 }, theme: 'grid',
        head: [['No', 'Nama Pegawai', 'Total', 'Selesai', 'Proses', 'Tertunda', 'Hari Terisi', 'Hari Kosong']],
        body: d.rows.map((r, i) => [i + 1, r.p.nama, r.total, r.selesai, r.proses, r.tunda, r.hari, r.missing.length ? r.missing.length + '\n' + shortDateList(r.missing) : '0']),
        foot: [['', 'Jumlah', T('total'), T('selesai'), T('proses'), T('tunda'), T('hari'), TM + ' hari']],
        styles: { fontSize: 8.5, cellPadding: 2, lineColor: [200, 208, 224], lineWidth: 0.2, valign: 'top' }, headStyles: HEAD,
        footStyles: { fillColor: [232, 240, 255], textColor: 20, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [247, 249, 253] },
        columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 1: { cellWidth: 45 }, 2: { cellWidth: 13, halign: 'center' }, 3: { cellWidth: 13, halign: 'center' }, 4: { cellWidth: 13, halign: 'center' }, 5: { cellWidth: 15, halign: 'center' }, 6: { cellWidth: 16, halign: 'center' }, 7: { cellWidth: 58 } }
      });
      const noteY = doc.lastAutoTable.finalY + 6;
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(110);
      const noteLines = doc.splitTextToSize('Hari kosong = hari kerja efektif (Senin-Jumat, di luar tanggal merah/cuti bersama) yang belum ada laporan hingga hari ini.' + (nLibur ? ' Pada bulan ini ' + nLibur + ' tanggal merah dikecualikan.' : ''), w - 28);
      doc.text(noteLines, 14, noteY);
      doc.setTextColor(15, 23, 42); doc.setFontSize(8.5);
      sigBlock(doc, noteY + noteLines.length * 4 + 8, null); footers(doc);
      doc.save(pdfName(['rekap-bulanan', ym])); toast('PDF rekap bulanan dibuat.', 'ok');
    });
    $('#rkCsv').addEventListener('click', () => {
      const ym = $('#rkB').value || ym0, d = rekapBulan(ym);
      download('rekap-bulanan-' + ym + '.csv', '﻿' + csv([['No', 'Nama', 'Total', 'Selesai', 'Proses', 'Tertunda', 'Hari Terisi', 'Hari Kosong', 'Tanggal Kosong', 'Kepatuhan(%)']].concat(d.rows.map((r, i) => [i + 1, r.p.nama, r.total, r.selesai, r.proses, r.tunda, r.hari, r.missing.length, r.missing.join('; '), r.pct]))), 'text/csv;charset=utf-8');
    });
    draw();
  }

  function drawTahunan(box) {
    const y0 = new Date().getFullYear();
    const years = Array.from(new Set(state.kegiatan.map(k => +k.tanggal.slice(0, 4)).concat([y0]))).sort((a, b) => b - a);
    box.innerHTML = '<div class="card" style="margin-bottom:18px"><div class="form-actions" style="align-items:flex-end;margin:0 0 12px"><label style="margin:0"><span>Tahun</span><select id="rkY">' + years.map(y => '<option' + (y === y0 ? ' selected' : '') + '>' + y + '</option>').join('') + '</select></label>' +
      '<button class="btn primary" id="rkPdf">' + ico('download') + 'PDF</button><button class="btn ghost" id="rkCsv">' + ico('download') + 'CSV</button></div><div id="rkT"></div></div>' +
      '<div class="card"><h2>Grafik Kegiatan per Bulan</h2><p class="sub" id="rkSub"></p><div class="chart" id="rkChart"></div></div>';
    const draw = () => {
      const y = +$('#rkY').value, d = rekapTahun(y), max = Math.max(1, ...d.tot);
      $('#rkT').innerHTML = d.rows.length ? '<div class="table-wrap"><table class="tbl" style="min-width:900px"><thead><tr><th>No</th><th>Nama</th>' + BULAN_S.map(b => '<th class="num">' + b + '</th>').join('') + '<th class="num">Total</th></tr></thead><tbody>' +
        d.rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><b>' + esc(r.p.nama) + '</b></td>' + r.m.map(v => '<td class="num' + (v ? '' : ' muted') + '">' + v + '</td>').join('') + '<td class="num"><b>' + r.total + '</b></td></tr>').join('') +
        '</tbody><tfoot><tr><td></td><td>Jumlah</td>' + d.tot.map(v => '<td class="num">' + v + '</td>').join('') + '<td class="num">' + d.tot.reduce((a, b) => a + b, 0) + '</td></tr></tfoot></table></div>' : '<div class="empty">Belum ada data.</div>';
      $('#rkSub').textContent = 'Total kegiatan tahun ' + y;
      $('#rkChart').innerHTML = d.tot.map((v, i) => '<div class="col"><span class="v">' + v + '</span><div class="b" style="height:' + Math.round(v / max * 100) + '%"></div><span class="l">' + BULAN_S[i] + '</span></div>').join('');
    };
    $('#rkY').addEventListener('change', draw);
    $('#rkPdf').addEventListener('click', () => {
      const y = +$('#rkY').value, d = rekapTahun(y), doc = newDoc('l'); if (!doc) return;
      const w = doc.internal.pageSize.getWidth(); const yy = kop(doc);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('REKAPITULASI KEGIATAN HARIAN PEGAWAI TAHUN ' + y, w / 2, yy + 2, { align: 'center' });
      doc.autoTable({
        startY: yy + 8, margin: { left: 14, right: 14, bottom: 18 }, theme: 'grid',
        head: [['No', 'Nama Pegawai'].concat(BULAN_S, ['Total'])],
        body: d.rows.map((r, i) => [i + 1, r.p.nama].concat(r.m, [r.total])),
        foot: [['', 'Jumlah'].concat(d.tot, [d.tot.reduce((a, b) => a + b, 0)])],
        styles: { fontSize: 8.5, cellPadding: 2, halign: 'center', lineColor: [200, 208, 224], lineWidth: 0.2 }, headStyles: HEAD,
        footStyles: { fillColor: [232, 240, 255], textColor: 20, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [247, 249, 253] },
        columnStyles: { 0: { cellWidth: 9 }, 1: { halign: 'left', cellWidth: 52 } }
      });
      sigBlock(doc, doc.lastAutoTable.finalY + 10, null); footers(doc);
      doc.save(pdfName(['rekap-tahunan', y])); toast('PDF rekap tahunan dibuat.', 'ok');
    });
    $('#rkCsv').addEventListener('click', () => {
      const y = +$('#rkY').value, d = rekapTahun(y);
      download('rekap-tahunan-' + y + '.csv', '﻿' + csv([['No', 'Nama'].concat(BULAN_S, ['Total'])].concat(d.rows.map((r, i) => [i + 1, r.p.nama].concat(r.m, [r.total])))), 'text/csv;charset=utf-8');
    });
    draw();
  }

  /* ------------------------- Akun Saya ------------------------- */
  routes.akun = function (el) {
    const m = state.me;
    el.innerHTML = pageHead('Akun Saya', 'Kelola profil dan password Anda') +
      '<div class="grid-main"><div class="card"><h2>Profil</h2><p class="sub">Nama dan data ini tercetak pada laporan PDF Anda</p><form id="fProfil">' +
      '<div class="grid2"><label>Email<input value="' + esc(m.email || '') + '" disabled></label><label>Peran<input value="' + (isAdmin() ? 'Admin' : 'Pegawai') + '" disabled></label></div>' +
      '<label>Nama Lengkap *<input id="aNama" required value="' + esc(m.nama) + '"></label>' +
      '<div class="grid2"><label>NIP<input id="aNip" value="' + esc(m.nip) + '"></label><label>Jabatan<input id="aJab" value="' + esc(m.jabatan) + '"></label></div>' +
      '<label>Tim / Subbagian<input id="aUnit" value="' + esc(m.unit) + '"></label>' +
      '<button class="btn primary" type="submit">' + ico('check') + 'Simpan Profil</button></form></div>' +
      '<div class="card"><h2>Ubah Password</h2><p class="sub">Gunakan minimal 8 karakter</p><form id="fPass">' +
      '<label>Password baru<input type="password" id="nPass" required minlength="8" autocomplete="new-password"></label>' +
      '<label>Ulangi password baru<input type="password" id="nPass2" required minlength="8" autocomplete="new-password"></label>' +
      '<button class="btn primary" type="submit">' + ico('check') + 'Ubah Password</button></form></div></div>';
    $('#fProfil').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('button[type=submit]', e.target);
      const v = { nama: $('#aNama').value.trim(), nip: $('#aNip').value.trim(), jabatan: $('#aJab').value.trim(), unit: $('#aUnit').value.trim() };
      if (!v.nama) { toast('Nama wajib diisi.', 'err'); return; }
      await busy([btn], async () => {
        try {
          await dbCall(sb.rpc('update_profil', { p_nama: v.nama, p_nip: v.nip, p_jabatan: v.jabatan, p_unit: v.unit }));
          Object.assign(state.me, v); const row = pegById(state.me.id); if (row) Object.assign(row, v);
          applyRoleUI(); toast('Profil disimpan.', 'ok');
        } catch (err) { toast(errMsg(err), 'err'); }
      });
    });
    $('#fPass').addEventListener('submit', async e => {
      e.preventDefault();
      const p1 = $('#nPass').value, p2 = $('#nPass2').value, btn = $('button[type=submit]', e.target);
      if (p1.length < 8) { toast('Password minimal 8 karakter.', 'err'); return; }
      if (p1 !== p2) { toast('Password dan ulangi password tidak sama.', 'err'); return; }
      await busy([btn], async () => {
        try { const r = await sb.auth.updateUser({ password: p1 }); if (r.error) throw r.error; e.target.reset(); toast('Password berhasil diubah.', 'ok'); }
        catch (err) { toast(errMsg(err), 'err'); }
      });
    });
  };

  /* ------------------------- Data & Pengaturan (admin) ------------------------- */
  routes.data = function (el) {
    const s = state.settings;
    el.innerHTML = pageHead('Data & Pengaturan', 'Identitas instansi untuk kop laporan, serta cadangan data') +
      '<div class="grid-main"><div class="card"><h2>Identitas Instansi &amp; Penandatangan</h2><p class="sub">Dipakai pada kop dan tanda tangan di PDF</p><form id="fSet">' +
      '<div class="grid2"><label>Nama Instansi<input id="sIns" value="' + esc(s.instansi) + '"></label><label>Satuan Kerja<input id="sSat" value="' + esc(s.satker) + '"></label></div>' +
      '<label>Alamat (opsional, tampil di kop)<input id="sAl" value="' + esc(s.alamat) + '"></label>' +
      '<div class="grid2"><label>Kota (untuk tanggal tanda tangan)<input id="sKota" value="' + esc(s.kota) + '"></label><label>Jabatan Penandatangan<input id="sJab" value="' + esc(s.jabatanKepala) + '"></label></div>' +
      '<div class="grid2"><label>Nama Kepala<input id="sKep" value="' + esc(s.kepala) + '"></label><label>NIP Kepala<input id="sNip" value="' + esc(s.nipKepala) + '"></label></div>' +
      '<button class="btn primary" type="submit">' + ico('check') + 'Simpan Pengaturan</button></form></div>' +
      '<div class="stack"><div class="card"><h2>Cadangan Data</h2><p class="sub">Data tersimpan online di database. Simpan juga salinan sendiri secara berkala.</p>' +
      '<div class="info">Data yang dimuat: sejak ' + fmtTgl(state.since) + ' (' + state.kegiatan.length + ' kegiatan, ' + state.pegawai.length + ' pegawai).</div>' +
      '<div class="form-actions"><button class="btn primary" id="bExp">' + ico('download') + 'Backup JSON</button><button class="btn ghost" id="bCsv">' + ico('download') + 'Semua Kegiatan (CSV)</button></div></div></div></div>' +
      '<div class="card" style="margin-top:18px"><div class="monitor-head"><div><h2>Kalender Hari Libur &amp; Cuti Bersama</h2><p class="sub">Tanggal merah dikecualikan dari perhitungan hari kerja, peringatan, dan rekap bulanan.</p></div><label class="compact-label">Tahun<input type="number" id="liburYear" min="2020" max="2100" value="' + new Date().getFullYear() + '"></label></div>' +
      (state.holidayError ? '<div class="info warn">Tabel <b>hari_libur</b> belum tersedia di database. Jalankan SQL pembaruan pada README bagian <b>Pembaruan database</b>, lalu muat ulang halaman.</div>' : '') +
      '<form id="fLibur"><div class="grid3" style="margin-bottom:10px"><label>Tanggal *<input type="date" id="liburTgl" required></label><label>Keterangan<input id="liburKet" maxlength="255" placeholder="Contoh: Cuti bersama Idul Fitri"></label><div style="padding-bottom:14px"><button class="btn primary" type="submit" style="width:100%">' + ico('plus') + 'Tambah / Perbarui</button></div></div></form>' +
      '<div class="form-actions" style="margin-bottom:12px"><button class="btn ghost" id="liburFetch">' + ico('refresh') + 'Muat Libur Nasional dari API</button></div>' +
      '<div class="info hidden" id="liburMsg"></div><div id="liburTable"></div><p class="note-inline">Data API mencakup libur nasional dan cuti bersama. Anda tetap dapat menambah atau menghapus tanggal secara manual, misalnya untuk libur daerah.</p></div>';
    $('#fSet').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('button[type=submit]', e.target);
      const row = { instansi: $('#sIns').value.trim() || DEFAULT_SETTINGS.instansi, satker: $('#sSat').value.trim(), alamat: $('#sAl').value.trim(), kota: $('#sKota').value.trim(), jabatan_kepala: $('#sJab').value.trim(), kepala: $('#sKep').value.trim(), nip_kepala: $('#sNip').value.trim() };
      await busy([btn], async () => {
        try { const d = await dbCall(sb.from('pengaturan').update(row).eq('id', 1).select().single()); state.settings = Object.assign({}, DEFAULT_SETTINGS, mapSet(d)); applyBrand(); toast('Pengaturan disimpan.', 'ok'); }
        catch (err) { toast(errMsg(err), 'err'); }
      });
    });
    $('#bExp').addEventListener('click', () => {
      download('day-log-backup-' + todayISO() + '.json', JSON.stringify({ app: 'day-log-bps', version: 2, exportedAt: new Date().toISOString(), pegawai: state.pegawai, kegiatan: state.kegiatan, hariLibur: state.holidays, settings: state.settings }, null, 2), 'application/json');
      toast('Backup diunduh.', 'ok');
    });
    $('#bCsv').addEventListener('click', () => {
      const rows = [['Tanggal', 'Pegawai', 'NIP', 'Uraian', 'Output', 'Kategori', 'Status', 'Keterangan']].concat(
        state.kegiatan.slice().sort(sortKegAsc).map(k => [k.tanggal, pegName(k.pegawaiId), (pegById(k.pegawaiId) || {}).nip || '', k.uraian, k.output, k.kategori, k.status, k.keterangan]));
      download('day-log-kegiatan-' + todayISO() + '.csv', '﻿' + csv(rows), 'text/csv;charset=utf-8');
    });

    /* Kalender hari libur */
    const liburMsg = (text, warn) => {
      const m = $('#liburMsg'); if (!m) return;
      m.textContent = text; m.classList.remove('hidden'); m.classList.toggle('warn', !!warn);
    };
    const saveLibur = saved => {
      const map = new Map(state.holidays.map(h => [h.tanggal, h]));
      saved.map(mapLibur).forEach(h => map.set(h.tanggal, h));
      state.holidays = Array.from(map.values()).sort((a, b) => a.tanggal < b.tanggal ? -1 : 1);
      state.holidayError = null;
    };
    const drawLibur = () => {
      const y = $('#liburYear').value || String(new Date().getFullYear());
      const list = (state.holidays || []).filter(h => h.tanggal.startsWith(y + '-')).sort((a, b) => a.tanggal < b.tanggal ? -1 : 1);
      $('#liburTable').innerHTML = list.length ?
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Hari</th><th>Keterangan</th><th>Sumber</th><th></th></tr></thead><tbody>' +
        list.map(h => '<tr><td class="small" style="white-space:nowrap">' + fmtTglPendek(h.tanggal) + '</td><td class="small">' + dayName(h.tanggal) + '</td><td>' + esc(h.keterangan || '-') + '</td><td>' + (h.sumber === 'api' ? '<span class="badge proses">API</span>' : '<span class="badge off">Manual</span>') + '</td><td><button class="btn danger sm" data-del-libur="' + esc(h.tanggal) + '" title="Hapus">' + ico('trash') + '</button></td></tr>').join('') +
        '</tbody></table></div><p class="muted small" style="margin:10px 2px 0">' + list.length + ' tanggal merah pada tahun ' + esc(y) + '.</p>'
        : '<div class="empty">Belum ada tanggal merah untuk tahun ' + esc(y) + '. Muat dari API atau tambahkan manual.</div>';
      paintIcons($('#liburTable'));
      $$('[data-del-libur]', $('#liburTable')).forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Hapus tanggal merah ' + fmtTgl(b.dataset.delLibur) + '?')) return;
        await busy([b], async () => {
          try {
            await dbCall(sb.from('hari_libur').delete().eq('tanggal', b.dataset.delLibur));
            state.holidays = state.holidays.filter(h => h.tanggal !== b.dataset.delLibur);
            drawLibur(); toast('Tanggal merah dihapus.');
          } catch (err) { toast(errMsg(err), 'err'); }
        });
      }));
    };
    const fetchLiburApi = async year => {
      try {
        const r = await fetch('https://data-libur-nasional-indonesia.vercel.app/api/libur?year=' + year, { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          const arr = [].concat(Array.isArray(j.libur_nasional) ? j.libur_nasional : [], Array.isArray(j.cuti_bersama) ? j.cuti_bersama : []);
          if (arr.length) return arr.map(x => ({ tanggal: x.date, keterangan: x.name || '' }));
        }
      } catch (e) { /* lanjut ke sumber cadangan */ }
      const r2 = await fetch('https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r2.ok) throw new Error('Sumber data libur tidak dapat diakses.');
      const j2 = await r2.json();
      return Object.keys(j2).filter(d => d.startsWith(year + '-') && j2[d] && j2[d].holiday)
        .map(d => ({ tanggal: d, keterangan: (j2[d].summary && j2[d].summary[0]) || 'Libur nasional' }));
    };
    $('#liburYear').addEventListener('change', drawLibur);
    $('#liburFetch').addEventListener('click', async e => {
      const btn = e.currentTarget;
      const year = +$('#liburYear').value || new Date().getFullYear();
      await busy([btn], async () => {
        try {
          liburMsg('Mengambil data hari libur tahun ' + year + '...');
          const items = await fetchLiburApi(year);
          const manual = new Set(state.holidays.filter(h => h.sumber === 'manual').map(h => h.tanggal));
          const byDate = new Map();
          items.forEach(x => {
            if (x.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(x.tanggal) && !manual.has(x.tanggal))
              byDate.set(x.tanggal, { tanggal: x.tanggal, keterangan: x.keterangan || 'Libur nasional', sumber: 'api' });
          });
          const rows = Array.from(byDate.values());
          if (!rows.length) { liburMsg('Tidak ada data baru untuk tahun ' + year + '. Tanggal yang sudah ada tetap dipertahankan.'); return; }
          const saved = await dbCall(sb.from('hari_libur').upsert(rows, { onConflict: 'tanggal' }).select());
          saveLibur(saved); drawLibur();
          liburMsg(rows.length + ' tanggal libur tahun ' + year + ' berhasil dimuat. Tanggal manual tidak ditimpa.');
          toast('Kalender hari libur diperbarui.', 'ok');
        } catch (err) { liburMsg(errMsg(err), true); toast(errMsg(err), 'err'); }
      });
    });
    $('#fLibur').addEventListener('submit', async e => {
      e.preventDefault();
      const tanggal = $('#liburTgl').value, keterangan = $('#liburKet').value.trim();
      if (!tanggal) { toast('Tanggal wajib diisi.', 'err'); return; }
      const btn = $('button[type=submit]', e.target);
      await busy([btn], async () => {
        try {
          const d = await dbCall(sb.from('hari_libur').upsert({ tanggal, keterangan: keterangan || 'Libur', sumber: 'manual' }, { onConflict: 'tanggal' }).select().single());
          saveLibur([d]);
          $('#liburKet').value = '';
          $('#liburYear').value = tanggal.slice(0, 4);
          drawLibur();
          liburMsg('Tanggal merah ' + fmtTgl(tanggal) + ' disimpan.');
          toast('Tanggal merah disimpan.', 'ok');
        } catch (err) { toast(errMsg(err), 'err'); }
      });
    });
    drawLibur();
  };

  /* ------------------------- Init ------------------------- */
  let deferredPrompt = null;
  async function init() {
    paintIcons(document);
    const d = new Date();
    $('#topDate').textContent = HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
    $('#btnBurger').addEventListener('click', () => { $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('show'); });
    $('#scrim').addEventListener('click', closeSide);
    $('#btnLogout').addEventListener('click', logout);
    initDialog(); initTimDialog();
    window.addEventListener('hashchange', render);

    // pasang sebagai aplikasi (PWA)
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#btnInstall').classList.remove('hidden'); });
    $('#btnInstall').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) { /* abaikan */ }
      deferredPrompt = null; $('#btnInstall').classList.add('hidden');
    });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* abaikan */ });
    }

    if (!CONFIGURED) { showSetup(); return; }
    if (!window.supabase || !window.supabase.createClient) { showError('Library Supabase tidak termuat. Pastikan folder js/vendor ikut ter-upload.'); return; }

    // Deteksi tautan reset password SEBELUM hash dibersihkan oleh Supabase.
    const authUrl = (location.hash || '') + '&' + (location.search || '');
    const recoveryLink = /type=recovery/.test(authUrl);
    let recoveryPending = recoveryLink;
    let authError = '';
    const errMatch = authUrl.match(/error_description=([^&]+)/);
    if (errMatch) { try { authError = decodeURIComponent(errMatch[1].replace(/\+/g, ' ')); } catch (e) { authError = 'Tautan tidak valid atau sudah kedaluwarsa.'; } }
    try {
      if (recoveryLink) localStorage.setItem('daylog.recovery', String(Date.now()));
      else {
        const rv = Number(localStorage.getItem('daylog.recovery') || 0);
        if (rv && Date.now() - rv < 60 * 60 * 1000) recoveryPending = true;
        else if (rv) localStorage.removeItem('daylog.recovery');
      }
    } catch (e) { /* abaikan */ }

    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    sb.auth.onAuthStateChange(ev => {
      if (ev === 'SIGNED_OUT' && state.me) setTimeout(() => { clearState(); showAuth(); }, 0);
      if (ev === 'PASSWORD_RECOVERY' && !recoveryDismissed) {
        try { localStorage.setItem('daylog.recovery', String(Date.now())); } catch (e) { /* abaikan */ }
        setTimeout(() => { if (!$('#fReset') && !recoveryDismissed) showAuth('reset'); }, 0);
      }
    });
    // segarkan data bila aplikasi dibuka kembali setelah beberapa menit
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible' || !state.me) return;
      if (Date.now() - state.loadedAt < 3 * 60 * 1000) return;
      if ($('#dlgPeg').open || parseHash().route === 'input') return;
      try { await loadAll(); applyRoleUI(); render(); } catch (e) { /* abaikan, coba lagi nanti */ }
    });
    if (authError) {
      try { localStorage.removeItem('daylog.recovery'); } catch (e) { /* abaikan */ }
      showAuth('lupa', 'Tautan sudah tidak berlaku. Silakan masukkan email Anda untuk meminta tautan password baru.');
      return;
    }
    if (recoveryPending) { showAuth('reset'); return; }
    await enter();
  }
  window.SIKHARI = { state: () => state, render, go };
  document.addEventListener('DOMContentLoaded', init);
})();
