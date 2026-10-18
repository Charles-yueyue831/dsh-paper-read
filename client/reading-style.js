export const readingStyle = `
.pi-report-card{grid-column:1/-1;min-width:0}
.pi-reading-layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:clamp(22px,4vw,56px);align-items:start;max-width:1240px;margin:auto}
.pi-reading-nav{position:sticky;top:16px;max-height:calc(100vh - 60px);overflow:auto;border-right:1px solid var(--dsw-alias-border-l2,#ddd);padding-right:18px}
.pi-nav-group{margin:0 0 20px}.pi-nav-group strong{display:block;font-size:12px;opacity:.65;margin-bottom:5px}
.pi-workbench .pi-nav-group button{display:block;border:0;background:transparent;text-align:left;width:100%;font-size:13px;padding:6px 8px;border-radius:6px}
.pi-workbench .pi-nav-group button:hover,.pi-workbench .pi-nav-group button:focus-visible{background:var(--dsw-alias-bg-layer-3);color:#638cf0}
.pi-report-body{min-width:0;width:100%;max-width:960px;margin:0 auto;font-size:16px;line-height:1.85}
.pi-report-body>div>h1,.pi-report-body h1{font-size:clamp(24px,3vw,36px);line-height:1.3;letter-spacing:-.7px;margin:12px 0 24px}
.pi-report-body .pi-chapter{padding:28px 0;border-top:1px solid var(--dsw-alias-border-l2,#ddd);margin-top:30px}
.pi-report-body .pi-chapter h2{border:0;padding:0;margin:0 0 18px;font-size:25px;line-height:1.4}
.pi-report-body .pi-eyebrow,.pi-reading-nav .pi-eyebrow{font-size:11px;letter-spacing:1px;color:#7297ed;font-weight:650;margin:0 0 9px}
.pi-report-body .pi-overview{padding:24px;border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:14px;background:var(--dsw-alias-bg-layer-1)}
.pi-overview blockquote{font-size:14px;border-color:#638cf0}.pi-overview p{margin:10px 0}
.pi-deep-dive,.pi-appendix{margin:24px 0;border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.pi-deep-dive>summary,.pi-appendix>summary{padding:14px 18px;font-size:14px;font-weight:600;cursor:pointer}
.pi-detail-block{padding:0 22px 18px}.pi-detail-block+.pi-detail-block{border-top:1px solid var(--dsw-alias-border-l2,#ddd)}
.pi-appendix>div,.pi-appendix>.pi-deep-dive{margin:16px}
.pi-report-body .pi-detail-block h3{font-size:17px;margin:18px 0 10px}
.pi-report-body [id]{scroll-margin-top:24px}.pi-report-body table{font-size:14px;line-height:1.7}.pi-report-body th,.pi-report-body td{min-width:150px;padding:12px;vertical-align:top}
.pi-report-body .pi-diagram{background:var(--dsw-alias-bg-layer-1);margin:20px 0;padding:14px}
.pi-diagram-svg svg{max-width:100%;min-width:0;width:100%;height:auto;max-height:620px;margin:auto}.pi-diagram-svg{max-height:760px;overflow:auto}
.pi-diagram-zoom svg{max-width:none;max-height:none;width:auto;min-width:100%}.pi-diagram>button{margin-top:12px;font-size:12px}
.pi-report-toolbar{padding-bottom:16px;border-bottom:1px solid var(--dsw-alias-border-l2,#ddd)}.pi-report-toolbar .pi-actions{margin-top:0}
@media(max-width:1000px){.pi-reading-layout{grid-template-columns:1fr}.pi-reading-nav{position:static;max-height:none;border:0;padding:0;display:flex;flex-wrap:wrap;gap:12px}.pi-reading-nav>.pi-eyebrow{width:100%}.pi-nav-group{flex:1 1 140px;margin:0}.pi-report-body{max-width:100%}}
@media(max-width:600px){.pi-report-card{padding:14px}.pi-report-body{font-size:15px}.pi-report-body .pi-overview{padding:16px}.pi-report-body .pi-chapter h2{font-size:22px}.pi-report-toolbar button{font-size:12px;padding:6px 9px}}
`;
