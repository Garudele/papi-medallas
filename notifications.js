document.addEventListener('app-unlocked', (e) => {
  const decryptedData = e.detail.data;
  const btn = document.getElementById('noti-btn');
  const status = document.getElementById('noti-status');
  const HOUR = 9;
  const LS_KEY = 'papi-medallas:scheduled';

  function setStatus(text, kind = '') {
    status.className = 'noti-status' + (kind ? ' ' + kind : '');
    status.textContent = text;
  }

  const supported = {
    notification: 'Notification' in window,
    serviceWorker: 'serviceWorker' in navigator,
    trigger: 'TimestampTrigger' in window
  };

  if (!supported.notification || !supported.serviceWorker) {
    setStatus('Tu navegador no soporta notificaciones.', 'warn');
    return;
  }

  btn.hidden = false;

  function reflectState() {
    const perm = Notification.permission;
    if (perm === 'denied') {
      btn.disabled = true;
      btn.textContent = '🔕 Notificaciones bloqueadas';
      setStatus('Activalas desde la configuración del navegador.', 'err');
      return;
    }
    if (perm === 'granted') {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        btn.disabled = true;
        btn.textContent = '✅ Recordatorios activos';
        if (supported.trigger) {
          setStatus(`Programados ${saved} recordatorios a las ${HOUR}:00. Tu papá los recibirá aunque cierre la app.`, 'ok');
        } else {
          setStatus(`Tu navegador no programa recordatorios sin servidor — te avisaremos cuando abras la app cada día.`, 'warn');
        }
      } else {
        btn.disabled = false;
        btn.textContent = '🔔 Programar mis recordatorios';
      }
      return;
    }
    btn.disabled = false;
    btn.textContent = '🔔 Activar recordatorios diarios';
    setStatus('Te recordaremos cada día a las 9 de la mañana.');
  }

  async function scheduleAll() {
    const reg = await navigator.serviceWorker.ready;
    const now = Date.now();
    let scheduled = 0;

    const existing = await reg.getNotifications({ includeTriggered: true });
    existing.forEach(n => n.close());

    for (const item of decryptedData.reconocimientos) {
      const [y, m, d] = item.fecha.split('-').map(Number);
      const when = new Date(y, m - 1, d, HOUR, 0, 0).getTime();
      if (when < now) continue;

      const options = {
        body: item.titulo,
        icon: 'assets/icons/icon-192.png',
        badge: 'assets/icons/icon-192.png',
        tag: `papi-medalla-${item.id}`,
        data: { id: item.id, fecha: item.fecha },
        requireInteraction: false
      };

      if (supported.trigger) options.showTrigger = new TimestampTrigger(when);

      try {
        await reg.showNotification(`${item.emoji} Nueva medalla para ti`, options);
        scheduled++;
      } catch (err) {
        console.warn('No pude programar', item.id, err);
      }
    }
    return scheduled;
  }

  async function onClick() {
    btn.disabled = true;
    setStatus('Pidiendo permiso…');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { reflectState(); return; }
      const count = await scheduleAll();
      if (count === 0) {
        setStatus('No hay días futuros para programar.', 'warn');
        btn.disabled = false;
        return;
      }
      localStorage.setItem(LS_KEY, String(count));
      reflectState();
    } catch (err) {
      setStatus('Error: ' + err.message, 'err');
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', onClick);
  reflectState();

  // Botón de prueba: aparece con ?test=1 en URL
  const params = new URLSearchParams(location.search);
  if (params.get('test') === '1') {
    const testBtn = document.getElementById('noti-test');
    testBtn.style.display = 'inline-block';
    testBtn.addEventListener('click', async () => {
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sample = decryptedData.reconocimientos[0];
      await reg.showNotification(`${sample.emoji} Nueva medalla para ti`, {
        body: sample.titulo,
        icon: 'assets/icons/icon-192.png',
        badge: 'assets/icons/icon-192.png',
        tag: 'papi-test',
        data: { id: sample.id, fecha: sample.fecha }
      });
      setStatus('🚀 Notificación enviada — mira tu muñeca', 'ok');
    });
  }
});
