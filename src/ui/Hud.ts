export class Hud {
  readonly root: HTMLDivElement;
  private readonly focusEl: HTMLDivElement;
  private readonly focusTitle: HTMLHeadingElement;
  private readonly focusBody: HTMLParagraphElement;
  private readonly lockPrompt: HTMLDivElement;
  private readonly statusEl: HTMLParagraphElement;

  constructor(container: HTMLElement, onRequestLock: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'hud';

    const crosshair = document.createElement('div');
    crosshair.className = 'hud__crosshair';

    const title = document.createElement('div');
    title.className = 'hud__title';
    title.innerHTML = `
      <h1>The Living Satellite Ghost Gallery</h1>
      <p id="hud-status">Connecting to Earth-observation feeds…</p>
    `;
    this.statusEl = title.querySelector('#hud-status') as HTMLParagraphElement;

    const controls = document.createElement('div');
    controls.className = 'hud__controls';
    controls.innerHTML = `
      <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> thrust · mouse look</div>
      <div><kbd>Space</kbd> up · <kbd>Shift</kbd> down · <kbd>Esc</kbd> release cursor</div>
      <div>Drift up to a frame — it focuses and zooms as you approach.</div>
    `;

    this.focusEl = document.createElement('div');
    this.focusEl.className = 'hud__focus';
    this.focusTitle = document.createElement('h2');
    this.focusBody = document.createElement('p');
    this.focusEl.append(this.focusTitle, this.focusBody);

    this.lockPrompt = document.createElement('div');
    this.lockPrompt.className = 'hud__lock-prompt';
    this.lockPrompt.innerHTML = `
      <div class="hud__lock-prompt-inner">
        <h2>Click to drift into zero gravity</h2>
        <p>WASD + mouse to fly · Space / Shift for up and down</p>
      </div>
    `;
    this.lockPrompt.addEventListener('click', onRequestLock);

    this.root.append(crosshair, title, controls, this.focusEl);
    container.append(this.root, this.lockPrompt);
  }

  setLocked(locked: boolean): void {
    this.lockPrompt.dataset.hidden = String(locked);
  }

  setConnectionStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  showFocus(title: string, body: string): void {
    this.focusTitle.textContent = title;
    this.focusBody.textContent = body;
    this.focusEl.dataset.visible = 'true';
  }

  hideFocus(): void {
    this.focusEl.dataset.visible = 'false';
  }
}
