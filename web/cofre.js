// ComfyUI-Cofre — interface (aba lateral + painel em tela cheia). Sem dependências externas.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...filhos) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) e.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return e;
};
const GB = (b) => (b == null ? "—" : b >= 1e9 ? (b / 1e9).toFixed(2) + " GB" : b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : (b / 1e3).toFixed(0) + " KB");
const PAR = (p) => (!p ? "—" : p >= 1e9 ? (p / 1e9).toFixed(2) + " B" : p >= 1e6 ? (p / 1e6).toFixed(0) + " M" : p);
const DATA = (t) => (t ? new Date(t * 1000).toLocaleString("pt-BR") : "—");
const enc = encodeURIComponent;
async function GET(url) { const r = await api.fetchApi(url); return r.json(); }
async function POST(url, body) {
  const r = await api.fetchApi(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  return r.json();
}
function toast(msg, tipo = "info") {
  const t = app.extensionManager?.toast;
  if (t?.add) t.add({ severity: tipo, summary: "Cofre", detail: msg, life: 5000 });
  else console.log("[Cofre]", msg);
}

// ------------------------------------------------------------------ estilo
const CSS = `
.cofre-ov{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}
.cofre-win{width:min(1500px,96vw);height:92vh;background:var(--comfy-menu-bg,#202020);color:var(--fg-color,#ddd);border:1px solid var(--border-color,#444);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;font-size:13px}
.cofre-top{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border-color,#444)}
.cofre-top h2{margin:0;font-size:17px;font-weight:600}
.cofre-tabs{display:flex;gap:2px;padding:0 10px;border-bottom:1px solid var(--border-color,#444);flex-wrap:wrap}
.cofre-tabs button{background:none;border:0;color:inherit;padding:9px 14px;cursor:pointer;border-bottom:2px solid transparent;opacity:.75;font-size:13px}
.cofre-tabs button.on{border-color:#4ea1ff;opacity:1;font-weight:600}
.cofre-body{flex:1;overflow:auto;padding:14px}
.cofre-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.cofre input,.cofre select{background:var(--comfy-input-bg,#111);color:inherit;border:1px solid var(--border-color,#444);border-radius:6px;padding:5px 8px;font-size:13px}
.cofre .btn{background:#2c3e57;color:#fff;border:1px solid #3d5a80;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:12.5px;white-space:nowrap}
.cofre .btn:hover{filter:brightness(1.2)} .cofre .btn.perigo{background:#5a2323;border-color:#8a3434} .cofre .btn.leve{background:transparent;border-color:var(--border-color,#555);color:inherit}
.cofre table{width:100%;border-collapse:collapse} .cofre th,.cofre td{padding:6px 8px;border-bottom:1px solid rgba(128,128,128,.18);text-align:left;vertical-align:top}
.cofre th{position:sticky;top:-14px;background:var(--comfy-menu-bg,#202020);font-weight:600;z-index:1} .cofre tr.clic{cursor:pointer} .cofre tr.clic:hover{background:rgba(78,161,255,.08)}
.cofre .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.cofre .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:14px}
.cofre .card{border:1px solid var(--border-color,#444);border-radius:10px;padding:12px} .cofre .card b{display:block;font-size:22px;margin:4px 0}
.cofre .card small,.cofre .mut{opacity:.65}
.cofre .bar{height:10px;border-radius:5px;background:rgba(128,128,128,.25);overflow:hidden} .cofre .bar>i{display:block;height:100%;background:#4ea1ff}
.cofre .tag{display:inline-block;padding:1px 7px;border-radius:10px;font-size:11.5px;margin:1px 3px 1px 0;background:rgba(128,128,128,.22)}
.cofre .ok{background:rgba(60,170,90,.25);color:#7fdc9b} .cofre .av{background:rgba(220,160,40,.22);color:#f3c35a} .cofre .er{background:rgba(220,70,70,.22);color:#ff8f8f}
.cofre .det{border:1px solid var(--border-color,#444);border-radius:10px;padding:12px;margin:8px 0 14px;background:rgba(128,128,128,.06)}
.cofre .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.cofre .thumb{border:1px solid var(--border-color,#444);border-radius:8px;overflow:hidden;cursor:pointer;background:#111}
.cofre .thumb img{width:100%;height:150px;object-fit:cover;display:block} .cofre .thumb div{padding:4px 6px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cofre .lb{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.85);display:flex;gap:16px;padding:24px}
.cofre .lb .midia{flex:1;display:flex;align-items:center;justify-content:center} .cofre .lb img,.cofre .lb video{max-width:100%;max-height:100%}
.cofre .lb .lado{width:380px;overflow:auto;background:var(--comfy-menu-bg,#202020);border-radius:10px;padding:14px}
.cofre .prog{font-size:12px;opacity:.85} .cofre pre{white-space:pre-wrap;word-break:break-word;margin:4px 0;font-size:12px}
.cofre h3{margin:16px 0 8px;font-size:14px}
.cofre-side{padding:12px;font-size:13px} .cofre-side .btn{width:100%;margin:6px 0}
.cofre .seg{display:inline-flex;border:1px solid var(--border-color,#555);border-radius:6px;overflow:hidden}
.cofre .seg button{background:transparent;color:inherit;border:0;padding:5px 10px;cursor:pointer;font-size:12.5px}
.cofre .seg button.on{background:#2c3e57;color:#fff}
.cofre .sens{position:relative;overflow:hidden;isolation:isolate}
.cofre .sens>img,.cofre .sens>video,.cofre .sens>.txtprev{position:relative;z-index:0}
.cofre .sens.cofre-desf img,.cofre .sens.cofre-desf video,.cofre .sens.cofre-desf .txtprev{filter:blur(var(--cofre-blur,18px)) saturate(.6);transform:scale(1.08)}
.cofre .sens .selo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:12px;background:rgba(0,0,0,.28);color:#fff;cursor:pointer;text-align:center;padding:6px;z-index:5;text-shadow:0 1px 3px #000}
.cofre .sens .selo b{font-size:20px} .cofre .sens:not(.cofre-desf) .selo{display:none}
.cofre .sens .canto{position:absolute;top:5px;left:5px;z-index:2;font-size:11px;background:rgba(150,30,30,.85);color:#fff;border-radius:8px;padding:0 6px;cursor:pointer}
.cofre .sens.cofre-desf .canto{display:none}
.cofre .mlay{display:flex;gap:14px;align-items:flex-start}
.cofre .facet{width:220px;flex:none;position:sticky;top:0;max-height:calc(92vh - 140px);overflow:auto;padding-right:4px}
.cofre .facet h4{margin:10px 0 4px;font-size:12px;text-transform:uppercase;opacity:.6;letter-spacing:.04em}
.cofre .facet a{display:flex;justify-content:space-between;gap:6px;padding:3px 8px;border-radius:6px;cursor:pointer;color:inherit;text-decoration:none;font-size:12.5px}
.cofre .facet a:hover{background:rgba(78,161,255,.1)} .cofre .facet a.on{background:rgba(78,161,255,.22);font-weight:600}
.cofre .facet a span:last-child{opacity:.6;font-variant-numeric:tabular-nums}
.cofre .mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--cw,180px),1fr));gap:12px}
.cofre .mcard{border:1px solid var(--border-color,#444);border-radius:10px;overflow:hidden;cursor:pointer;background:rgba(0,0,0,.25);display:flex;flex-direction:column;transition:border-color .15s}
.cofre .mcard:hover{border-color:#4ea1ff}
.cofre .mcard .capa{height:var(--ch,180px);display:flex;align-items:center;justify-content:center;font-size:44px;position:relative}
.cofre .mcard .capa img{width:100%;height:100%;object-fit:cover;display:block}
.cofre .mcard .info{padding:7px 8px 8px;font-size:12px;display:flex;flex-direction:column;gap:3px}
.cofre .mcard .nome{font-weight:600;font-size:12.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all}
.cofre .mcard .selos{position:absolute;top:5px;right:5px;display:flex;gap:3px;z-index:3}
.cofre .mcard .selos span{font-size:10.5px;border-radius:8px;padding:0 6px;background:rgba(0,0,0,.7);color:#fff}
.cofre .med{background:rgba(230,160,40,.2);color:#f3c35a} .cofre .inf{background:rgba(150,110,240,.22);color:#c3a8ff}
.cofre .thumb{position:relative}
.cofre .thumb img{height:var(--ch,150px)!important}
.cofre .play{position:absolute;right:6px;top:6px;background:rgba(0,0,0,.7);color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:12px;z-index:3}
.cofre .txtprev{height:var(--ch,150px);padding:8px;font:11px/1.35 monospace;white-space:pre-wrap;overflow:hidden;opacity:.85;background:#151515}
.cofre .lista-s td{vertical-align:middle} .cofre .lista-s .mini{width:72px;height:72px;border-radius:6px;overflow:hidden;background:#111;flex:none}
.cofre .lista-s .mini img{width:72px;height:72px;object-fit:cover;display:block}
.cofre .clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:420px;font-size:12px;opacity:.85}
.cofre .modal{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:24px}
.cofre .modal>div{width:min(1200px,94vw);max-height:90vh;overflow:auto;background:var(--comfy-menu-bg,#202020);border-radius:12px;padding:16px;display:flex;gap:16px}
.cofre .modal .grande{width:380px;flex:none} .cofre .modal .grande .sens,.cofre .modal .grande .ph{width:380px;height:380px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:80px}
.cofre .modal .grande img{width:100%;height:100%;object-fit:contain;background:#111}
.cofre .galeria{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}
.cofre .galeria .thumb img{height:96px!important}
.cofre .lb .nav{position:absolute;top:50%;transform:translateY(-50%);font-size:28px;background:rgba(0,0,0,.5);color:#fff;border:0;border-radius:50%;width:46px;height:46px;cursor:pointer;z-index:4}
.cofre .lb .midia{position:relative}
.cofre textarea{background:var(--comfy-input-bg,#111);color:inherit;border:1px solid var(--border-color,#444);border-radius:6px;padding:6px 8px;font-size:12.5px;width:100%;min-height:90px}
`;
function injetarCSS() { if (!$("#cofre-css")) document.head.append(h("style", { id: "cofre-css" }, CSS)); }

// ------------------------------------------------------------------ preferências e conteúdo sensível
const PREF = (() => { try { return Object.assign({ vistaModelos: "grade", vistaSaidas: "grade", tam: "m" }, JSON.parse(localStorage.getItem("cofre.pref") || "{}")); } catch (e) { return { vistaModelos: "grade", vistaSaidas: "grade", tam: "m" }; } })();
const salvarPref = () => { try { localStorage.setItem("cofre.pref", JSON.stringify(PREF)); } catch (e) {} };
const TAM = { p: [140, 130], m: [180, 170], g: [240, 230] };
let CFG = { nsfw_desfocar: "1", civitai: "1" };
let MOSTRAR = false; // revelar tudo nesta sessão (não fica salvo)
const deveDesfocar = (s) => !!s && CFG.nsfw_desfocar === "1" && !MOSTRAR;
// envolve uma mídia: desfoca se for sensível; 1º clique revela só este item
function sens(midia, sensivel, motivo, extraClass = "") {
  const w = h("div", { class: "sens " + extraClass + (deveDesfocar(sensivel) ? " cofre-desf" : "") }, midia);
  if (sensivel) {
    w.append(h("div", { class: "selo", title: motivo || "", onclick: (e) => { e.stopPropagation(); w.classList.remove("cofre-desf"); } },
      h("b", {}, "🔞"), h("span", {}, "Conteúdo sensível"), h("small", { style: "opacity:.8" }, "clique para ver")));
    w.append(h("span", { class: "canto", title: (motivo || "") + " — clique para desfocar de novo", onclick: (e) => { e.stopPropagation(); w.classList.add("cofre-desf"); } }, "🔞"));
  }
  return w;
}
const ICONE_CAT = { loras: "🎨", lycoris: "🎨", checkpoints: "🧠", diffusion_models: "🧠", unet: "🧠", unet_gguf: "🧠", vae: "🌈", vae_approx: "🌈",
  text_encoders: "📝", clip: "📝", clip_gguf: "📝", clip_vision: "👁️", controlnet: "🕹️", upscale_models: "🔍", LLM: "💬", embeddings: "🔤",
  ipadapter: "🖇️", sams: "✂️", ultralytics_bbox: "🎯", ultralytics_segm: "🎯", insightface: "🙂", style_models: "🖌️" };
function corFamilia(f) { let x = 0; for (const c of f || "?") x = (x * 31 + c.charCodeAt(0)) % 360; return `linear-gradient(135deg,hsl(${x} 35% 22%),hsl(${(x + 40) % 360} 30% 12%))`; }
const proven = (inferido) => h("span", { class: "tag " + (inferido ? "inf" : "med"), title: inferido ? "inferido (pelo nome ou pela pasta)" : "medido (lido do arquivo)" }, inferido ? "~ inferido" : "medido");
function segmentado(opcoes, atual, aoMudar) {
  return h("span", { class: "seg" }, opcoes.map(([v, t]) => h("button", { class: v === atual ? "on" : "", onclick: () => aoMudar(v) }, t)));
}

// ------------------------------------------------------------------ ações comuns
async function abrirWorkflow(rel) {
  try {
    const caminho = "workflows/" + rel;
    const r = await api.fetchApi("/userdata/" + enc(caminho));
    if (!r.ok) throw new Error("não encontrado");
    const dados = await r.json();
    const ws = app.extensionManager?.workflow;
    let wf = null;
    try { await ws?.syncWorkflows?.(); wf = ws?.getWorkflowByPath?.(caminho); } catch (e) {}
    await app.loadGraphData(dados, true, true, wf || rel.split("/").pop().replace(/\.json$/, ""));
    fecharPainel();
    toast("Workflow aberto: " + rel, "success");
  } catch (e) { toast("Não consegui abrir: " + e.message, "error"); }
}
async function carregarDaImagem(path, nome) {
  const r = await api.fetchApi("/cofre/arquivo?path=" + enc(path));
  const b = await r.blob();
  const f = new File([b], nome, { type: b.type || "image/png" });
  await app.handleFile(f);
  fecharPainel();
  toast("Workflow carregado da imagem " + nome, "success");
}
async function abrirPasta(path) { const r = await POST("/cofre/abrir_pasta", { path }); if (r.erro) toast(r.erro, "error"); }
async function lixeira(paths, depois) {
  if (!paths.length) return;
  const lista = paths.slice(0, 12).map((p) => "• " + p.split("/").pop()).join("\n") + (paths.length > 12 ? `\n… e mais ${paths.length - 12}` : "");
  if (!confirm(`Enviar ${paths.length} arquivo(s) para a Lixeira do sistema?\n\n${lista}\n\nVocê pode restaurar pelo gerenciador de arquivos (Lixeira).`)) return;
  const r = await POST("/cofre/lixeira", { paths, confirmar: true });
  toast(`${r.feitos?.length || 0} enviado(s) para a Lixeira` + (r.erros?.length ? ` · ${r.erros.length} erro(s): ${r.erros[0]}` : ""), r.erros?.length ? "warn" : "success");
  depois?.();
}

// ------------------------------------------------------------------ painel
let OV = null, ABA = "painel", POLL = null;
const ABAS = [["painel", "📊 Painel"], ["modelos", "🧠 Modelos"], ["workflows", "🧩 Workflows"], ["nodes", "🔌 Custom nodes"],
  ["saidas", "🖼️ Saídas"], ["limpeza", "🧹 Limpeza"], ["busca", "🔎 Busca"], ["atividade", "📜 Atividade"], ["config", "⚙️ Configurações"]];

function fecharPainel() { OV?.remove(); OV = null; clearInterval(POLL); document.removeEventListener("keydown", esc); }
function abrirPainel(aba = "painel") {
  injetarCSS(); fecharPainel(); ABA = aba;
  const corpo = h("div", { class: "cofre-body" });
  const prog = h("span", { class: "prog" });
  const tabs = h("div", { class: "cofre-tabs" }, ABAS.map(([id, nome]) => h("button", { "data-id": id, class: id === ABA ? "on" : "", onclick: () => trocar(id) }, nome)));
  const win = h("div", { class: "cofre-win cofre" },
    h("div", { class: "cofre-top" }, h("h2", {}, "🔐 Cofre do ComfyUI"), prog, h("span", { style: "flex:1" }),
      h("button", { class: "btn leve", title: "Mostrar ou desfocar conteúdo sensível nesta sessão", onclick: (e) => { MOSTRAR = !MOSTRAR; e.target.textContent = MOSTRAR ? "🙈 Desfocar sensíveis" : "👁️ Mostrar sensíveis"; render(); } }, MOSTRAR ? "🙈 Desfocar sensíveis" : "👁️ Mostrar sensíveis"),
      h("button", { class: "btn", onclick: indexar }, "🔄 Atualizar índice"),
      h("button", { class: "btn leve", onclick: fecharPainel }, "✕ Fechar")),
    tabs, corpo);
  OV = h("div", { class: "cofre-ov", onclick: (e) => { if (e.target === OV) fecharPainel(); } }, win);
  document.body.append(OV);
  document.addEventListener("keydown", esc);
  function trocar(id) { ABA = id; tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === id)); render(); }
  async function indexar() { await POST("/cofre/indexar", {}); acompanhar(); }
  async function acompanhar() {
    clearInterval(POLL);
    const tick = async () => {
      const e = await GET("/cofre/estado"); const i = e.indexacao, m = e.movendo, cv = e.civitai || {}, at = e.atualizacoes || {};
      let t = "";
      if (i.rodando) t = `Indexando ${i.etapa}: ${i.feito}/${i.total} ${i.msg ? "· " + i.msg.slice(0, 40) : ""}`;
      else if (i.erro) t = "Erro na indexação: " + i.erro;
      else if (i.ultimo) t = "Índice atualizado " + DATA(i.ultimo) + (i.msg ? ` (${i.msg})` : "");
      if (m.ativo) t += ` · Movendo ${m.arquivo}: ${Math.round((100 * m.feito) / Math.max(1, m.total))}%`;
      else if (m.erro) t += " · Erro ao mover: " + m.erro;
      if (cv.ativo) t += ` · Civitai ${cv.feito}/${cv.total} (${cv.achados} achados) ${cv.atual ? "· " + cv.atual.slice(0, 30) : ""}`;
      if (at.ativo) t += ` · Verificando atualizações ${at.feito}/${at.total}`;
      prog.textContent = t;
      if (!i.rodando && !m.ativo && !cv.ativo && !at.ativo) { clearInterval(POLL); if (acompanhar.recarregar) { acompanhar.recarregar = false; render(); } }
      else acompanhar.recarregar = true;
    };
    POLL = setInterval(tick, 1200); tick();
  }
  async function render() {
    corpo.innerHTML = ""; corpo.append(h("div", { class: "mut" }, "Carregando…"));
    try { const el = await TELAS[ABA](); corpo.innerHTML = ""; corpo.append(el); }
    catch (e) { corpo.innerHTML = ""; corpo.append(h("div", { class: "tag er" }, "Erro: " + e.message)); }
  }
  abrirPainel.render = render; abrirPainel.acompanhar = acompanhar;
  GET("/cofre/config").then((c) => { CFG = c; }).catch(() => {}).finally(() => { render(); acompanhar(); });
}
function esc(e) { if (e.key === "Escape" && OV && !$(".cofre .lb") && !$(".cofre .modal")) { fecharPainel(); document.removeEventListener("keydown", esc); } }

