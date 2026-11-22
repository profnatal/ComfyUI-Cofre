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
`;
function injetarCSS() { if (!$("#cofre-css")) document.head.append(h("style", { id: "cofre-css" }, CSS)); }

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
  ["saidas", "🖼️ Saídas"], ["limpeza", "🧹 Limpeza"], ["busca", "🔎 Busca"]];

function fecharPainel() { OV?.remove(); OV = null; clearInterval(POLL); document.removeEventListener("keydown", esc); }
function abrirPainel(aba = "painel") {
  injetarCSS(); fecharPainel(); ABA = aba;
  const corpo = h("div", { class: "cofre-body" });
  const prog = h("span", { class: "prog" });
  const tabs = h("div", { class: "cofre-tabs" }, ABAS.map(([id, nome]) => h("button", { "data-id": id, class: id === ABA ? "on" : "", onclick: () => trocar(id) }, nome)));
  const win = h("div", { class: "cofre-win cofre" },
    h("div", { class: "cofre-top" }, h("h2", {}, "🔐 Cofre do ComfyUI"), prog, h("span", { style: "flex:1" }),
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
      const e = await GET("/cofre/estado"); const i = e.indexacao, m = e.movendo;
      let t = "";
      if (i.rodando) t = `Indexando ${i.etapa}: ${i.feito}/${i.total} ${i.msg ? "· " + i.msg.slice(0, 40) : ""}`;
      else if (i.erro) t = "Erro na indexação: " + i.erro;
      else if (i.ultimo) t = "Índice atualizado " + DATA(i.ultimo) + (i.msg ? ` (${i.msg})` : "");
      if (m.ativo) t += ` · Movendo ${m.arquivo}: ${Math.round((100 * m.feito) / Math.max(1, m.total))}%`;
      else if (m.erro) t += " · Erro ao mover: " + m.erro;
      prog.textContent = t;
      if (!i.rodando && !m.ativo) { clearInterval(POLL); if (acompanhar.recarregar) { acompanhar.recarregar = false; render(); } }
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
  render(); acompanhar();
}
function esc(e) { if (e.key === "Escape" && OV && !$(".cofre .lb")) { fecharPainel(); document.removeEventListener("keydown", esc); } }

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
    const F = (FILTROS.modelos = Object.assign({ q: "", cat: "", disco: "", filtro: "", ordem: "tamanho" }, FILTROS.modelos || {}));
    const res = await GET(`/cofre/modelos?q=${enc(F.q)}&cat=${enc(F.cat)}&disco=${enc(F.disco)}&filtro=${enc(F.filtro)}&ordem=${enc(F.ordem)}`);
    const resumo = await GET("/cofre/resumo");
    const cats = [...new Set(resumo.por_categoria.map((c) => c.cat))].sort();
    const discosL = [...new Set(resumo.por_categoria.map((c) => c.disco))];
    const sel = (nome, opts, rot) => h("select", { onchange: (e) => { F[nome] = e.target.value; abrirPainel.render(); } },
      opts.map(([v, t]) => h("option", { value: v, selected: F[nome] === v }, t)));
    const busca = h("input", { placeholder: "Buscar nome, família, gatilho…", value: F.q, style: "width:260px",
      onkeydown: (e) => { if (e.key === "Enter") { F.q = e.target.value; abrirPainel.render(); } } });
    const total = res.reduce((a, m) => a + m.tamanho, 0);
    const tbody = h("tbody");
    for (const m of res) {
      const tr = h("tr", { class: "clic" },
        h("td", {}, h("div", {}, m.nome), h("small", { class: "mut" }, m.rel !== m.nome ? m.rel : "")),
        h("td", {}, m.cat), h("td", {}, h("span", { class: "tag" }, m.familia), h("div", { class: "mut" }, m.papel)),
        h("td", {}, m.precisao), h("td", { class: "num" }, PAR(m.params)), h("td", { class: "num" }, GB(m.tamanho)),
        h("td", {}, m.disco), h("td", { class: "num" }, m.usado_por.length ? h("span", { class: "tag ok" }, m.usado_por.length) : h("span", { class: "tag" }, "0")),
        h("td", {}, h("span", { class: "tag " + (m.integro === "íntegro" || m.integro === "cabeçalho ok" ? "ok" : /truncado|ERRO/.test(m.integro) ? "er" : "") }, m.integro.split(" (")[0].slice(0, 28))));
      let aberto = null;
      tr.onclick = () => { if (aberto) { aberto.remove(); aberto = null; return; } aberto = h("tr", {}, h("td", { colspan: 9 }, detalheModelo(m))); tr.after(aberto); };
      tbody.append(tr);
    }
    return h("div", {},
      h("div", { class: "cofre-row" }, busca,
        sel("cat", [["", "Todas as categorias"], ...cats.map((c) => [c, c])]),
        sel("disco", [["", "Todos os discos"], ...discosL.map((c) => [c, c])]),
        sel("filtro", [["", "Todos"], ["duplicados", "Só duplicados"], ["nao_usados", "Não usados por nenhum workflow"], ["problemas", "Com problema"]]),
        sel("ordem", [["tamanho", "Maior primeiro"], ["nome", "Nome"], ["data", "Mais recentes"], ["familia", "Família"]]),
        h("span", { class: "mut" }, `${res.length} arquivos · ${GB(total)}`)),
      h("table", {}, h("thead", {}, h("tr", {}, ["Arquivo", "Categoria", "Família / papel", "Precisão", "Parâm.", "Tamanho", "Disco", "Usado em", "Integridade"].map((t, i) => h("th", { class: [4, 5, 7].includes(i) ? "num" : "" }, t)))), tbody));
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
    return h("div", {},
      h("div", { class: "mut", style: "margin-bottom:8px" }, "As classes vêm do próprio ComfyUI já carregado — nenhum código é executado pelo Cofre. “Sem nodes carregados” costuma indicar erro de importação (veja o log do ComfyUI) ou pacote que só adiciona interface."),
      h("table", {}, h("tr", {}, ["Pacote", "Situação", "Nodes", "Usado em", "Git", "Tamanho", ""].map((t, i) => h("th", { class: [2, 3, 5].includes(i) ? "num" : "" }, t))),
        res.map((n) => h("tr", {},
          h("td", {}, h("div", {}, n.nome), n.requisitos ? h("details", {}, h("summary", { class: "mut" }, "requisitos"), h("pre", {}, n.requisitos)) : null,
            n.classes.length ? h("details", {}, h("summary", { class: "mut" }, `${n.classes.length} nodes`), h("pre", {}, n.classes.join("\n"))) : null),
          h("td", {}, h("span", { class: "tag " + (n.situacao.includes("⚠️") || n.situacao.startsWith("provável") ? "av" : n.situacao === "ok" ? "ok" : n.situacao === "desativado" || n.situacao.startsWith("só interface") ? "" : "er") }, n.situacao)),
          h("td", { class: "num" }, n.n_classes), h("td", { class: "num" }, n.workflows_que_usam || 0),
          h("td", {}, n.git_url ? h("a", { href: n.git_url.replace(/\.git$/, ""), target: "_blank", style: "color:#4ea1ff" }, n.git_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")) : h("span", { class: "mut" }, "sem git"),
            n.commit_ ? h("div", { class: "mut" }, `${n.branch || ""} @ ${n.commit_}`) : null),
          h("td", { class: "num" }, GB(n.tamanho)),
          h("td", {}, h("button", { class: "btn leve", onclick: () => abrirPasta(n.pasta) }, "📂"))))));
  },

  async saidas() {
    const F = (FILTROS.saidas = Object.assign({ q: "", tipo: "", pagina: 0 }, FILTROS.saidas || {}));
    const r = await GET(`/cofre/saidas?q=${enc(F.q)}&tipo=${enc(F.tipo)}&pagina=${F.pagina}&por_pag=60`);
    const paginas = Math.max(1, Math.ceil(r.total / 60));
    const grid = h("div", { class: "grid" }, r.itens.map((s) => h("div", { class: "thumb", onclick: () => lightbox(s) },
      s.tipo === "áudio" ? h("div", { style: "height:150px;display:flex;align-items:center;justify-content:center;font-size:40px" }, "🔊")
        : h("img", { loading: "lazy", src: api.apiURL(`/cofre/miniatura?path=${enc(s.path)}`), onerror: (e) => (e.target.style.opacity = 0.15) }),
      h("div", {}, s.nome), h("div", { class: "mut" }, `${s.sub} · ${DATA(s.mtime)}`))));
    return h("div", {},
      h("div", { class: "cofre-row" },
        h("input", { placeholder: "Buscar por prompt, seed, modelo, pasta…", value: F.q, style: "width:300px", onkeydown: (e) => { if (e.key === "Enter") { F.q = e.target.value; F.pagina = 0; abrirPainel.render(); } } }),
        h("select", { onchange: (e) => { F.tipo = e.target.value; F.pagina = 0; abrirPainel.render(); } },
          [["", "Tudo"], ["imagem", "Imagens"], ["vídeo", "Vídeos"], ["áudio", "Áudios"]].map(([v, t]) => h("option", { value: v, selected: F.tipo === v }, t))),
        h("span", { class: "mut" }, `${r.total} arquivos`), h("span", { style: "flex:1" }),
        h("button", { class: "btn leve", disabled: F.pagina <= 0, onclick: () => { F.pagina--; abrirPainel.render(); } }, "◀"),
        h("span", {}, `${F.pagina + 1}/${paginas}`),
        h("button", { class: "btn leve", disabled: F.pagina >= paginas - 1, onclick: () => { F.pagina++; abrirPainel.render(); } }, "▶")),
      grid);
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
      h("h3", {}, `💤 Modelos que nenhum workflow usa (maiores primeiro)`),
      h("div", { class: "mut" }, "Atenção: “não usado” considera só os workflows salvos. LoRAs e modelos escolhidos na hora podem aparecer aqui."),
      h("table", {}, r.nao_usados.map((m) => linhaArq(m, false, h("span", { class: "tag" }, m.familia || "")))),
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
      h("h3", {}, `🖼️ Saídas (${r.saidas.length})`), h("div", { class: "grid" }, r.saidas.map((s) => h("div", { class: "thumb", onclick: () => lightbox(s) }, h("img", { loading: "lazy", src: api.apiURL(`/cofre/miniatura?path=${enc(s.path)}`) }), h("div", {}, s.nome)))));
  },
};
const FILTROS = {};

function detalheModelo(m) {
  const box = h("div", { class: "det" });
  const civ = m.civitai ? JSON.parse(m.civitai) : null;
  const civEl = h("div", {}, civ ? (civ.erro ? h("span", { class: "mut" }, civ.erro) : h("span", {}, `Civitai: ${civ.modelo} — ${civ.versao} (${civ.base}) `, civ.link ? h("a", { href: civ.link, target: "_blank", style: "color:#4ea1ff" }, "abrir") : null, civ.gatilhos?.length ? h("div", {}, "Gatilhos: " + civ.gatilhos.join(", ")) : null)) : null);
  const moverEl = h("div");
  box.append(
    h("div", {}, h("b", {}, "Caminho: "), m.path),
    h("div", {}, h("b", {}, "Formato: "), m.formato, " · ", h("b", {}, "Modificado: "), DATA(m.mtime), m.sha256 ? [" · ", h("b", {}, "SHA256: "), m.sha256.slice(0, 16) + "…"] : null),
    Object.keys(m.meta || {}).length ? h("div", {}, h("b", {}, "Metadados: "), h("pre", {}, Object.entries(m.meta).map(([k, v]) => `${k}: ${v}`).join("\n"))) : null,
    h("div", {}, h("b", {}, `Usado em ${m.usado_por.length} workflow(s): `),
      m.usado_por.length ? m.usado_por.map((w) => h("a", { href: "#", style: "color:#4ea1ff;margin-right:10px", onclick: (e) => { e.preventDefault(); abrirWorkflow(w); } }, w)) : h("span", { class: "mut" }, "nenhum")),
    civEl, moverEl,
    h("div", { class: "cofre-row", style: "margin-top:8px" },
      h("button", { class: "btn leve", onclick: () => abrirPasta(m.path) }, "📂 Abrir pasta"),
      h("button", { class: "btn leve", onclick: async (e) => { e.target.disabled = true; e.target.textContent = "Calculando SHA256…"; const r = await POST("/cofre/civitai", { path: m.path }); civEl.innerHTML = ""; civEl.append(r.erro ? h("span", { class: "tag er" }, r.erro) : h("span", {}, r.modelo ? `Civitai: ${r.modelo} — ${r.versao} (${r.base})` : "", r.link ? [" ", h("a", { href: r.link, target: "_blank", style: "color:#4ea1ff" }, "abrir")] : null, r.gatilhos?.length ? h("div", {}, "Gatilhos: " + r.gatilhos.join(", ")) : null, h("div", { class: "mut" }, "SHA256: " + r.sha256))); e.target.textContent = "🌐 Consultar Civitai"; e.target.disabled = false; } }, "🌐 Consultar Civitai"),
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
      h("button", { class: "btn perigo", onclick: () => lixeira([m.path], () => abrirPainel.render()) }, "🗑️ Lixeira")));
  return box;
}

function lightbox(s) {
  const url = api.apiURL(`/cofre/arquivo?path=${enc(s.path)}`);
  const midia = s.tipo === "vídeo" ? h("video", { src: url, controls: true, autoplay: true }) : s.tipo === "áudio" ? h("audio", { src: url, controls: true, autoplay: true }) : h("img", { src: url });
  const lb = h("div", { class: "lb", onclick: (e) => { if (e.target === lb) lb.remove(); } },
    h("div", { class: "midia" }, midia),
    h("div", { class: "lado" },
      h("h3", {}, s.nome), h("div", { class: "mut" }, `${s.sub} · ${DATA(s.mtime)} · ${GB(s.tamanho)}${s.largura ? ` · ${s.largura}×${s.altura}` : ""}`),
      s.prompt ? [h("h3", {}, "Prompt"), h("pre", {}, s.prompt)] : null,
      h("table", {}, [["Seed", s.seed], ["Passos", s.passos], ["CFG", s.cfg], ["Sampler", s.sampler], ["Modelo", s.modelo]].filter(([, v]) => v).map(([k, v]) => h("tr", {}, h("td", {}, k), h("td", {}, v)))),
      h("div", { class: "cofre-row", style: "margin-top:12px" },
        s.tem_workflow ? h("button", { class: "btn", onclick: () => { lb.remove(); carregarDaImagem(s.path, s.nome); } }, "🧩 Carregar workflow desta imagem") : h("span", { class: "mut" }, "sem workflow embutido"),
        s.prompt ? h("button", { class: "btn leve", onclick: () => { navigator.clipboard?.writeText(s.prompt); toast("Prompt copiado"); } }, "📋 Copiar prompt") : null,
        h("button", { class: "btn leve", onclick: () => abrirPasta(s.path) }, "📂 Pasta"),
        h("button", { class: "btn perigo", onclick: () => lixeira([s.path], () => { lb.remove(); abrirPainel.render(); }) }, "🗑️ Lixeira"),
        h("button", { class: "btn leve", onclick: () => lb.remove() }, "✕ Fechar"))));
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
