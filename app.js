const grid = document.getElementById('grid');
const modal = document.getElementById('modal');
const tituloEl = document.getElementById('titulo');
const subtituloEl = document.getElementById('subtitulo');
const contadorEl = document.getElementById('contador');
const appWrap = document.getElementById('app-wrap');
const lockScreen = document.getElementById('lock-screen');
const lockForm = document.getElementById('lock-form');
const lockInput = document.getElementById('lock-input');
const lockError = document.getElementById('lock-error');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const LS_PASS = 'papi-medallas:pass';
const PBKDF2_ITER = 100000;

let currentData = null;
let currentKey = null;

// ---- Crypto helpers ----
function b64decode(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function deriveKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, ['decrypt']
  );
}

async function fetchEncrypted() {
  const r = await fetch('data/encrypted.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('No se pudo cargar el contenido');
  return r.json();
}

async function tryDecrypt(password) {
  const enc = await fetchEncrypted();
  const salt = b64decode(enc.salt);
  const iv = b64decode(enc.iv);
  const ct = b64decode(enc.ciphertext);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const data = JSON.parse(new TextDecoder().decode(plain));
  return { data, key };
}

async function decryptPhoto(item) {
  if (!currentKey) return null;
  const path = item.foto.replace(/\.(jpg|jpeg|png)$/i, '.bin');
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, currentKey, ct);
    const blob = new Blob([plain], { type: 'image/jpeg' });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// ---- App logic ----
function todayKey() {
  const params = new URLSearchParams(location.search);
  const forced = params.get('hoy');
  const d = forced ? new Date(forced + 'T00:00:00') : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function estado(fecha, hoy) {
  if (fecha < hoy) return 'unlocked';
  if (fecha === hoy) return 'today';
  return 'locked';
}

const fmtFecha = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MESES[m - 1]}`; };
const fmtFechaLarga = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} de ${MESES_LARGO[m - 1]}`; };
const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

function actualizarContador(items, hoy) {
  const desbloqueados = items.filter(i => estado(i.fecha, hoy) !== 'locked').length;
  const total = items.length;
  if (desbloqueados === 0) {
    const dias = diasEntre(hoy, items[0].fecha);
    contadorEl.textContent = `Faltan ${dias} día${dias === 1 ? '' : 's'} para tu primera medalla 🎁`;
  } else if (desbloqueados === total) {
    contadorEl.textContent = `¡Las ${total} medallas son tuyas! 💛`;
  } else {
    contadorEl.textContent = `${desbloqueados} de ${total} medallas desbloqueadas`;
  }
}

function render(data) {
  const hoy = todayKey();
  tituloEl.textContent = `Para ${data.destinatario}`;
  subtituloEl.textContent = data.subtitulo;
  actualizarContador(data.reconocimientos, hoy);

  grid.innerHTML = '';
  for (const item of data.reconocimientos) {
    const st = estado(item.fecha, hoy);
    const btn = document.createElement('button');
    btn.className = `card ${st}`;
    btn.disabled = st === 'locked';
    btn.setAttribute('aria-label', st === 'locked' ? `Bloqueado hasta ${fmtFecha(item.fecha)}` : item.titulo);

    btn.innerHTML = st === 'locked'
      ? `<div class="card-emoji">${item.emoji}</div>
         <div class="card-titulo">${item.titulo}</div>
         <div class="card-fecha">${fmtFecha(item.fecha)}</div>
         <div class="lock-icon">🔒</div>`
      : `<div class="card-emoji">${item.emoji}</div>
         <div class="card-titulo">${item.titulo}</div>
         <div class="card-fecha">${fmtFecha(item.fecha)}</div>`;

    if (st !== 'locked') btn.addEventListener('click', () => abrirModal(item));
    grid.appendChild(btn);
  }
}

async function abrirModal(item) {
  document.getElementById('modal-emoji').textContent = item.emoji;
  document.getElementById('modal-etiqueta').textContent = item.etiqueta;
  document.getElementById('modal-titulo').textContent = item.titulo;
  document.getElementById('modal-fecha').textContent = fmtFechaLarga(item.fecha);
  document.getElementById('modal-mensaje').textContent = item.mensaje;

  const fotoEl = document.getElementById('modal-foto');
  const wrap = fotoEl.parentElement;

  fotoEl.removeAttribute('src');
  wrap.classList.add('no-image');
  modal.showModal();

  const url = await decryptPhoto(item);
  if (url) {
    fotoEl.onload = () => wrap.classList.remove('no-image');
    fotoEl.src = url;
  }
}

modal.addEventListener('click', (e) => {
  if (e.target === modal || e.target.dataset.close !== undefined) modal.close();
});

function abrirPorFecha(fecha) {
  if (!currentData || !fecha) return;
  const item = currentData.reconocimientos.find(r => r.fecha === fecha);
  if (item && estado(item.fecha, todayKey()) !== 'locked') abrirModal(item);
}

// ---- Boot ----
async function boot(password) {
  const { data, key } = await tryDecrypt(password);
  currentData = data;
  currentKey = key;
  localStorage.setItem(LS_PASS, password);

  lockScreen.style.display = 'none';
  appWrap.hidden = false;
  render(data);
  document.dispatchEvent(new CustomEvent('app-unlocked', { detail: { data } }));

  const params = new URLSearchParams(location.search);
  const abrir = params.get('abrir');
  if (abrir) abrirPorFecha(abrir);
}

lockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  lockError.hidden = true;
  const pass = lockInput.value;
  try {
    await boot(pass);
  } catch {
    lockError.hidden = false;
    lockScreen.classList.remove('shake');
    void lockScreen.offsetWidth;
    lockScreen.classList.add('shake');
    lockInput.select();
  }
});

(async () => {
  const cached = localStorage.getItem(LS_PASS);
  if (cached) {
    try {
      await boot(cached);
      return;
    } catch {
      localStorage.removeItem(LS_PASS);
    }
  }
  lockInput.focus();
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'abrir-medalla') abrirPorFecha(e.data.fecha);
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
