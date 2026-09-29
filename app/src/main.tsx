import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/app.css';

const root = createRoot(document.getElementById('root')!);

async function boot() {
  if (location.hash === '#visuales') {
    const { VisualsApp } = await import('./visuals/VisualsApp');
    root.render(
      <StrictMode>
        <VisualsApp />
      </StrictMode>,
    );
    return;
  }
  const [{ App }, { installKeyboard }, { loadLayout }, { startAutosave, lastProjectId, loadProject }, { openProject }, { loadSamplesFor }, { startAudio }, { startPublisher }] =
    await Promise.all([
      import('./App'),
      import('./input/keyboard'),
      import('./input/keys'),
      import('./state/persist'),
      import('./state/store'),
      import('./state/samples'),
      import('./engine/audio'),
      import('./visuals/publisher'),
    ]);
  // Reopen the last project in the background, so "Tus proyectos" and the
  // studio pick up where the person left.
  const last = lastProjectId();
  const p = last ? loadProject(last) : null;
  if (p) {
    openProject(p);
    void loadSamplesFor(p);
  }
  if (location.search.includes('debug')) {
    const [{ getStatus }, { bridgeIfReady }, { useUi }, { useStudio }, { VisualsRenderer }, { useAudioEdit }, { useTour }, templates, audio] = await Promise.all([
      import('./engine/live'),
      import('./engine/bridge'),
      import('./state/ui'),
      import('./state/store'),
      import('./visuals/renderer'),
      import('./state/audioEdit'),
      import('./tutorial/tour'),
      import('./state/templates'),
      import('./engine/audio'),
    ]);
    Object.assign(window, { __house: { getStatus, bridgeIfReady, useUi, useStudio, VisualsRenderer, useAudioEdit, useTour, templates, audio } });
  }
  installKeyboard();
  void loadLayout();
  startAutosave();
  startPublisher();
  // Browsers only start audio after a click or a key.
  const wake = () => {
    void startAudio();
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('keydown', wake);
  };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
