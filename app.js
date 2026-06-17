const grid = document.getElementById('grid');
const modal = document.getElementById('modal');
const tituloEl = document.getElementById('titulo');
const subtituloEl = document.getElementById('subtitulo');
const contadorEl = document.getElementById('contador');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

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

function fmtFecha(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

function fmtFechaLarga(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1]}`;
}

function diasEntre(a, b) {
  const ms = new Date(b) - new Date(a);
  return Math.round(ms / 86400000);
}

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

    if (st === 'locked') {
      btn.innerHTML = `
        <div class="card-emoji">${item.emoji}</div>
        <div class="card-titulo">${item.titulo}</div>
        <div class="card-fecha">${fmtFecha(item.fecha)}</div>
        <div class="lock-icon">🔒</div>
      `;
    } else {
      btn.innerHTML = `
        <div class="card-emoji">${item.emoji}</div>
        <div class="card-titulo">${item.titulo}</div>
        <div class="card-fecha">${fmtFecha(item.fecha)}</div>
      `;
      btn.addEventListener('click', () => abrirModal(item));
    }
    grid.appendChild(btn);
  }
}

function abrirModal(item) {
  document.getElementById('modal-emoji').textContent = item.emoji;
  document.getElementById('modal-etiqueta').textContent = item.etiqueta;
  document.getElementById('modal-titulo').textContent = item.titulo;
  document.getElementById('modal-fecha').textContent = fmtFechaLarga(item.fecha);
  document.getElementById('modal-mensaje').textContent = item.mensaje;

  const fotoEl = document.getElementById('modal-foto');
  const wrap = fotoEl.parentElement;
  fotoEl.onerror = () => {
    fotoEl.removeAttribute('src');
    wrap.classList.add('no-image');
  };
  fotoEl.onload = () => wrap.classList.remove('no-image');
  wrap.classList.remove('no-image');
  fotoEl.src = item.foto;

  modal.showModal();
}

modal.addEventListener('click', (e) => {
  if (e.target === modal || e.target.dataset.close !== undefined) {
    modal.close();
  }
});

let currentData = null;

function abrirPorFecha(fecha) {
  if (!currentData || !fecha) return;
  const item = currentData.reconocimientos.find(r => r.fecha === fecha);
  if (item && estado(item.fecha, todayKey()) !== 'locked') abrirModal(item);
}

fetch('data/reconocimientos.json')
  .then(r => r.json())
  .then(data => {
    currentData = data;
    render(data);
    const params = new URLSearchParams(location.search);
    const abrir = params.get('abrir');
    if (abrir) abrirPorFecha(abrir);
  })
  .catch(err => {
    grid.innerHTML = `<p style="color:#c00;padding:20px;">No pude cargar los reconocimientos: ${err.message}</p>`;
  });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'abrir-medalla') abrirPorFecha(e.data.fecha);
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