// ------------------------------------------------------------------ telas
const TELAS = {
  async painel() {
    const r = await GET("/cofre/resumo");
    const vazio = !r.modelos && !r.workflows;
    const card = (titulo, valor, sub, aba) => h("div", { class: "card", style: aba ? "cursor:pointer" : "", onclick: aba ? () => abrirPainel(aba) : null }, h("small", {}, titulo), h("b", {}, valor), h("small", {}, sub || ""));
    return h("div", {},
      vazio ? h("div", { class: "det" }, "O índice está vazio. Clique em ", h("b", {}, "🔄 Atualizar índice"), " — a primeira vez pode levar alguns minutos (lê o cabeçalho de cada modelo, sem carregar na memória).") : null,
      h("div", { class: "cards" },
        card("Modelos", r.modelos, GB(r.modelos_bytes), "modelos"),
        card("Workflows prontos", `${r.wf_prontos}/${r.workflows}`, "têm todos os nodes e modelos", "workflows"),
        card("Custom nodes", r.nodes, r.nodes_problema ? `${r.nodes_problema} com problema` : "todos carregados", "nodes"),
        card("Saídas geradas", r.saidas, GB(r.saidas_bytes), "saidas"),
        card("Duplicados", r.duplicados, GB(r.dup_bytes) + " recuperáveis", "limpeza"),
        card("Arquivos com problema", r.corrompidos, "truncados ou ilegíveis", "limpeza")),
      h("h3", {}, "💽 Discos"),
      h("table", {}, h("tr", {}, h("th", {}, "Disco"), h("th", {}, "Montado em"), h("th", { style: "width:40%" }, "Uso"), h("th", { class: "num" }, "Livre")),
        r.discos.map((d) => h("tr", {}, h("td", {}, d.nome), h("td", { class: "mut" }, d.ponto),
          h("td", {}, h("div", { class: "bar" }, h("i", { style: `width:${(100 * d.usado) / d.total}%` })), h("small", { class: "mut" }, `${GB(d.usado)} de ${GB(d.total)}`)),
          h("td", { class: "num" }, GB(d.livre))))),
      h("h3", {}, "📁 Modelos por categoria e disco"),
      h("table", {}, h("tr", {}, h("th", {}, "Categoria"), h("th", {}, "Disco"), h("th", { class: "num" }, "Arquivos"), h("th", { class: "num" }, "Tamanho")),
        r.por_categoria.map((c) => h("tr", { class: "clic", onclick: () => { FILTROS.modelos = { cat: c.cat, disco: c.disco }; abrirPainel("modelos"); } },
          h("td", {}, c.cat), h("td", {}, c.disco), h("td", { class: "num" }, c.n), h("td", { class: "num" }, GB(c.bytes))))),
      h("h3", {}, "🧬 Por família de modelo"),
      h("div", {}, r.por_familia.map((f) => h("span", { class: "tag" }, `${f.familia}: ${f.n} · ${GB(f.bytes)}`))));
  },

  async modelos() {
    const F = (FILTROS.modelos = Object.assign({ q: "", cat: "", disco: "", familia: "", filtro: "", ordem: "tamanho" }, FILTROS.modelos || {}));
    const [res, fac] = await Promise.all([
      GET(`/cofre/modelos?q=${enc(F.q)}&cat=${enc(F.cat)}&disco=${enc(F.disco)}&familia=${enc(F.familia)}&filtro=${enc(F.filtro)}&ordem=${enc(F.ordem)}`),
      GET(`/cofre/facetas?cat=${enc(F.cat)}&disco=${enc(F.disco)}`)]);
    const re = () => abrirPainel.render();
    const sel = (nome, opts) => h("select", { onchange: (e) => { F[nome] = e.target.value; re(); } },
      opts.map(([v, t]) => h("option", { value: v, selected: F[nome] === v }, t)));
    const busca = h("input", { placeholder: "Buscar nome, família, gatilho, Civitai…", value: F.q, style: "width:250px",
      onkeydown: (e) => { if (e.key === "Enter") { F.q = e.target.value; re(); } } });
    const total = res.reduce((a, m) => a + m.tamanho, 0);
    const fa = (rot, n, ativo, fn, extra) => h("a", { class: ativo ? "on" : "", onclick: fn }, h("span", {}, rot, extra || ""), h("span", {}, n));
    const totCats = fac.cats.reduce((a, c) => a + c.n, 0);
    const lateral = h("div", { class: "facet" },
      h("h4", {}, "Pastas"),
      fa("Todas", totCats, !F.cat, () => { F.cat = ""; F.familia = ""; re(); }),
      fac.cats.map((c) => fa((ICONE_CAT[c.cat] || "📦") + " " + c.cat, c.n, F.cat === c.cat, () => { F.cat = c.cat; F.familia = ""; re(); })),
      h("h4", {}, "Famílias" + (F.cat ? ` em ${F.cat}` : "")),
      fa("Todas", "", !F.familia, () => { F.familia = ""; re(); }),
      fac.familias.map((f) => fa(f.familia, f.n, F.familia === f.familia, () => { F.familia = f.familia; re(); })),
      h("h4", {}, "Discos"),
      fa("Todos", "", !F.disco, () => { F.disco = ""; re(); }),
      fac.discos.map((d) => fa(d.disco, d.n, F.disco === d.disco, () => { F.disco = d.disco; re(); }, d.offline ? " ⏏️" : "")));

    const semDados = res.filter((m) => !m.civitai && /^(safetensors|GGUF)/.test(m.formato) && !m.offline);
    const btnCivitai = CFG.civitai === "1" && semDados.length ? h("button", { class: "btn leve", title: "Calcula o SHA256 de cada arquivo (local) e consulta o Civitai: prévia, gatilhos, descrição, versão nova e classificação adulta. Só o hash é enviado.", onclick: async () => {
      const bytes = semDados.reduce((a, m) => a + m.tamanho, 0);
      if (!confirm(`Consultar o Civitai para ${semDados.length} modelo(s) desta lista (${GB(bytes)})?\n\nO Cofre calcula o SHA256 de cada arquivo no seu disco (pode demorar em arquivos grandes) e envia SÓ o hash.\nVem: prévia, gatilhos, descrição, aviso de versão nova e classificação adulta.`)) return;
      const r = await POST("/cofre/civitai_lote", { paths: semDados.map((m) => m.path), confirmar: true });
      if (r.erro) toast(r.erro, "error"); else { toast("Consultando o Civitai… acompanhe no topo.", "info"); abrirPainel.acompanhar(); }
    } }, `🌐 Buscar prévias no Civitai (${semDados.length})`) : null;

    const vista = PREF.vistaModelos;
    const [cw, ch] = TAM[PREF.tam] || TAM.m;
    let conteudo;
    if (vista === "grade") {
      conteudo = h("div", { class: "mgrid", style: `--cw:${cw}px;--ch:${ch}px` }, res.map((m) => cartaoModelo(m)));
    } else {
      const tbody = h("tbody");
      for (const m of res) {
        const mini = m.previa ? sens(h("img", { loading: "lazy", src: api.apiURL(`/cofre/previa?path=${enc(m.path)}&lado=160`), style: "width:44px;height:44px;object-fit:cover;display:block;border-radius:5px" }), m.previa.sensivel, m.sensivel_motivo)
          : h("div", { style: `width:44px;height:44px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:20px;background:${corFamilia(m.familia)}` }, ICONE_CAT[m.cat] || "📦");
        const tr = h("tr", { class: "clic" },
          h("td", { style: "width:52px" }, mini),
          h("td", {}, h("div", {}, m.nome, m.sensivel ? h("span", { class: "tag er", title: m.sensivel_motivo, style: "margin-left:6px" }, "🔞") : null, m.offline ? h("span", { class: "tag av", style: "margin-left:6px" }, "offline") : null, m.nova_versao ? h("span", { class: "tag ok", style: "margin-left:6px" }, "versão nova") : null),
            h("small", { class: "mut" }, m.rel !== m.nome ? m.rel : "")),
          h("td", {}, m.cat), h("td", {}, h("span", { class: "tag " + (m.familia_inferida ? "inf" : "med") }, (m.familia_inferida ? "~ " : "") + m.familia.replace(" (pelo nome)", "")), h("div", { class: "mut" }, m.papel)),
          h("td", {}, m.precisao), h("td", { class: "num" }, PAR(m.params)), h("td", { class: "num" }, GB(m.tamanho)),
          h("td", {}, m.disco), h("td", { class: "num" }, m.usado_por.length ? h("span", { class: "tag ok" }, m.usado_por.length) : h("span", { class: "tag" }, "0")),
          h("td", {}, tagIntegridade(m)));
        let aberto = null;
        tr.onclick = () => { if (aberto) { aberto.remove(); aberto = null; return; } aberto = h("tr", {}, h("td", { colspan: 10 }, detalheModelo(m))); tr.after(aberto); };
        tbody.append(tr);
      }
      conteudo = h("table", {}, h("thead", {}, h("tr", {}, ["", "Arquivo", "Pasta", "Família / papel", "Precisão", "Parâm.", "Tamanho", "Disco", "Usado em", "Integridade"].map((t, i) => h("th", { class: [5, 6, 8].includes(i) ? "num" : "" }, t)))), tbody);
    }
    return h("div", { class: "mlay" }, lateral,
      h("div", { style: "flex:1;min-width:0" },
        h("div", { class: "cofre-row" }, busca,
          sel("filtro", [["", "Todos"], ["sem_previa", "Sem prévia"], ["sensiveis", "Sensíveis 🔞"], ["duplicados", "Só duplicados"], ["nao_usados", "Não usados por workflows"], ["problemas", "Com problema"], ["offline", "Em disco desconectado"]]),
          sel("ordem", [["tamanho", "Maior primeiro"], ["nome", "Nome"], ["data", "Mais recentes"], ["familia", "Família"]]),
          segmentado([["grade", "▦ Miniaturas"], ["lista", "☰ Lista"]], vista, (v) => { PREF.vistaModelos = v; salvarPref(); re(); }),
          vista === "grade" ? segmentado([["p", "P"], ["m", "M"], ["g", "G"]], PREF.tam, (v) => { PREF.tam = v; salvarPref(); re(); }) : null,
          btnCivitai,
          h("span", { class: "mut" }, `${res.length} arquivos · ${GB(total)}`)),
        res.length ? conteudo : h("div", { class: "mut", style: "padding:30px;text-align:center" }, "Nada encontrado com esses filtros.")));
  },

  async workflows() {
    const F = (FILTROS.workflows = Object.assign({ q: "", status: "" }, FILTROS.workflows || {}));
    const res = await GET(`/cofre/workflows?q=${enc(F.q)}&status=${enc(F.status)}`);
    const cor = { pronto: "ok", "falta modelo": "av", "falta node": "er", "falta node e modelo": "er", erro: "er" };
    const cont = {}; res.forEach((w) => (cont[w.status] = (cont[w.status] || 0) + 1));
    const lista = h("div");
    let pasta = null;
    for (const w of res) {
      if (w.pasta !== pasta) { pasta = w.pasta; lista.append(h("h3", {}, "📁 " + (pasta || "(raiz)"))); }
      const det = h("div", { class: "det", style: "display:none" },
        w.erro ? h("div", { class: "tag er" }, "JSON inválido: " + w.erro) : null,
        h("div", {}, h("b", {}, "Nodes: "), w.n_nodes, "  ·  ", h("b", {}, "Famílias: "), (w.familias || []).join(", ") || "—"),
        Object.keys(w.faltam_nodes).length ? h("div", {}, h("h3", {}, "Nodes que faltam"),
          Object.entries(w.faltam_nodes).map(([t, p]) => h("div", {}, h("span", { class: "tag er" }, t), h("span", { class: "mut" }, " pacote: " + p)))) : null,
        w.faltam_modelos.length ? h("div", {}, h("h3", {}, "Modelos que faltam"),
          w.faltam_modelos.map((m) => h("div", {}, h("span", { class: "tag av" }, m),
            w.sugestoes[m] ? h("span", { class: "mut" }, " → parecidos que você tem: " + w.sugestoes[m].join(" · ")) : null))) : null,
        w.modelos.length ? h("details", {}, h("summary", {}, `Modelos usados (${w.modelos.length})`), h("pre", {}, w.modelos.join("\n"))) : null);
      lista.append(h("div", { style: "display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(128,128,128,.15)" },
        h("span", { class: "tag " + (cor[w.status] || ""), style: "min-width:110px;text-align:center" }, w.status),
        h("span", { style: "flex:1;cursor:pointer", onclick: () => (det.style.display = det.style.display === "none" ? "" : "none") }, w.nome),
        h("small", { class: "mut" }, DATA(w.mtime)),
        h("button", { class: "btn", onclick: () => abrirWorkflow(w.path) }, "Abrir no ComfyUI")), det);
    }
    return h("div", {},
      h("div", { class: "cofre-row" },
        h("input", { placeholder: "Buscar workflow, node ou modelo…", value: F.q, style: "width:280px", onkeydown: (e) => { if (e.key === "Enter") { F.q = e.target.value; abrirPainel.render(); } } }),
        h("select", { onchange: (e) => { F.status = e.target.value; abrirPainel.render(); } },
          [["", "Todos"], ["pronto", "Prontos"], ["falta modelo", "Falta modelo"], ["falta node", "Falta node"], ["falta node e modelo", "Falta node e modelo"], ["erro", "Com erro"]]
            .map(([v, t]) => h("option", { value: v, selected: F.status === v }, t))),
        Object.entries(cont).map(([s, n]) => h("span", { class: "tag " + (cor[s] || "") }, `${s}: ${n}`))),
      lista);
  },

  async nodes() {
    const res = await GET("/cofre/nodes");
    const nAtu = res.filter((n) => n.atualizacao === "atualização disponível").length;
    const ultima = Math.max(0, ...res.map((n) => n.verificado || 0));
    const corAtu = (a) => a === "atualizado" ? "ok" : a === "atualização disponível" ? "av" : a ? "er" : "";
    return h("div", {},
      h("div", { class: "cofre-row" },
        h("button", { class: "btn", title: "Compara o commit instalado com o do GitHub (git ls-remote). Não baixa nem altera nada.", onclick: async () => {
          const r = await POST("/cofre/atualizacoes", {}); if (r.erro) toast(r.erro, "error"); else { toast("Verificando… acompanhe no topo.", "info"); abrirPainel.acompanhar(); }
        } }, "🔄 Verificar atualizações (só leitura)"),
        nAtu ? h("span", { class: "tag av" }, `${nAtu} com atualização disponível`) : null,
        ultima ? h("span", { class: "mut" }, "última verificação: " + DATA(ultima)) : h("span", { class: "mut" }, "ainda não verificado")),
      h("div", { class: "mut", style: "margin-bottom:8px" }, "As classes vêm do próprio ComfyUI já carregado — nenhum código é executado pelo Cofre. Para atualizar um pacote, use o ComfyUI-Manager ou “git pull” na pasta dele."),
      h("table", {}, h("tr", {}, ["Pacote", "Situação", "Nodes", "Usado em", "Git", "Atualização", "Tamanho", ""].map((t, i) => h("th", { class: [2, 3, 6].includes(i) ? "num" : "" }, t))),
        res.map((n) => h("tr", {},
          h("td", {}, h("div", {}, n.nome), n.requisitos ? h("details", {}, h("summary", { class: "mut" }, "requisitos"), h("pre", {}, n.requisitos)) : null,
            n.classes.length ? h("details", {}, h("summary", { class: "mut" }, `${n.classes.length} nodes`), h("pre", {}, n.classes.join("\n"))) : null),
          h("td", {}, h("span", { class: "tag " + (n.situacao.includes("⚠️") || n.situacao.startsWith("provável") ? "av" : n.situacao === "ok" ? "ok" : n.situacao === "desativado" || n.situacao.startsWith("só interface") ? "" : "er") }, n.situacao)),
          h("td", { class: "num" }, n.n_classes), h("td", { class: "num" }, n.workflows_que_usam || 0),
          h("td", {}, n.git_url ? h("a", { href: n.git_url.replace(/\.git$/, ""), target: "_blank", style: "color:#4ea1ff" }, n.git_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")) : h("span", { class: "mut" }, "sem git"),
            n.commit_ ? h("div", { class: "mut" }, `${n.branch || ""} @ ${n.commit_}`) : null),
          h("td", {}, n.atualizacao ? h("span", { class: "tag " + corAtu(n.atualizacao), title: n.remoto ? "remoto: " + n.remoto : "" }, n.atualizacao) : h("span", { class: "mut" }, n.git_url ? "—" : "")),
          h("td", { class: "num" }, GB(n.tamanho)),
          h("td", {}, h("button", { class: "btn leve", onclick: () => abrirPasta(n.pasta) }, "📂"))))));
  },

  async saidas() {
    const F = (FILTROS.saidas = Object.assign({ q: "", tipo: "", pagina: 0, sens: "", ordem: "data", por: 60 }, FILTROS.saidas || {}));
    const r = await GET(`/cofre/saidas?q=${enc(F.q)}&tipo=${enc(F.tipo)}&pagina=${F.pagina}&por_pag=${F.por}&sens=${enc(F.sens)}&ordem=${enc(F.ordem)}`);
    const re = () => abrirPainel.render();
    const paginas = Math.max(1, Math.ceil(r.total / F.por));
    const itens = r.itens;
    const vista = PREF.vistaSaidas;
    const [cw, ch] = TAM[PREF.tam] || TAM.m;
    const midiaMini = (s, lado) => s.tipo === "áudio" ? h("div", { style: `height:${lado}px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(lado / 3)}px` }, "🔊")
      : s.tipo === "texto" ? h("div", { class: "txtprev", style: lado < 100 ? `height:${lado}px;font-size:8px;padding:3px` : "" }, (s.prompt || "").slice(0, 400))
        : h("img", { loading: "lazy", src: api.apiURL(`/cofre/miniatura?path=${enc(s.path)}`), onerror: (e) => (e.target.style.opacity = 0.15) });
    let conteudo;
    if (vista === "grade") {
      conteudo = h("div", { class: "grid", style: `grid-template-columns:repeat(auto-fill,minmax(${cw - 10}px,1fr));--ch:${ch - 20}px` }, itens.map((s, i) =>
        h("div", { class: "thumb", onclick: () => lightbox(itens, i) },
          sens(midiaMini(s, ch - 20), s.sensivel, s.sensivel_motivo),
          s.tipo === "vídeo" || s.tipo === "áudio" ? h("span", { class: "play" }, "▶") : null,
          h("div", {}, s.nome), h("div", { class: "mut" }, `${s.sub === "." ? "(raiz)" : s.sub} · ${DATA(s.mtime)}`))));
    } else {
      conteudo = h("table", { class: "lista-s" },
        h("thead", {}, h("tr", {}, ["", "Arquivo", "Tipo", "Dimensões", "Modelo / LoRAs", "Seed", "Prompt", "Tamanho", "Data", ""].map((t, i) => h("th", { class: [7].includes(i) ? "num" : "" }, t)))),
        h("tbody", {}, itens.map((s, i) => h("tr", { class: "clic", onclick: () => lightbox(itens, i) },
          h("td", { style: "width:80px" }, h("div", { class: "mini" }, sens(midiaMini(s, 72), s.sensivel, s.sensivel_motivo))),
          h("td", {}, h("div", {}, s.nome, s.sensivel ? h("span", { class: "tag er", style: "margin-left:6px", title: s.sensivel_motivo }, "🔞") : null), h("small", { class: "mut" }, s.sub === "." ? "(raiz)" : s.sub)),
          h("td", {}, s.tipo), h("td", { class: "mut" }, s.largura ? `${s.largura}×${s.altura}` : "—"),
          h("td", {}, h("div", { class: "clamp" }, (s.modelos_usados?.length ? s.modelos_usados : [s.modelo].filter(Boolean)).join(" · ") || "—")),
          h("td", { class: "mut" }, s.seed || "—"),
          h("td", {}, h("div", { class: "clamp" }, s.tipo === "texto" ? "" : (deveDesfocar(s.sensivel) ? "🔞 (oculto)" : s.prompt || "—"))),
          h("td", { class: "num" }, GB(s.tamanho)), h("td", { class: "mut", style: "white-space:nowrap" }, DATA(s.mtime)),
          h("td", { style: "white-space:nowrap", onclick: (e) => e.stopPropagation() },
            s.tem_workflow ? h("button", { class: "btn leve", title: "Carregar workflow desta imagem", onclick: () => carregarDaImagem(s.path, s.nome) }, "🧩") : null,
            h("button", { class: "btn leve", title: "Abrir pasta", onclick: () => abrirPasta(s.path) }, "📂"),
            h("button", { class: "btn leve", title: "Lixeira", onclick: () => lixeira([s.path], re) }, "🗑️"))))));
    }
    return h("div", {},
      h("div", { class: "cofre-row" },
        h("input", { placeholder: "Buscar por prompt, seed, modelo, LoRA, pasta…", value: F.q, style: "width:280px", onkeydown: (e) => { if (e.key === "Enter") { F.q = e.target.value; F.pagina = 0; re(); } } }),
        h("select", { onchange: (e) => { F.tipo = e.target.value; F.pagina = 0; re(); } },
          [["", "Tudo"], ["imagem", "Imagens"], ["vídeo", "Vídeos"], ["áudio", "Áudios"], ["texto", "Textos / JSON"]].map(([v, t]) => h("option", { value: v, selected: F.tipo === v }, t))),
        h("select", { onchange: (e) => { F.sens = e.target.value; F.pagina = 0; re(); } },
          [["", "Sensíveis: desfocar"], ["ocultar", "Sensíveis: ocultar"], ["so", "Só sensíveis 🔞"]].map(([v, t]) => h("option", { value: v, selected: F.sens === v }, t))),
        h("select", { onchange: (e) => { F.ordem = e.target.value; F.pagina = 0; re(); } },
          [["data", "Mais recentes"], ["antigas", "Mais antigas"], ["tamanho", "Maiores"], ["nome", "Nome"]].map(([v, t]) => h("option", { value: v, selected: F.ordem === v }, t))),
        segmentado([["grade", "▦ Miniaturas"], ["lista", "☰ Lista"]], vista, (v) => { PREF.vistaSaidas = v; salvarPref(); re(); }),
        vista === "grade" ? segmentado([["p", "P"], ["m", "M"], ["g", "G"]], PREF.tam, (v) => { PREF.tam = v; salvarPref(); re(); }) : null,
        h("span", { class: "mut" }, `${r.total} arquivos${r.sensiveis ? ` · ${r.sensiveis} sensíveis` : ""}`), h("span", { style: "flex:1" }),
        h("select", { onchange: (e) => { F.por = +e.target.value; F.pagina = 0; re(); } }, [30, 60, 120, 240].map((n) => h("option", { value: n, selected: F.por === n }, `${n}/pág.`))),
        h("button", { class: "btn leve", disabled: F.pagina <= 0, onclick: () => { F.pagina--; re(); } }, "◀"),
        h("span", {}, `${F.pagina + 1}/${paginas}`),
        h("button", { class: "btn leve", disabled: F.pagina >= paginas - 1, onclick: () => { F.pagina++; re(); } }, "▶")),
      itens.length ? conteudo : h("div", { class: "mut", style: "padding:30px;text-align:center" }, "Nada encontrado."));
  },

  async limpeza() {
    const r = await GET("/cofre/limpeza");
    const marcados = new Map();
    const totalEl = h("b", {}, "0 selecionados");
    const atualizar = () => { let t = 0; marcados.forEach((v) => (t += v)); totalEl.textContent = `${marcados.size} selecionado(s) · ${GB(t)}`; };
    const chk = (path, tam, marcado = false) => { const c = h("input", { type: "checkbox", onchange: (e) => { e.target.checked ? marcados.set(path, tam) : marcados.delete(path); atualizar(); } }); if (marcado) { c.checked = true; marcados.set(path, tam); } return c; };
    const linhaArq = (m, marcado, extra) => h("tr", {}, h("td", { style: "width:26px" }, chk(m.path, m.tamanho, marcado)),
      h("td", {}, m.nome, h("div", { class: "mut" }, m.path)), h("td", {}, m.cat || ""), h("td", {}, m.disco || ""),
      h("td", { class: "num" }, GB(m.tamanho)), h("td", {}, extra || ""));
    const el = h("div", {},
      h("div", { class: "cofre-row det" }, "🧹 Marque o que quiser remover. Nada é apagado de vez: vai para a ", h("b", {}, "Lixeira do sistema"), " (restaurável).",
        h("span", { style: "flex:1" }), totalEl,
        h("button", { class: "btn perigo", onclick: () => lixeira([...marcados.keys()], () => abrirPainel.render()) }, "🗑️ Enviar selecionados para a Lixeira")),
      h("h3", {}, `👯 Duplicados (${r.duplicados.length} grupos) — o 1º de cada grupo fica`),
      h("div", { class: "mut" }, "Cópias no mesmo disco vêm marcadas. Cópias em outro disco (ex.: SSD e HD externo) ficam desmarcadas — podem ser backup intencional."),
      r.duplicados.length ? h("table", {}, r.duplicados.flatMap((g0) => {
        const g = [...g0].sort((a, b) => (a.disco?.startsWith("Sistema") ? 0 : 1) - (b.disco?.startsWith("Sistema") ? 0 : 1));
        return g.map((m, i) => linhaArq(m, i > 0 && m.disco === g[0].disco,
          i === 0 ? h("span", { class: "tag ok" }, "manter") : h("span", { class: "tag av" }, m.disco === g[0].disco ? "cópia no mesmo disco" : "cópia em outro disco")));
      })) : h("div", { class: "mut" }, "Nenhum duplicado encontrado."),
      h("h3", {}, `⏳ Downloads incompletos (${r.incompletos.length})`),
      r.incompletos.length ? h("table", {}, r.incompletos.map((m) => linhaArq(m, true, h("span", { class: "tag er" }, "incompleto")))) : h("div", { class: "mut" }, "Nenhum."),
      h("h3", {}, `⚠️ Arquivos com problema (${r.problemas.length})`),
      r.problemas.length ? h("table", {}, r.problemas.map((m) => linhaArq(m, false, h("span", { class: "tag er" }, m.integro)))) : h("div", { class: "mut" }, "Nenhum."),
      h("h3", {}, `💤 Modelos que nenhum workflow usa`),
      h("div", { class: "cofre-row" }, h("span", { class: "mut" }, "Atenção: “não usado” considera só os workflows salvos. LoRAs e modelos escolhidos na hora podem aparecer aqui."),
        segmentado([["tamanho", "Maiores primeiro"], ["idade", "Mais antigos primeiro"]], FILTROS.ordemNaoUsados || "tamanho", (v) => { FILTROS.ordemNaoUsados = v; abrirPainel.render(); })),
      h("table", {}, [...r.nao_usados].sort((a, b) => (FILTROS.ordemNaoUsados === "idade" ? a.mtime - b.mtime : b.tamanho - a.tamanho)).map((m) => {
        const meses = Math.floor((Date.now() / 1000 - m.mtime) / 2592000);
        return linhaArq(m, false, [h("span", { class: "tag" }, m.familia || ""), h("span", { class: "tag " + (meses >= 6 ? "av" : "") }, meses >= 1 ? `${meses} ${meses === 1 ? "mês" : "meses"} sem mudar` : "recente")]);
      })),
      h("h3", {}, "📦 Maiores modelos"),
      h("table", {}, r.grandes.map((m) => linhaArq(m, false, h("span", { class: "tag " + (m.usado_por ? "ok" : "") }, `usado em ${m.usado_por}`)))),
      h("h3", {}, "🖼️ Pastas de saída que mais ocupam"),
      h("table", {}, r.saidas_pastas.map((s) => h("tr", {}, h("td", {}, s.sub || "(raiz)"), h("td", { class: "num" }, s.n), h("td", { class: "num" }, GB(s.bytes))))));
    atualizar();
    return el;
  },

  async busca() {
    const F = (FILTROS.busca = FILTROS.busca || { q: "" });
    const inp = h("input", { placeholder: "Busque em tudo: modelo, workflow, node, prompt, seed…", value: F.q, style: "width:420px", onkeydown: (e) => { if (e.key === "Enter") { F.q = e.target.value; abrirPainel.render(); } } });
    setTimeout(() => inp.focus(), 50);
    if (!F.q) return h("div", {}, h("div", { class: "cofre-row" }, inp));
    const r = await GET("/cofre/busca?q=" + enc(F.q));
    return h("div", {}, h("div", { class: "cofre-row" }, inp),
      h("h3", {}, `🧠 Modelos (${r.modelos.length})`), r.modelos.map((m) => h("div", {}, h("span", { class: "tag" }, m.cat), m.rel, h("span", { class: "mut" }, ` · ${GB(m.tamanho)} · ${m.disco}`))),
      h("h3", {}, `🧩 Workflows (${r.workflows.length})`), r.workflows.map((w) => h("div", { style: "display:flex;gap:8px;align-items:center;margin:3px 0" }, h("span", { style: "flex:1" }, w.path), h("button", { class: "btn", onclick: () => abrirWorkflow(w.path) }, "Abrir"))),
      h("h3", {}, `🔌 Custom nodes (${r.nodes.length})`), r.nodes.map((n) => h("div", {}, n.nome, h("span", { class: "mut" }, ` · ${n.n_classes} nodes`))),
      h("h3", {}, `🖼️ Saídas (${r.saidas.length})`), h("div", { class: "grid" }, r.saidas.map((s, i) => h("div", { class: "thumb", onclick: () => lightbox(r.saidas, i) }, sens(s.tipo === "texto" ? h("div", { class: "txtprev" }, (s.prompt || "").slice(0, 300)) : h("img", { loading: "lazy", src: api.apiURL(`/cofre/miniatura?path=${enc(s.path)}`) }), s.sensivel, s.sensivel_motivo), h("div", {}, s.nome)))));
  },

  async atividade() {
    const r = await GET("/cofre/atividade");
    const icone = { lixeira: "🗑️", mover: "🚚", civitai: "🌐", "marcação": "🏷️", "configuração": "⚙️", "verificar atualizações": "🔄" };
    const resumo = (a, d) => {
      if (a === "lixeira") return `${d.feitos?.length || 0} arquivo(s) para a Lixeira${d.erros?.length ? ` · ${d.erros.length} erro(s)` : ""}` + (d.feitos?.length ? ": " + d.feitos.slice(0, 3).map((p) => p.split("/").pop()).join(", ") + (d.feitos.length > 3 ? "…" : "") : "");
      if (a === "mover") return `${(d.de || "").split("/").pop()} → ${d.para}`;
      if (a === "civitai") return `${(d.path || "").split("/").pop()} — ${d.achado ? "encontrado" : "não encontrado"}`;
      if (a === "marcação") return `${(d.path || "").split("/").pop()}${d.nsfw !== "manter" ? ` · sensível: ${d.nsfw === null ? "automático" : d.nsfw ? "sim" : "não"}` : ""}${d.previa !== "manter" ? ` · prévia: ${d.previa ? d.previa.split("/").pop() : "removida"}` : ""}`;
      if (a === "verificar atualizações") return `${d.pacotes} pacotes verificados`;
      return JSON.stringify(d);
    };
    return h("div", {},
      h("div", { class: "mut", style: "margin-bottom:8px" }, "Tudo o que o Cofre alterou ou consultou fica registrado aqui (arquivo user/cofre/cofre.db)."),
      r.length ? h("table", {}, r.map((x) => h("tr", {}, h("td", { style: "white-space:nowrap", class: "mut" }, DATA(x.quando)), h("td", { style: "white-space:nowrap" }, `${icone[x.acao] || "•"} ${x.acao}`), h("td", {}, resumo(x.acao, x.detalhe)))))
        : h("div", { class: "mut" }, "Nenhuma atividade ainda."));
  },

  async config() {
    const c = await GET("/cofre/config");
    const v = { ...c };
    const chk = (k, rot, sub) => h("label", { style: "display:flex;gap:8px;align-items:flex-start;margin:8px 0;cursor:pointer" },
      h("input", { type: "checkbox", checked: v[k] === "1", onchange: (e) => (v[k] = e.target.checked ? "1" : "0") }), h("span", {}, h("b", {}, rot), sub ? h("div", { class: "mut" }, sub) : null));
    const ta = h("textarea", { oninput: (e) => (v.nsfw_palavras = e.target.value) }, v.nsfw_palavras);
    return h("div", { style: "max-width:820px" },
      h("h3", { style: "margin-top:0" }, "🔞 Conteúdo sensível"),
      chk("nsfw_desfocar", "Desfocar imagens sensíveis", "Miniaturas, prévias de modelos e o visualizador ficam desfocados até você clicar. O botão “Mostrar sensíveis” no topo revela tudo só nesta sessão."),
      chk("nsfw_nomes_modelos", "Considerar o nome e as tags de treino dos modelos", "Ex.: um LoRA com “nsfw” ou “uncensored” no nome é marcado, e toda imagem gerada com ele também."),
      h("div", {}, h("b", {}, "Palavras que marcam como sensível"), h("div", { class: "mut" }, "Separadas por vírgula. Valem para o prompt POSITIVO (o negativo é ignorado) e para nomes de modelos. Palavras com 5+ letras também pegam variações (erotic → erotica).")),
      ta,
      h("div", { class: "cofre-row", style: "margin-top:6px" }, h("button", { class: "btn leve", onclick: () => { ta.value = v.nsfw_palavras = c.__padrao || ta.value; } }, "↩️ Restaurar lista padrão")),
      h("div", { class: "mut" }, "Ordem de decisão: sua marcação manual (🔞 / ✅) > classificação do Civitai > palavras do prompt > modelos usados na geração."),
      h("h3", {}, "🌐 Civitai"),
      chk("civitai", "Permitir consultas ao Civitai", "Só acontecem quando você clica. Envia apenas o SHA256 do arquivo; traz prévia, gatilhos, descrição, aviso de versão nova e classificação adulta."),
      h("h3", {}, "🖼️ Prévias dos modelos — de onde vêm"),
      h("ol", { class: "mut", style: "margin:4px 0 0 18px;padding:0" },
        h("li", {}, "Imagem escolhida por você (aba Modelos → detalhe → imagens geradas)."),
        h("li", {}, "Arquivo ao lado do modelo com o mesmo nome: modelo.preview.png, modelo.png, modelo.jpg, modelo.webp…"),
        h("li", {}, "Prévia baixada do Civitai (guardada em user/cofre/previas)."),
        h("li", {}, "A imagem mais recente que você gerou usando aquele modelo ou LoRA.")),
      h("div", { class: "cofre-row", style: "margin-top:16px" },
        h("button", { class: "btn", onclick: async () => { CFG = await POST("/cofre/config", v); toast("Configurações salvas", "success"); } }, "💾 Salvar")));
  },
};
const FILTROS = {};

function tagIntegridade(m) {
  const t = m.integro || "";
  const v = /^íntegro|cabeçalho ok/.test(t) ? ["ok", "ok"] : /truncado/.test(t) ? ["er", "truncado"] : /ERRO/.test(t) ? ["er", "não é modelo / ilegível"]
    : /formato antigo/.test(t) ? ["", "formato não inspecionado"] : /sobra/.test(t) ? ["av", "sobra no fim"] : ["", t.slice(0, 24)];
  return h("span", { class: "tag " + v[0], title: t }, v[1]);
}

function cartaoModelo(m) {
  const capa = h("div", { class: "capa", style: `background:${corFamilia(m.familia)}` });
  if (m.previa) {
    const img = h("img", { loading: "lazy", src: api.apiURL(`/cofre/previa?path=${enc(m.path)}&lado=384`), onerror: () => { img.replaceWith(h("span", {}, ICONE_CAT[m.cat] || "📦")); } });
    capa.append(sens(img, m.previa.sensivel, m.sensivel_motivo || m.previa.origem, "cheio"));
    capa.lastChild.style.cssText = "width:100%;height:100%";
  } else capa.append(h("span", {}, ICONE_CAT[m.cat] || "📦"));
  const selos = h("div", { class: "selos" },
    m.nova_versao ? h("span", { title: "Há uma versão mais nova no Civitai" }, "⬆️") : null,
    /truncado|ERRO/.test(m.integro) ? h("span", { style: "background:#8a2a2a" }, "⛔") : null,
    m.offline ? h("span", { title: "disco desconectado" }, "⏏️") : null,
    m.usado_por.length ? h("span", { title: `usado em ${m.usado_por.length} workflow(s)` }, `🧩 ${m.usado_por.length}`) : null);
  capa.append(selos);
  return h("div", { class: "mcard", title: m.rel, onclick: () => modalModelo(m) }, capa,
    h("div", { class: "info" },
      h("div", { class: "nome" }, m.nome.replace(/\.(safetensors|gguf|ckpt|pt|pth|bin|sft)$/i, "")),
      h("div", {}, h("span", { class: "tag " + (m.familia_inferida ? "inf" : "med") }, (m.familia_inferida ? "~ " : "") + m.familia.replace(" (pelo nome)", ""))),
      h("div", { class: "mut" }, `${m.cat} · ${GB(m.tamanho)}${m.precisao && m.precisao !== "?" ? " · " + m.precisao.split(" ")[0] : ""}`)));
}

function modalModelo(m) {
  const grande = h("div", { class: "grande" });
  if (m.previa) {
    grande.append(sens(h("img", { src: api.apiURL(`/cofre/previa?path=${enc(m.path)}&lado=768`) }), m.previa.sensivel, m.sensivel_motivo));
    grande.append(h("div", { class: "mut", style: "margin-top:6px" }, "Prévia: " + m.previa.origem));
  } else grande.append(h("div", { class: "ph", style: `background:${corFamilia(m.familia)}` }, ICONE_CAT[m.cat] || "📦"),
    h("div", { class: "mut", style: "margin-top:6px" }, "Sem prévia. Use “Buscar no Civitai”, escolha uma imagem gerada abaixo ou coloque um arquivo .png com o mesmo nome ao lado do modelo."));
  const md = h("div", { class: "modal", onclick: (e) => { if (e.target === md) md.remove(); } },
    h("div", {}, grande, h("div", { style: "flex:1;min-width:0" },
      h("div", { class: "cofre-row" }, h("h3", { style: "margin:0;flex:1;word-break:break-all" }, m.nome), h("button", { class: "btn leve", onclick: () => md.remove() }, "✕")),
      detalheModelo(m, () => { md.remove(); abrirPainel.render(); }))));
  const fechar = (e) => { if (e.key === "Escape") { md.remove(); document.removeEventListener("keydown", fechar); } };
  document.addEventListener("keydown", fechar);
  $(".cofre-win").append(md);
}

function detalheModelo(m, aposMudar) {
  const box = h("div", { class: "det" });
  const refazer = aposMudar || (() => abrirPainel.render());
  const civ = m.civitai ? JSON.parse(m.civitai) : null;
  const blocoCiv = (c) => c.erro ? h("span", { class: "mut" }, c.erro) : h("div", {},
    h("div", {}, h("b", {}, "Civitai: "), `${c.modelo || ""} — ${c.versao || ""} (${c.base || "?"}) `, c.autor ? h("span", { class: "mut" }, "por " + c.autor + " ") : null,
      c.link ? h("a", { href: c.link, target: "_blank", style: "color:#4ea1ff" }, "abrir ↗") : null, c.nsfw ? h("span", { class: "tag er", style: "margin-left:6px" }, "adulto") : null),
    c.nova_versao ? h("div", {}, h("span", { class: "tag ok" }, "⬆️ versão nova"), ` ${c.nova_versao.nome} (${c.nova_versao.base || ""}) `, h("a", { href: c.nova_versao.link, target: "_blank", style: "color:#4ea1ff" }, "ver ↗")) : null,
    c.gatilhos?.length ? h("div", {}, h("b", {}, "Gatilhos: "), c.gatilhos.map((g) => h("span", { class: "tag", style: "cursor:copy", title: "copiar", onclick: () => { navigator.clipboard?.writeText(g); toast("Copiado: " + g); } }, g))) : null,
    c.tags?.length ? h("div", { class: "mut" }, "Tags: " + c.tags.join(", ")) : null,
    c.descricao ? h("details", {}, h("summary", { class: "mut" }, "Descrição"), h("pre", {}, c.descricao)) : null);
  const civEl = h("div", {}, civ ? blocoCiv(civ) : null);
  const moverEl = h("div");
  const comp = m.meta?.componentes;
  const metaSem = Object.fromEntries(Object.entries(m.meta || {}).filter(([k]) => k !== "componentes"));
  const galeria = h("div");
  GET("/cofre/saidas_do_modelo?nome=" + enc(m.nome)).then((ss) => {
    if (!ss.length) return;
    galeria.append(h("h3", {}, `🖼️ Imagens geradas com este modelo (${ss.length}${ss.length >= 24 ? "+" : ""}) — clique para usar como prévia`),
      h("div", { class: "galeria" }, ss.map((s) => h("div", { class: "thumb", title: "Usar como prévia deste modelo", onclick: async () => {
        await POST("/cofre/marcar", { path: m.path, previa: s.path }); toast("Prévia definida", "success"); refazer();
      } }, sens(h("img", { loading: "lazy", src: api.apiURL(`/cofre/miniatura?path=${enc(s.path)}&lado=200`) }), s.sensivel, s.sensivel_motivo)))));
  }).catch(() => {});
  box.append(...[
    h("div", {}, h("b", {}, "Caminho: "), m.path, m.offline ? h("span", { class: "tag av", style: "margin-left:6px" }, "disco desconectado") : null),
    h("table", { style: "margin:6px 0;width:auto" },
      [["Família", m.familia.replace(" (pelo nome)", ""), m.familia_inferida], ["Papel", m.papel, true], ["Precisão", m.precisao, false],
        ["Parâmetros", PAR(m.params), false], ["Integridade", m.integro, false], ["Formato", m.formato, false]]
        .map(([k, v, inf]) => h("tr", {}, h("td", { class: "mut" }, k), h("td", {}, v || "—"), h("td", {}, v && v !== "—" && v !== "?" ? proven(inf) : null)))),
    h("div", { class: "mut" }, `Modificado: ${DATA(m.mtime)}${m.sha256 ? " · SHA256: " + m.sha256.slice(0, 16) + "…" : ""}`),
    comp ? h("div", {}, h("h3", {}, "🧱 Componentes do arquivo"), h("table", { style: "width:auto" }, Object.entries(comp).map(([k, v]) => h("tr", {}, h("td", {}, k), h("td", { class: "num" }, PAR(v)), h("td", {}, proven(false)))))) : null,
    Object.keys(metaSem).length ? h("details", {}, h("summary", {}, "Metadados do arquivo"), h("pre", {}, Object.entries(metaSem).map(([k, v]) => `${k}: ${v}`).join("\n"))) : null,
    h("div", {}, h("b", {}, `Usado em ${m.usado_por.length} workflow(s): `),
      m.usado_por.length ? m.usado_por.map((w) => h("a", { href: "#", style: "color:#4ea1ff;margin-right:10px", onclick: (e) => { e.preventDefault(); abrirWorkflow(w); } }, w)) : h("span", { class: "mut" }, "nenhum")),
    h("div", {}, h("b", {}, "Conteúdo: "), m.sensivel ? h("span", { class: "tag er" }, "🔞 sensível — " + m.sensivel_motivo) : h("span", { class: "tag" }, "não marcado como sensível")),
    civEl, moverEl,
    h("div", { class: "cofre-row", style: "margin-top:8px" },
      h("button", { class: "btn leve", onclick: () => abrirPasta(m.path) }, "📂 Abrir pasta"),
      CFG.civitai === "1" ? h("button", { class: "btn leve", onclick: async (e) => { e.target.disabled = true; e.target.textContent = "Calculando SHA256 e consultando…"; const r = await POST("/cofre/civitai", { path: m.path }); civEl.innerHTML = ""; civEl.append(r.erro && !r.sha256 ? h("span", { class: "tag er" }, r.erro) : blocoCiv(r)); e.target.textContent = "🌐 Consultar Civitai"; e.target.disabled = false; if (r.previa) toast("Prévia baixada do Civitai", "success"); } }, civ ? "🌐 Consultar Civitai de novo" : "🌐 Consultar Civitai") : null,
      h("button", { class: "btn leve", onclick: async () => { await POST("/cofre/marcar", { path: m.path, nsfw: m.sensivel ? 0 : 1 }); toast(m.sensivel ? "Marcado como não sensível" : "Marcado como sensível", "success"); refazer(); } }, m.sensivel ? "✅ Marcar como não sensível" : "🔞 Marcar como sensível"),
      m.previa?.origem === "escolhida por você" ? h("button", { class: "btn leve", onclick: async () => { await POST("/cofre/marcar", { path: m.path, previa: null }); refazer(); } }, "↩️ Remover prévia escolhida") : null,
      h("button", { class: "btn leve", onclick: async () => {
        const ds = await GET("/cofre/destinos?path=" + enc(m.path));
        moverEl.innerHTML = "";
        if (!ds.length) { moverEl.append(h("div", { class: "mut" }, "Não há outra pasta configurada para esta categoria (veja extra_model_paths.yaml).")); return; }
        moverEl.append(h("div", { class: "cofre-row" }, "Mover para: ", ds.map((d) => h("button", { class: "btn", onclick: async () => {
          if (!confirm(`Mover ${m.nome} (${GB(m.tamanho)})\nde: ${m.disco}\npara: ${d.disco} (${d.raiz})?\n\nO ComfyUI continua achando o modelo pelo mesmo nome.`)) return;
          const r = await POST("/cofre/mover", { path: m.path, raiz_destino: d.raiz, confirmar: true });
          if (r.erro) toast(r.erro, "error"); else { toast("Movendo… acompanhe no topo do painel.", "info"); abrirPainel.acompanhar(); }
        } }, `${d.disco} — livre ${GB(d.livre)}`))));
      } }, "🚚 Mover para outro disco"),
      h("button", { class: "btn perigo", onclick: () => lixeira([m.path], refazer) }, "🗑️ Lixeira")),
    galeria].filter((x) => x !== null && x !== undefined && x !== false));
  return box;
}

function lightbox(lista, idx) {
  if (!Array.isArray(lista)) { lista = [lista]; idx = 0; }
  let i = idx || 0;
  const lb = h("div", { class: "lb", onclick: (e) => { if (e.target === lb) fechar(); } });
  const tecla = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); fechar(); }
    else if (e.key === "ArrowRight" && i < lista.length - 1) { i++; desenhar(); }
    else if (e.key === "ArrowLeft" && i > 0) { i--; desenhar(); }
  };
  function fechar() { lb.remove(); document.removeEventListener("keydown", tecla, true); }
  document.addEventListener("keydown", tecla, true);
  function desenhar() {
    const s = lista[i];
    const url = api.apiURL(`/cofre/arquivo?path=${enc(s.path)}`);
    let midia;
    if (s.tipo === "vídeo") midia = h("video", { src: url, controls: true, autoplay: !deveDesfocar(s.sensivel), loop: true });
    else if (s.tipo === "áudio") midia = h("audio", { src: url, controls: true });
    else if (s.tipo === "texto") { midia = h("pre", { class: "txtprev", style: "height:auto;max-height:85vh;overflow:auto;width:100%;font-size:12.5px;user-select:text" }, "Carregando…"); GET("/cofre/texto?path=" + enc(s.path)).then((t) => { midia.textContent = t.binario ? "(arquivo binário — sem prévia)" : t.texto; }); }
    else midia = h("img", { src: url });
    const area = sens(midia, s.sensivel, s.sensivel_motivo);
    area.style.cssText = "max-width:100%;max-height:100%;display:flex;align-items:center;justify-content:center" + (s.tipo === "texto" ? ";width:100%" : "");
    lb.innerHTML = "";
    lb.append(
      h("div", { class: "midia" }, area,
        i > 0 ? h("button", { class: "nav", style: "left:6px", onclick: () => { i--; desenhar(); } }, "‹") : null,
        i < lista.length - 1 ? h("button", { class: "nav", style: "right:6px", onclick: () => { i++; desenhar(); } }, "›") : null),
      h("div", { class: "lado" },
        h("h3", { style: "word-break:break-all" }, s.nome), h("div", { class: "mut" }, `${s.sub === "." ? "(raiz)" : s.sub} · ${DATA(s.mtime)} · ${GB(s.tamanho)}${s.largura ? ` · ${s.largura}×${s.altura}` : ""}`),
        h("div", { class: "mut" }, `${i + 1} de ${lista.length} · use ← → para navegar`),
        s.sensivel ? h("div", { style: "margin-top:6px" }, h("span", { class: "tag er" }, "🔞 " + s.sensivel_motivo)) : null,
        s.prompt && s.tipo !== "texto" ? [h("h3", {}, "Prompt"), h("pre", {}, s.prompt)] : null,
        s.negativo ? [h("h3", {}, "Prompt negativo"), h("pre", { class: "mut" }, s.negativo)] : null,
        h("table", {}, [["Seed", s.seed], ["Passos", s.passos], ["CFG", s.cfg], ["Sampler", s.sampler], ["Modelo", s.modelo]].filter(([, v]) => v).map(([k, v]) => h("tr", {}, h("td", {}, k), h("td", {}, v)))),
        s.modelos_usados?.length ? [h("h3", {}, "Modelos e LoRAs usados"), h("div", {}, s.modelos_usados.map((m) => h("span", { class: "tag", style: "cursor:pointer", title: "ver na aba Modelos", onclick: () => { fechar(); FILTROS.modelos = { q: m.replace(/\.[^.]+$/, "") }; abrirPainel("modelos"); } }, m)))] : null,
        h("div", { class: "cofre-row", style: "margin-top:12px" },
          s.tem_workflow ? h("button", { class: "btn", onclick: () => { fechar(); carregarDaImagem(s.path, s.nome); } }, "🧩 Carregar workflow desta imagem") : (s.tipo === "imagem" ? h("span", { class: "mut" }, "sem workflow embutido") : null),
          s.prompt && s.tipo !== "texto" ? h("button", { class: "btn leve", onclick: () => { navigator.clipboard?.writeText(s.prompt); toast("Prompt copiado"); } }, "📋 Copiar prompt") : null,
          h("button", { class: "btn leve", onclick: async () => { const novo = s.sensivel ? 0 : 1; await POST("/cofre/marcar", { path: s.path, nsfw: novo }); s.sensivel = !!novo; s.sensivel_motivo = "marcado por você"; toast(novo ? "Marcado como sensível" : "Marcado como não sensível", "success"); desenhar(); } }, s.sensivel ? "✅ Não é sensível" : "🔞 Marcar como sensível"),
          h("button", { class: "btn leve", onclick: () => abrirPasta(s.path) }, "📂 Pasta"),
          h("button", { class: "btn perigo", onclick: () => lixeira([s.path], () => { fechar(); abrirPainel.render(); }) }, "🗑️ Lixeira"),
          h("button", { class: "btn leve", onclick: fechar }, "✕ Fechar"))));
  }
  desenhar();
  $(".cofre-win").append(lb);
}

