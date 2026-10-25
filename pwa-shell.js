'use strict';

(() => {
  document.body.classList.add('pwa-mode');
  const status = document.getElementById('pwa-status');
  const statusText = document.getElementById('pwa-status-text');
  const installButton = document.getElementById('pwa-install-button');
  let installPrompt = null;

  function updateConnectionStatus() {
    if (!status || !statusText) return;
    const offline = !navigator.onLine;
    status.classList.toggle('offline', offline);
    statusText.textContent = offline
      ? 'Offline — local audio and saved data are available.'
      : 'Browser edition — local audio and saved data work here; streaming and online search need the desktop service.';
  }

  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  updateConnectionStatus();

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (installButton) installButton.hidden = false;
  });

  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (!installPrompt) return;
      installButton.disabled = true;
      try {
        await installPrompt.prompt();
        await installPrompt.userChoice;
      } catch (error) {
        console.warn('PWA install prompt was not available:', error);
      } finally {
        installPrompt = null;
        installButton.hidden = true;
        installButton.disabled = false;
      }
    });
  }

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    if (installButton) installButton.hidden = true;
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .then(registration => registration.update())
        .catch(error => console.error('Could not register the Kxnoverse offline app shell:', error));
    }, { once: true });
  }
})();
