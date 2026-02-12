/**
 * OCDN Embeddable Widget — standalone Web Component.
 * <ocdn-widget hash="sha256" api="https://ocdn.example/api"></ocdn-widget>
 *
 * Ships on CDN. Mobile-responsive. Self-updating via SSE.
 * Compact leaderboard + Fortify button for external sites.
 */

const WIDGET_STYLES = `
  :host {
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #ededed;
    --accent: #f7931a;
    --bg: #0a0a0a;
    --surface: #141414;
    --border: #2a2a2a;
    --muted: #888;
  }
  .widget {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    max-width: 400px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .logo {
    font-weight: 700;
    font-size: 14px;
    color: var(--accent);
  }
  .hash {
    font-family: monospace;
    font-size: 11px;
    color: var(--muted);
  }
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }
  .stat {
    background: var(--surface);
    border-radius: 6px;
    padding: 8px;
  }
  .stat-value {
    font-family: monospace;
    font-size: 14px;
    font-weight: 600;
  }
  .stat-label {
    font-size: 10px;
    color: var(--muted);
  }
  .bar {
    height: 4px;
    background: var(--surface);
    border-radius: 2px;
    margin-bottom: 4px;
  }
  .bar-fill {
    height: 4px;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s;
  }
  .fortify-btn {
    width: 100%;
    padding: 8px;
    background: var(--accent);
    color: #0a0a0a;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .fortify-btn:hover {
    opacity: 0.9;
  }
`;

class OcdnWidget extends HTMLElement {
  private shadow: ShadowRoot;
  private apiBase = "";
  private contentHash = "";

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
  }

  static get observedAttributes() {
    return ["hash", "api"];
  }

  connectedCallback() {
    this.apiBase = this.getAttribute("api") || "";
    this.contentHash = this.getAttribute("hash") || "";
    this.render();
    if (this.apiBase && this.contentHash) {
      this.fetchData();
    }
  }

  attributeChangedCallback() {
    this.apiBase = this.getAttribute("api") || "";
    this.contentHash = this.getAttribute("hash") || "";
    if (this.apiBase && this.contentHash) {
      this.fetchData();
    }
  }

  private async fetchData() {
    try {
      const res = await fetch(`${this.apiBase}/pool/${this.contentHash}`);
      if (!res.ok) return;
      const data = await res.json();
      this.renderData(data);
    } catch {
      // Silent fail for embed
    }
  }

  private render() {
    this.shadow.innerHTML = `
      <style>${WIDGET_STYLES}</style>
      <div class="widget">
        <div class="header">
          <span class="logo">OCDN</span>
          <span class="hash">${this.contentHash.slice(0, 8)}...${this.contentHash.slice(-6)}</span>
        </div>
        <div class="stats">
          <div class="stat">
            <div class="stat-value" id="balance">—</div>
            <div class="stat-label">sats in pool</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="funders">—</div>
            <div class="stat-label">funders</div>
          </div>
        </div>
        <button class="fortify-btn" id="fortify">Fortify</button>
      </div>
    `;

    this.shadow.getElementById("fortify")?.addEventListener("click", () => {
      window.open(
        `${this.apiBase.replace("/api", "")}/v/${this.contentHash}`,
        "_blank"
      );
    });
  }

  private renderData(data: { balance: string; funderCount: number }) {
    const balance = this.shadow.getElementById("balance");
    const funders = this.shadow.getElementById("funders");
    if (balance) balance.textContent = `${data.balance} sats`;
    if (funders) funders.textContent = String(data.funderCount);
  }
}

if (typeof window !== "undefined" && !customElements.get("ocdn-widget")) {
  customElements.define("ocdn-widget", OcdnWidget);
}

export { OcdnWidget };