// ------------------------------------------------------------------ aba lateral
app.registerExtension({
  name: "Cofre.Painel",
  async setup() {
    injetarCSS();
    const em = app.extensionManager;
    const renderLateral = async (el) => {
      el.innerHTML = "";
      const box = h("div", { class: "cofre cofre-side" }, h("h3", { style: "margin-top:0" }, "🔐 Cofre"), h("div", { class: "mut" }, "Carregando resumo…"));
      el.append(box);
      try {
        const r = await GET("/cofre/resumo");
        box.innerHTML = "";
        box.append(h("h3", { style: "margin-top:0" }, "🔐 Cofre do ComfyUI"),
          h("button", { class: "btn", onclick: () => abrirPainel("painel") }, "Abrir painel completo"),
          h("div", {}, `🧠 ${r.modelos} modelos · ${GB(r.modelos_bytes)}`),
          h("div", {}, `🧩 ${r.wf_prontos}/${r.workflows} workflows prontos`),
          h("div", {}, `🔌 ${r.nodes} custom nodes${r.nodes_problema ? ` · ⚠️ ${r.nodes_problema}` : ""}`),
          h("div", {}, `🖼️ ${r.saidas} saídas · ${GB(r.saidas_bytes)}`),
          r.duplicados ? h("div", {}, `👯 ${r.duplicados} duplicados (${GB(r.dup_bytes)})`) : null,
          h("h3", {}, "💽 Discos"),
          r.discos.map((d) => h("div", { style: "margin-bottom:6px" }, h("div", {}, `${d.nome} — ${GB(d.livre)} livres`), h("div", { class: "bar" }, h("i", { style: `width:${(100 * d.usado) / d.total}%` })))),
          ...ABAS.slice(1).map(([id, nome]) => h("button", { class: "btn leve", onclick: () => abrirPainel(id) }, nome)));
      } catch (e) { box.append(h("div", { class: "tag er" }, "Erro: " + e.message)); }
    };
    if (em?.registerSidebarTab) {
      em.registerSidebarTab({ id: "cofre", icon: "pi pi-lock", title: "Cofre", tooltip: "Cofre — modelos, workflows, nodes e saídas", type: "custom", render: renderLateral });
    } else {
      document.body.append(h("button", { style: "position:fixed;right:12px;bottom:12px;z-index:1000", onclick: () => abrirPainel() }, "🔐 Cofre"));
    }
    // atalho: Ctrl+Alt+V
    document.addEventListener("keydown", (e) => { if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "v") abrirPainel(); });
  },
});
