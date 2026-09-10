import { signIn, signOut } from '../lib/auth';

export class Topbar {
  readonly el: HTMLDivElement;

  private readonly countEl: HTMLSpanElement;
  private readonly authArea: HTMLDivElement;

  constructor(addButton: HTMLButtonElement) {
    this.el = document.createElement('div');
    this.el.className = 'topbar';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'topbar__title';
    const h1 = document.createElement('h1');
    h1.textContent = 'My Gallery';
    this.countEl = document.createElement('span');
    this.countEl.className = 'topbar__count';
    titleWrap.append(h1, this.countEl);

    this.authArea = document.createElement('div');
    this.authArea.className = 'topbar__auth';

    const actions = document.createElement('div');
    actions.className = 'topbar__actions';
    actions.append(addButton, this.authArea);

    this.el.append(titleWrap, actions);
    this.renderSignedOut();
  }

  setCount(n: number): void {
    this.countEl.textContent = n === 1 ? '1 photo' : `${n} photos`;
  }

  setSession(email: string | null): void {
    if (email) this.renderSignedIn(email);
    else this.renderSignedOut();
  }

  private renderSignedOut(): void {
    this.authArea.replaceChildren();

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'topbar__signin-toggle';
    toggle.textContent = 'Sign in';

    const form = document.createElement('form');
    form.className = 'topbar__signin-form';
    form.hidden = true;
    form.innerHTML = `
      <input type="email" name="email" placeholder="Email" required autocomplete="username" />
      <input type="password" name="password" placeholder="Password" required autocomplete="current-password" />
      <button type="submit">Go</button>
      <span class="topbar__signin-error"></span>
    `;

    toggle.addEventListener('click', () => {
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector('input')?.focus();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void (async () => {
        const data = new FormData(form);
        const errorEl = form.querySelector<HTMLElement>('.topbar__signin-error')!;
        errorEl.textContent = '';
        const error = await signIn(String(data.get('email')), String(data.get('password')));
        if (error) errorEl.textContent = error;
      })();
    });

    this.authArea.append(toggle, form);
  }

  private renderSignedIn(email: string): void {
    this.authArea.replaceChildren();

    const label = document.createElement('span');
    label.className = 'topbar__email';
    label.textContent = email;

    const signOutBtn = document.createElement('button');
    signOutBtn.type = 'button';
    signOutBtn.className = 'topbar__signin-toggle';
    signOutBtn.textContent = 'Sign out';
    signOutBtn.addEventListener('click', () => void signOut());

    this.authArea.append(label, signOutBtn);
  }
}
