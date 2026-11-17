/*
 * Deerns laadanimatie — zelfstandig component zonder dependencies.
 * Overgenomen uit src/styles/main.css van de zonweringviewer.
 * Gebruik: <script src="deerns-loader.js"></script>
 *          <deerns-loader label="Bestanden laden…"></deerns-loader>
 */
(() => {
  // Het bestand mag ook door meerdere onderdelen van een app worden geladen.
  if (customElements.get('deerns-loader')) return;

  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        font-family: 'Aptos', 'Segoe UI', sans-serif;
        font-size: 13px;
        line-height: 1.5;
        vertical-align: middle;
      }
      :host([hidden]) { display: none !important; }
      :host([overlay]) {
        position: absolute;
        inset: 0;
        z-index: 10;
        padding: 20px;
        border-radius: inherit;
        background: var(--deerns-loader-background, #f3f7fce8);
        backdrop-filter: blur(4px);
        cursor: progress;
      }
      .status {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 25px;
        text-align: center;
      }
      .label {
        color: var(--deerns-loader-text-color, #003087);
        font-weight: 500;
        letter-spacing: .15px;
        overflow-wrap: anywhere;
      }
      .mark {
        position: relative;
        flex-shrink: 0;
        width: var(--deerns-loader-size, 72px);
        aspect-ratio: 72 / 104;
        overflow: hidden;
        color: var(--deerns-loader-color, #00b2e3);
        background: color-mix(in srgb, currentColor 19.6078%, transparent);
        /* De oorspronkelijke logovorm; de golven beginnen bij de linkerpunt. */
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 29.1772 42'%3E%3Cpath d='M20.6318 .5L0 21L20.6318 41.5C25.9103 36.2552 29.1772 29.005 29.1772 21C29.1772 12.995 25.9103 5.7448 20.6318 .5Z'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
        transform: translateZ(0);
      }
      .wave {
        position: absolute;
        left: 0;
        top: 50%;
        width: 333.333333%;
        aspect-ratio: 1;
        border-radius: 50%;
        background: radial-gradient(circle, transparent 27%, color-mix(in srgb, currentColor 43.9216%, transparent) 39%, currentColor 49%, currentColor 54%, transparent 66%);
        transform: translate(-50%, -50%) scale(0);
        opacity: 0;
        will-change: transform, opacity;
        animation: logo-wave var(--deerns-loader-duration, 1.65s) cubic-bezier(.2, .5, .35, 1) infinite;
      }
      .wave + .wave {
        animation-delay: calc(var(--deerns-loader-duration, 1.65s) * -.5);
      }
      @keyframes logo-wave {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        12% { opacity: 1; }
        72% { opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1.15); opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .wave { animation: none; display: none; }
        .mark { background: currentColor; }
      }
    </style>
    <div class="status" role="status" aria-live="polite" aria-atomic="true">
      <div class="mark" aria-hidden="true">
        <span class="wave"></span><span class="wave"></span>
      </div>
      <span class="label"></span>
    </div>
  `;

  class DeernsLoader extends HTMLElement {
    static get observedAttributes() { return ['label']; }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).append(template.content.cloneNode(true));
      this.labelElement = this.shadowRoot.querySelector('.label');
    }

    connectedCallback() { this.updateLabel(); }
    attributeChangedCallback() { this.updateLabel(); }

    get label() { return this.getAttribute('label') ?? 'Laden…'; }
    set label(value) { this.setAttribute('label', value); }

    updateLabel() { this.labelElement.textContent = this.label; }

    show(message) {
      if (message !== undefined) this.label = message;
      this.hidden = false;
    }

    hide() { this.hidden = true; }
  }

  customElements.define('deerns-loader', DeernsLoader);
})();
