# -*- coding: utf-8 -*-
"""Cofre do ComfyUI — núcleo de indexação (Linux).

Tudo roda localmente. Cabeçalhos são lidos sem carregar tensores; código de custom nodes não é executado
(as classes registradas vêm do próprio ComfyUI já carregado). Exclusões vão para a Lixeira do sistema
(padrão freedesktop: ~/.local/share/Trash ou <disco>/.Trash-<uid>), podendo ser restauradas pelo Nautilus.
"""
import os, re, json, time, struct, hashlib, sqlite3, threading, difflib, shutil, subprocess, sys, glob, urllib.parse
from collections import defaultdict, Counter

import folder_paths

BASE = os.path.join(folder_paths.get_user_directory(), "cofre")
THUMBS = os.path.join(BASE, "thumbs")
DB_PATH = os.path.join(BASE, "cofre.db")
os.makedirs(THUMBS, exist_ok=True)

EXT_MODELO = (".safetensors", ".gguf", ".ckpt", ".pt", ".pth", ".bin", ".onnx", ".sft", ".pt2")
EXT_IMG = (".png", ".jpg", ".jpeg", ".webp")
EXT_VID = (".mp4", ".webm", ".mov", ".gif", ".mkv")
EXT_AUD = (".wav", ".mp3", ".flac", ".ogg", ".m4a")
EXT_TXT = (".txt", ".json", ".md")
PREVIAS = os.path.join(BASE, "previas")
os.makedirs(PREVIAS, exist_ok=True)
RE_EXT = re.compile(r"\.(safetensors|gguf|ckpt|pt|pth|bin|onnx|sft)$", re.I)
IGNORAR_CATS = {"custom_nodes", "configs", "classifiers"}

FRONT = {"Note", "MarkdownNote", "Reroute", "PrimitiveNode", "PrimitiveString", "PrimitiveInt", "PrimitiveFloat",
         "PrimitiveBoolean", "Comment", "GetNode", "SetNode", "easy getNode", "easy setNode", "Image To Mask"}
FRONT_RE = re.compile(r"\(rgthree\)$|^workflow[>/]|^[0-9a-f\-]{36}$")

ESTADO = {"rodando": False, "etapa": "", "feito": 0, "total": 0, "ultimo": None, "erro": None, "msg": ""}
_lock = threading.Lock()


# ============================================================================ banco
def db():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c

def criar_tabelas():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS modelos(path TEXT PRIMARY KEY, nome TEXT, cat TEXT, rel TEXT, raiz TEXT, disco TEXT,
            tamanho INTEGER, mtime REAL, impressao TEXT, sha256 TEXT, formato TEXT, familia TEXT, papel TEXT,
            precisao TEXT, params INTEGER, integro TEXT, meta TEXT, civitai TEXT);
        CREATE TABLE IF NOT EXISTS workflows(path TEXT PRIMARY KEY, nome TEXT, pasta TEXT, mtime REAL, tamanho INTEGER,
            n_nodes INTEGER, tipos TEXT, modelos TEXT, faltam_nodes TEXT, faltam_modelos TEXT, sugestoes TEXT,
            familias TEXT, status TEXT, erro TEXT);
        CREATE TABLE IF NOT EXISTS nodes(pasta TEXT PRIMARY KEY, nome TEXT, ativo INTEGER, git_url TEXT, branch TEXT,
            commit_ TEXT, n_classes INTEGER, classes TEXT, requisitos TEXT, tamanho INTEGER, mtime REAL, situacao TEXT);
        CREATE TABLE IF NOT EXISTS saidas(path TEXT PRIMARY KEY, nome TEXT, sub TEXT, tipo TEXT, tamanho INTEGER,
            mtime REAL, largura INTEGER, altura INTEGER, prompt TEXT, seed TEXT, passos TEXT, cfg TEXT,
            sampler TEXT, modelo TEXT, tem_workflow INTEGER);
        CREATE TABLE IF NOT EXISTS log(quando REAL, acao TEXT, detalhe TEXT);
        CREATE TABLE IF NOT EXISTS config(k TEXT PRIMARY KEY, v TEXT);
        CREATE TABLE IF NOT EXISTS marcas(path TEXT PRIMARY KEY, nsfw INTEGER, previa TEXT);
        CREATE TABLE IF NOT EXISTS atualizacoes(pasta TEXT PRIMARY KEY, remoto TEXT, situacao TEXT, quando REAL);
        """)
        novas = {"modelos": [("offline", "INTEGER DEFAULT 0")],
                 "saidas": [("negativo", "TEXT"), ("modelos_usados", "TEXT")]}
        for t, cols in novas.items():
            tem = {r[1] for r in c.execute(f"PRAGMA table_info({t})")}
            for nome, tipo in cols:
                if nome not in tem:
                    c.execute(f"ALTER TABLE {t} ADD COLUMN {nome} {tipo}")

criar_tabelas()


# ============================================================================ configurações
NSFW_PADRAO = ("nsfw, nude, nudity, naked, topless, nipple, nipples, areola, breasts, explicit, porn, porno, pornographic, "
               "hentai, sex, sexual, erotic, erotica, uncensored, xxx, genitals, pussy, vagina, penis, cum, bdsm, fetish, "
               "lingerie, nua, nuas, nu frontal, pelada, peladas, seios, mamilos, erótico, erótica")
CONFIG_PADRAO = {"nsfw_desfocar": "1", "nsfw_palavras": NSFW_PADRAO, "nsfw_nomes_modelos": "1", "civitai": "1"}

_CFG = None
def config_ler():
    global _CFG
    if _CFG is None:
        with db() as c:
            d = {r["k"]: r["v"] for r in c.execute("SELECT k,v FROM config")}
        _CFG = {k: d.get(k, v) for k, v in CONFIG_PADRAO.items()}
    return dict(_CFG)

def config_gravar(novos):
    with db() as c:
        for k, v in (novos or {}).items():
            if k in CONFIG_PADRAO:
                c.execute("INSERT OR REPLACE INTO config VALUES(?,?)", (k, str(v)))
    registrar("configuração", {k: v for k, v in (novos or {}).items() if k in CONFIG_PADRAO and k != "nsfw_palavras"})
    global _RX_CACHE, _CFG
    _RX_CACHE = None; _CFG = None
    return config_ler()

_RX_CACHE = None
def _rx_nsfw():
    """Regex das palavras sensíveis (configurável). Palavras curtas exigem palavra inteira."""
    global _RX_CACHE
    if _RX_CACHE is None:
        ps = [p.strip().lower() for p in config_ler()["nsfw_palavras"].split(",") if p.strip()]
        partes = [(r"(?<![a-z0-9])" + re.escape(p) + (r"[a-zà-ú]*" if len(p) >= 5 else r"(?![a-z0-9])")) for p in ps]
        _RX_CACHE = re.compile("|".join(partes), re.I) if partes else None
    return _RX_CACHE

def termo_sensivel(texto):
    rx = _rx_nsfw()
    if not rx or not texto:
        return None
    m = rx.search(str(texto).replace("_", " ").replace("-", " "))
    return m.group(0) if m else None

def _marcas():
    with db() as c:
        return {r["path"]: dict(r) for r in c.execute("SELECT * FROM marcas")}

def marcar(path, nsfw="manter", previa="manter"):
    with db() as c:
        r = c.execute("SELECT nsfw, previa FROM marcas WHERE path=?", (path,)).fetchone()
        n0, p0 = (r["nsfw"], r["previa"]) if r else (None, None)
        n1 = n0 if nsfw == "manter" else nsfw
        p1 = p0 if previa == "manter" else previa
        if n1 is None and not p1:
            c.execute("DELETE FROM marcas WHERE path=?", (path,))
        else:
            c.execute("INSERT OR REPLACE INTO marcas VALUES(?,?,?)", (path, n1, p1))
    registrar("marcação", dict(path=path, nsfw=nsfw, previa=previa))
    return True

def registrar(acao, detalhe):
    with db() as c:
        c.execute("INSERT INTO log VALUES(?,?,?)", (time.time(), acao, json.dumps(detalhe, ensure_ascii=False)[:4000]))


# ============================================================================ discos (Linux)
def _montagens():
    out = []
    try:
        with open("/proc/mounts") as f:
            for l in f:
                p = l.split()
                if len(p) >= 3:
                    out.append((p[1].replace("\\040", " "), p[0], p[2]))
    except Exception:
        out.append(("/", "?", "?"))
    rotulos = {}
    try:
        for r in os.listdir("/dev/disk/by-label"):
            rotulos[os.path.realpath(os.path.join("/dev/disk/by-label", r))] = r.replace("\\x20", " ")
    except Exception:
        pass
    return sorted(out, key=lambda x: -len(x[0])), rotulos

_MONT = None
def disco_de(path):
    global _MONT
    if _MONT is None:
        _MONT = _montagens()
    mont, rot = _MONT
    rp = os.path.realpath(path)
    for mp, dev, fs in mont:
        if rp == mp or rp.startswith(mp.rstrip("/") + "/"):
            nome = rot.get(os.path.realpath(dev)) or ("Sistema (/)" if mp == "/" else os.path.basename(mp) or mp)
            if mp.startswith("/home") and nome == os.path.basename(mp):
                nome = "home"
            return mp, nome
    return "/", "Sistema (/)"

def discos():
    vistos = {}
    for cat, dirs in _raizes_modelos().items():
        for d in dirs:
            mp, nome = disco_de(d)
            vistos[mp] = nome
    for d in (folder_paths.get_output_directory(), folder_paths.base_path):
        mp, nome = disco_de(d); vistos[mp] = nome
    out = []
    for mp, nome in vistos.items():
        try:
            u = shutil.disk_usage(mp)
            out.append(dict(ponto=mp, nome=nome, total=u.total, usado=u.used, livre=u.free))
        except Exception:
            pass
    return out


# ============================================================================ modelos
def _raizes_modelos():
    r = {}
    for cat, (dirs, _ext) in folder_paths.folder_names_and_paths.items():
        if cat in IGNORAR_CATS:
            continue
        ds = [d for d in dirs if os.path.isdir(d)]
        if ds:
            r[cat] = ds
    return r

def _impressao(path, tamanho):
    """Impressão digital rápida para achar duplicados: tamanho + SHA1 de 1 MB do início, meio e fim."""
    h = hashlib.sha1(str(tamanho).encode())
    try:
        with open(path, "rb") as f:
            for pos in (0, max(0, tamanho // 2 - 524288), max(0, tamanho - 1048576)):
                f.seek(pos); h.update(f.read(1048576))
    except Exception:
        return None
    return h.hexdigest()

def sha256_arquivo(path, prog=None):
    h = hashlib.sha256()
    tot = os.path.getsize(path); feito = 0
    with open(path, "rb") as f:
        while True:
            b = f.read(16 * 1024 * 1024)
            if not b:
                break
            h.update(b); feito += len(b)
            if prog:
                prog(feito, tot)
    return h.hexdigest()

DT_BYTES = {"F64": 8, "F32": 4, "F16": 2, "BF16": 2, "I64": 8, "I32": 4, "I16": 2, "I8": 1, "U8": 1, "BOOL": 1,
            "F8_E4M3": 1, "F8_E5M2": 1, "F8_E4M3FN": 1, "F8_E5M2FNUZ": 1, "F8_E4M3FNUZ": 1, "U32": 4, "U16": 2}

def _familia_por_chaves(keys, meta):
    k = " ".join(list(keys)[:4000])
    has = lambda s: s in k
    lora = any(x in k for x in ("lora_down", "lora_up", "lora_A", "lora_B", ".alpha", "lokr_", "hada_"))
    fam = None
    base = (meta or {}).get("ss_base_model_version") or (meta or {}).get("modelspec.architecture") or ""
    b = base.lower()
    if "flux" in b: fam = "Flux 2" if ("flux2" in b or "flux.2" in b or "klein" in b) else "Flux 1"
    elif "sdxl" in b or "xl" in b: fam = "SDXL"
    elif "sd_v1" in b or "sd1" in b or "v1" in b: fam = "SD 1.5"
    elif "qwen" in b: fam = "Qwen-Image"
    if not fam:
        if has("double_blocks") and has("single_blocks"):
            fam = "Flux 2" if (has("double_stream_modulation") or has("single_stream_modulation")) else "Flux 1"
        elif has("double_stream_modulation"):
            fam = "Flux 2"
        elif has("joint_blocks"):
            fam = "SD3"
        elif has("single_transformer_blocks") or (has("transformer_blocks") and has("context_embedder")):
            fam = "Flux (diffusers)"
        elif has("img_mlp") and has("txt_mlp"):
            fam = "Qwen-Image"
        elif has("cap_embedder") or has("context_refiner") or has("noise_refiner") or \
                (has("layers.0.attention") and (has("adaLN_modulation") or has("feed_forward"))) or has("layers_0_attention"):
            fam = "Z-Image / Lumina2"
        elif has("img_mod") and has("txt_mod"):
            fam = "Qwen-Image"
        elif (has("blocks.0.cross_attn") or has("blocks_0_cross_attn")) and (has("patch_embedding") or has("head.modulation") or lora):
            fam = "WAN"
        elif has("label_emb") or has("conditioner.embedders.1") or has("add_embedding"):
            fam = "SDXL"
        elif has("input_blocks") or has("lora_unet_down_blocks") or has("lora_unet_input_blocks"):
            fam = "SD 1.5" if not has("input_blocks_8") else "SDXL"
        elif has("lora_te2_") or has("lora_te1_"):
            fam = "SDXL"
        elif has("decoder.conv_in") and has("encoder.conv_in"):
            fam = "VAE"
        elif has("embed_tokens") and has("layers."):
            fam = "LLM (Qwen/Llama/Gemma)"
        elif has("encoder.block.0") or has("shared.weight"):
            fam = "T5"
        elif has("text_model.encoder") or has("text_projection"):
            fam = "CLIP"
        elif has("visual.") or has("vision_model"):
            fam = "Visão (CLIP-Vision/SigLIP)"
    return fam or "?", lora

COMPONENTES = [("model.diffusion_model.", "difusão (UNet/DiT)"), ("first_stage_model.", "VAE"), ("vae.", "VAE"),
               ("conditioner.embedders.0.", "codificador de texto 1"), ("conditioner.embedders.1.", "codificador de texto 2"),
               ("cond_stage_model.", "codificador de texto"), ("text_encoders.", "codificadores de texto"),
               ("model_ema.", "EMA"), ("control_model.", "ControlNet")]

def ler_safetensors(path, tamanho):
    with open(path, "rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        if n <= 0 or n > 200_000_000:
            raise ValueError("cabeçalho inválido")
        h = json.loads(f.read(n))
    meta = h.pop("__metadata__", {}) or {}
    dts = Counter(); params = 0; fim = 0; comp = Counter()
    for nome, t in h.items():
        if not isinstance(t, dict):
            continue
        dt = t.get("dtype", "?"); shape = t.get("shape", [])
        cnt = 1
        for s in shape: cnt *= s
        params += cnt; dts[dt] += cnt
        for pref, rot in COMPONENTES:
            if nome.startswith(pref):
                comp[rot] += cnt; break
        fim = max(fim, (t.get("data_offsets") or [0, 0])[1])
    integro = "íntegro" if 8 + n + fim == tamanho else ("truncado" if 8 + n + fim > tamanho else "sobra no fim")
    fam, lora = _familia_por_chaves(h.keys(), meta)
    prec = "/".join(d for d, _ in dts.most_common(2))
    extra = {}
    for kk in ("ss_base_model_version", "ss_network_dim", "ss_network_alpha", "ss_output_name", "modelspec.title",
               "modelspec.architecture", "ss_training_comment", "format"):
        if kk in meta: extra[kk] = str(meta[kk])[:300]
    if "ss_tag_frequency" in meta:
        try:
            tf = json.loads(meta["ss_tag_frequency"]); tags = Counter()
            for d in tf.values(): tags.update(d)
            extra["gatilhos (tags de treino)"] = ", ".join(t for t, _ in tags.most_common(12))
        except Exception:
            pass
    if len(comp) > 1:
        extra["componentes"] = {k: v for k, v in comp.most_common()}
    if any(k.endswith(".scale_weight") or "comfy_quant" in k or k.endswith("weight_scale") for k in list(h)[:3000]):
        prec += " (quantizado/escala)"
    return dict(formato="safetensors", familia=fam, lora=lora, precisao=prec, params=params, integro=integro, meta=extra)

GG_TIPOS = {0: "F32", 1: "F16", 2: "Q4_0", 3: "Q4_1", 6: "Q5_0", 7: "Q5_1", 8: "Q8_0", 9: "Q8_1", 10: "Q2_K", 11: "Q3_K",
            12: "Q4_K", 13: "Q5_K", 14: "Q6_K", 15: "Q8_K", 16: "IQ2_XXS", 17: "IQ2_XS", 18: "IQ3_XXS", 19: "IQ1_S",
            20: "IQ4_NL", 21: "IQ3_S", 22: "IQ2_S", 23: "IQ4_XS", 24: "I8", 25: "I16", 26: "I32", 27: "I64",
            28: "F64", 29: "IQ1_M", 30: "BF16"}

def ler_gguf(path, tamanho):
    with open(path, "rb") as f:
        if f.read(4) != b"GGUF":
            raise ValueError("não é GGUF")
        ver = struct.unpack("<I", f.read(4))[0]
        nt, nkv = struct.unpack("<QQ", f.read(16))
        def rstr():
            l = struct.unpack("<Q", f.read(8))[0]; return f.read(l).decode("utf-8", "replace")
        FMT = {0: "<B", 1: "<b", 2: "<H", 3: "<h", 4: "<I", 5: "<i", 6: "<f", 7: "<?", 10: "<Q", 11: "<q", 12: "<d"}
        def rval(t):
            if t in FMT:
                s = struct.calcsize(FMT[t]); return struct.unpack(FMT[t], f.read(s))[0]
            if t == 8: return rstr()
            if t == 9:
                at = struct.unpack("<I", f.read(4))[0]; n = struct.unpack("<Q", f.read(8))[0]
                if at in FMT:
                    f.seek(struct.calcsize(FMT[at]) * n, 1); return f"[{n} itens]"
                vals = [rval(at) for _ in range(min(n, 50))]
                for _ in range(n - min(n, 50)): rval(at)
                return vals if n <= 50 else f"[{n} itens]"
            raise ValueError("tipo GGUF desconhecido")
        kv = {}
        for _ in range(nkv):
            k = rstr(); t = struct.unpack("<I", f.read(4))[0]; kv[k] = rval(t)
        tipos = Counter(); params = 0; nomes = []
        for _ in range(nt):
            nome = rstr(); nd = struct.unpack("<I", f.read(4))[0]
            dims = struct.unpack("<" + "Q" * nd, f.read(8 * nd)); tp = struct.unpack("<I", f.read(4))[0]; f.read(8)
            c = 1
            for d in dims: c *= d
            params += c; tipos[GG_TIPOS.get(tp, str(tp))] += c
            if len(nomes) < 3000: nomes.append(nome)
    arch = str(kv.get("general.architecture", ""))
    fam, lora = _familia_por_chaves(nomes, {})
    if arch and fam == "?":
        fam = arch
    q = [t for t, _ in tipos.most_common() if t not in ("F32",)][:2]
    extra = {k: str(v)[:200] for k, v in kv.items() if k.startswith("general.") and not isinstance(v, list)}
    return dict(formato=f"GGUF v{ver}", familia=fam if fam != "?" else (arch or "?"), lora=lora,
                precisao="/".join(q) or "F32", params=params, integro="cabeçalho ok", meta=extra)

ARCH_GGUF = {"flux": "Flux", "sdxl": "SDXL", "sd1": "SD 1.5", "sd3": "SD3", "lumina2": "Z-Image / Lumina2", "zimage": "Z-Image / Lumina2",
             "qwen_image": "Qwen-Image", "qwen_image21": "Qwen-Image", "wan": "WAN", "chroma": "Chroma", "hidream": "HiDream",
             "ltxv": "LTX-Video", "hyvid": "HunyuanVideo", "seedvr": "SeedVR2", "moss_image": "MOSS-Image", "krea2": "Krea 2",
             "t5encoder": "T5", "t5": "T5", "umt5": "T5", "qwen2": "LLM (Qwen/Llama/Gemma)", "qwen3": "LLM (Qwen/Llama/Gemma)",
             "qwen35": "LLM (Qwen/Llama/Gemma)", "qwen3vl": "LLM visão (Qwen-VL)", "qwen2vl": "LLM visão (Qwen-VL)",
             "llama": "LLM (Qwen/Llama/Gemma)", "gemma3": "LLM (Qwen/Llama/Gemma)", "ideogram4": "Ideogram 4", "fibo": "FIBO"}
NOME_FAM = [(r"qwen.?image|qwen_image", "Qwen-Image"), (r"klein|flux.?2", "Flux 2"), (r"kontext|flux|schnell", "Flux 1"),
            (r"krea", "Krea 2"), (r"ideogram", "Ideogram 4"), (r"z.?image|zit|lumina", "Z-Image / Lumina2"),
            (r"\bwan|wan2", "WAN"), (r"moss", "MOSS-Image"), (r"chroma", "Chroma"), (r"fibo", "FIBO"), (r"hidream", "HiDream"),
            (r"ltx", "LTX-Video"), (r"hunyuan", "HunyuanVideo"), (r"illustrious|noob|pony|sdxl|_xl|xl_|juggernaut", "SDXL"),
            (r"sd15|sd_15|v1-5|sd1", "SD 1.5"), (r"seedvr", "SeedVR2"), (r"ernie", "ERNIE-Image"), (r"boogu", "Boogu"),
            (r"anima", "Anima"), (r"cascade|stage_[abc]", "Stable Cascade")]
CAT_FAM = {"upscale_models": "Upscaler", "sams": "SAM", "vae_approx": "TAESD (prévia)", "facerestore_models": "Restauração de rosto",
           "embeddings": "Embedding", "ultralytics_bbox": "YOLO", "ultralytics_segm": "YOLO", "ultralytics": "YOLO",
           "insightface": "InsightFace", "ipadapter": "IP-Adapter", "photomaker": "PhotoMaker", "style_models": "Style model"}

PAPEL_CAT = {"checkpoints": "checkpoint", "diffusion_models": "modelo de difusão", "unet": "modelo de difusão",
             "unet_gguf": "modelo de difusão (GGUF)", "loras": "LoRA", "vae": "VAE", "text_encoders": "codificador de texto",
             "clip": "codificador de texto", "clip_gguf": "codificador de texto (GGUF)", "clip_vision": "visão (CLIP-Vision)",
             "controlnet": "ControlNet", "upscale_models": "upscaler", "embeddings": "embedding", "style_models": "style model",
             "ultralytics_bbox": "detector (bbox)", "ultralytics_segm": "detector (segm)", "sams": "SAM", "ipadapter": "IP-Adapter",
             "LLM": "LLM / visão", "vae_approx": "prévia (TAESD)", "photomaker": "PhotoMaker", "insightface": "InsightFace"}

def analisar_modelo(path, cat, tamanho):
    ext = os.path.splitext(path)[1].lower()
    r = dict(formato=ext.lstrip("."), familia="?", lora=False, precisao="?", params=None, integro="não verificado", meta={})
    try:
        if ext in (".safetensors", ".sft"):
            r = ler_safetensors(path, tamanho)
        elif ext == ".gguf":
            r = ler_gguf(path, tamanho)
        elif ext in (".pt", ".pth", ".ckpt", ".bin"):
            with open(path, "rb") as f:
                ini = f.read(4)
            r["formato"] = ext.lstrip(".") + (" (zip/pytorch)" if ini.startswith(b"PK") else " (pickle)")
            r["integro"] = "formato antigo — não inspecionado (pickle pode executar código)"
    except Exception as e:
        r["integro"] = f"ERRO ao ler: {str(e)[:80]}"
    fam = r.get("familia") or "?"
    fam = ARCH_GGUF.get(str(fam).lower(), fam)
    if fam == "?":
        nm = os.path.basename(path).lower()
        if cat in CAT_FAM:
            fam = CAT_FAM[cat]
        else:
            for rx, f in NOME_FAM:
                if re.search(rx, nm):
                    fam = f + " (pelo nome)"; break
    r["familia"] = fam
    papel = PAPEL_CAT.get(cat, cat)
    if r.get("lora") and cat not in ("loras",):
        papel += " (parece LoRA)"
    if cat == "loras" and r.get("formato") == "safetensors" and not r.get("lora") and (r.get("params") or 0) > 500_000_000:
        papel = "⚠️ modelo completo na pasta de LoRAs?"
    r["papel"] = papel
    return r

VERSAO_ANALISE = "4"

def indexar_modelos(prog=None):
    raizes = _raizes_modelos()
    arquivos = []
    for cat, dirs in raizes.items():
        for d in dirs:
            for raiz, subdirs, fs in os.walk(d, followlinks=True):
                subdirs[:] = [s for s in subdirs if not s.startswith(".")]
                for fn in fs:
                    if fn.lower().endswith(EXT_MODELO):
                        p = os.path.join(raiz, fn)
                        arquivos.append((cat, d, p))
    vistos = set(); inodes = set()
    with db() as c:
        antigos = {r["path"]: (r["tamanho"], r["mtime"]) for r in c.execute("SELECT path,tamanho,mtime FROM modelos")}
        v = c.execute("SELECT v FROM config WHERE k='versao_analise'").fetchone()
        reanalisar = (v is None or v[0] != VERSAO_ANALISE)
        c.execute("INSERT OR REPLACE INTO config VALUES('versao_analise',?)", (VERSAO_ANALISE,))
    total = len(arquivos)
    for i, (cat, d, p) in enumerate(arquivos):
        if prog: prog(i, total, os.path.basename(p))
        try:
            st = os.stat(p)
        except Exception:
            continue
        chave = (st.st_dev, st.st_ino)
        if p in vistos or chave in inodes:
            continue
        vistos.add(p); inodes.add(chave)
        if not reanalisar and antigos.get(p) == (st.st_size, st.st_mtime):
            continue
        a = analisar_modelo(p, cat, st.st_size)
        imp = _impressao(p, st.st_size) if (reanalisar is False or antigos.get(p) != (st.st_size, st.st_mtime)) else None
        if imp is None:
            with db() as c:
                rr = c.execute("SELECT impressao FROM modelos WHERE path=?", (p,)).fetchone()
            imp = rr[0] if rr and rr[0] else _impressao(p, st.st_size)
        mp, nome_disco = disco_de(p)
        with db() as c:
            c.execute("INSERT OR REPLACE INTO modelos(path,nome,cat,rel,raiz,disco,tamanho,mtime,impressao,sha256,formato,familia,papel,precisao,params,integro,meta,civitai) "
                      "VALUES(?,?,?,?,?,?,?,?,?,(SELECT sha256 FROM modelos WHERE path=?),?,?,?,?,?,?,?,(SELECT civitai FROM modelos WHERE path=?))",
                      (p, os.path.basename(p), cat, os.path.relpath(p, d), d, nome_disco, st.st_size, st.st_mtime, imp, p,
                       a["formato"], a["familia"], a["papel"], a["precisao"], a["params"], a["integro"],
                       json.dumps(a["meta"], ensure_ascii=False), p))
    with db() as c:
        raizes_antigas = {r["path"]: r["raiz"] for r in c.execute("SELECT path, raiz FROM modelos")}
        for p in set(antigos) - vistos:
            raiz = raizes_antigas.get(p) or ""
            if raiz and not os.path.isdir(raiz):
                c.execute("UPDATE modelos SET offline=1 WHERE path=?", (p,))   # disco desconectado: mantém no índice
            else:
                c.execute("DELETE FROM modelos WHERE path=?", (p,))
        for p in vistos:
            c.execute("UPDATE modelos SET offline=0 WHERE path=? AND offline=1", (p,))
    return total


# ============================================================================ custom nodes
def _git_info(d):
    g = os.path.join(d, ".git")
    if os.path.isfile(g):  # worktree/submódulo
        try:
            g = os.path.join(d, open(g).read().split(":", 1)[1].strip())
        except Exception:
            return None, None, None
    if not os.path.isdir(g):
        return None, None, None
    url = branch = commit = None
    try:
        cfg = open(os.path.join(g, "config"), encoding="utf-8", errors="replace").read()
        m = re.search(r'\[remote "origin"\][^\[]*?url\s*=\s*(\S+)', cfg)
        url = m.group(1) if m else None
    except Exception:
        pass
    try:
        head = open(os.path.join(g, "HEAD")).read().strip()
        if head.startswith("ref:"):
            ref = head[4:].strip(); branch = ref.split("/")[-1]
            rp = os.path.join(g, ref)
            if os.path.exists(rp):
                commit = open(rp).read().strip()
            else:
                pk = os.path.join(g, "packed-refs")
                if os.path.exists(pk):
                    for l in open(pk):
                        if l.strip().endswith(ref): commit = l.split()[0]
        else:
            commit = head; branch = "(destacado)"
    except Exception:
        pass
    return url, branch, (commit or "")[:10]

def _tamanho_pasta(d, limite=200000):
    t = 0; n = 0
    for raiz, subs, fs in os.walk(d):
        subs[:] = [s for s in subs if s not in (".git", "__pycache__")]
        for f in fs:
            try: t += os.path.getsize(os.path.join(raiz, f))
            except Exception: pass
            n += 1
            if n > limite: return t
    return t

def _falhas_import():
    falhas = set()
    try:
        from app.logger import get_logs
        for e in list(get_logs() or []):
            m = e.get("m", "") if isinstance(e, dict) else str(e)
            if "IMPORT FAILED" in m:
                falhas.add(os.path.realpath(m.split("):", 1)[-1].strip()))
    except Exception:
        pass
    return falhas

def _norm_pacote(nome):
    n = nome.lower().replace(".disabled", "")
    n = re.sub(r"^(comfyui|comfy)[-_ ]?|[-_ ]?(comfyui|comfy)$", "", n)
    return re.sub(r"[^a-z0-9]", "", n)

def indexar_nodes(prog=None):
    import nodes as cnodes
    cn_dirs = folder_paths.get_folder_paths("custom_nodes")
    falhas = _falhas_import()
    web_dirs = list(getattr(cnodes, "EXTENSION_WEB_DIRS", {}).values())
    linhas = []
    pastas = []
    for base in cn_dirs:
        for nome in sorted(os.listdir(base)):
            d = os.path.join(base, nome)
            if os.path.isdir(d) and not nome.startswith((".", "__")):
                pastas.append(d)
    reais = sorted(((os.path.realpath(d) + os.sep, os.path.basename(d)) for d in pastas), key=lambda x: -len(x[0]))
    def pacote_do_arquivo(arq):
        ra = os.path.realpath(arq) if arq else ""
        for pref, nome in reais:
            if ra.startswith(pref):
                return nome
        return None
    por_pacote = defaultdict(list); alheios = Counter()
    for nome_cls, cls in cnodes.NODE_CLASS_MAPPINGS.items():
        mod = sys.modules.get(getattr(cls, "__module__", ""), None)
        fp = pacote_do_arquivo(getattr(mod, "__file__", "") or "")
        rel = getattr(cls, "RELATIVE_PYTHON_MODULE", "") or ""
        rp = rel.split(".", 1)[1] if rel.startswith("custom_nodes.") else None
        dono = fp or rp
        if dono:
            por_pacote[dono].append(nome_cls)
        if rp and fp and rp != fp:
            alheios[rp] += 1
    for i, d in enumerate(pastas):
        if prog: prog(i, len(pastas), os.path.basename(d))
        nome = os.path.basename(d)
        ativo = 0 if nome.endswith(".disabled") else 1
        classes = list(por_pacote.get(nome, []))
        url, br, cm = _git_info(d)
        req = ""
        for rf in ("requirements.txt", "requirements-no-cupy.txt"):
            if os.path.exists(os.path.join(d, rf)):
                req = ", ".join(l.strip() for l in open(os.path.join(d, rf), encoding="utf-8", errors="replace")
                                if l.strip() and not l.startswith("#"))[:1500]
                break
        rd = os.path.realpath(d)
        if not ativo:
            sit = "desativado"
        elif classes:
            sit = "ok"
        elif rd in falhas:
            sit = "falhou ao importar (veja o log do ComfyUI)"
        elif not os.path.exists(os.path.join(d, "__init__.py")):
            sit = "pasta sem __init__.py (não é um custom node)"
        elif any(os.path.realpath(w).startswith(rd + os.sep) or os.path.realpath(w) == rd for w in web_dirs):
            sit = "só interface/rotas (sem nodes) — normal"
        else:
            sit = "sem nodes carregados"
        if alheios.get(nome, 0) >= 5:
            sit += f" · ⚠️ re-registra {alheios[nome]} nodes de outros pacotes"
        linhas.append((d, nome, ativo, url, br, cm, len(classes), json.dumps(sorted(classes), ensure_ascii=False),
                       req, _tamanho_pasta(d), os.path.getmtime(d), sit))
    # pastas duplicadas: mesmo repositório git (certeza) ou mesmo nome normalizado (provável)
    def marcar(grupos, texto):
        for idx in grupos.values():
            idx = sorted(set(idx))
            if len(idx) < 2:
                continue
            com = [i for i in idx if linhas[i][6] > 0]
            for i in idx:
                if linhas[i][6] == 0 and linhas[i][2] == 1 and linhas[i][11].startswith(("sem nodes carregados", "só interface", "falhou ao importar")):
                    outro = linhas[com[0]][1] if com else linhas[[j for j in idx if j != i][0]][1]
                    l = list(linhas[i]); l[11] = texto.format(outro); linhas[i] = tuple(l)
    por_git = defaultdict(list); por_nome = defaultdict(list)
    for i, l in enumerate(linhas):
        if l[3]:
            por_git[l[3].lower().rstrip("/").removesuffix(".git")].append(i)
        por_nome[_norm_pacote(l[1])].append(i)
    marcar(por_git, "pasta duplicada de “{}” (mesmo repositório) — pode remover")
    marcar(por_nome, "provável duplicata de “{}” (mesmo nome; os nodes ficaram com ela) — confira antes de remover")
    with db() as c:
        c.execute("DELETE FROM nodes")
        c.executemany("INSERT INTO nodes VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", linhas)
    return len(linhas)


# ============================================================================ workflows
def _nodes_wf(w):
    out = []
    if isinstance(w, dict) and "nodes" in w:
        out += w.get("nodes") or []
        for sg in (w.get("definitions") or {}).get("subgraphs", []) or []:
            out += sg.get("nodes", []) or []
        for g in ((w.get("extra") or {}).get("groupNodes") or {}).values():
            out += g.get("nodes", []) or []
    elif isinstance(w, dict):
        for v in w.values():
            if isinstance(v, dict) and "class_type" in v:
                out.append({"type": v["class_type"], "widgets_values": list((v.get("inputs") or {}).values()), "properties": {}})
    return out

FAMILIAS_WF = [("Z-Image", r"z.?image|zit/|lumina"), ("Flux 2 / Klein", r"klein|flux2|flux-2"),
               ("Flux 1", r"flux1|flux-dev|flux_dev|schnell|kontext"), ("Qwen-Image", r"qwen.?image|qwen_image"),
               ("SDXL/Pony/Illustrious", r"sdxl|pony|illustrious|noob|juggernaut"), ("SD 1.5", r"sd15|sd1\.5|v1-5"),
               ("WAN (vídeo)", r"wan2|wan_2|wanvideo|wan22"), ("Ideogram", r"ideogram"), ("Krea", r"krea"),
               ("MOSS", r"moss"), ("Áudio/TTS", r"tts|ace.?step|mmaudio|stable.?audio"), ("Nunchaku", r"nunchaku|svdq")]

def _mapa_pacotes():
    """Mapa classe → pacote usando o cache do ComfyUI-Manager, se existir."""
    mapa = {}
    cands = glob.glob(os.path.join(folder_paths.base_path, "custom_nodes", "ComfyUI-Manager", "**", "extension-node-map.json"), recursive=True)
    cands += glob.glob(os.path.join(folder_paths.get_user_directory(), "**", "*extension-node-map*.json"), recursive=True)
    for p in cands:
        try:
            d = json.load(open(p, encoding="utf-8"))
            for url, v in d.items():
                lst = v[0] if isinstance(v, list) and v else []
                titulo = (v[1] or {}).get("title_aux") if isinstance(v, list) and len(v) > 1 and isinstance(v[1], dict) else None
                for cls in lst:
                    mapa.setdefault(cls, titulo or url)
            if mapa:
                break
        except Exception:
            pass
    return mapa

def indexar_workflows(prog=None):
    import nodes as cnodes
    tipos_ok = set(cnodes.NODE_CLASS_MAPPINGS)
    with db() as c:
        por_nome = defaultdict(list)
        rels = set()
        for r in c.execute("SELECT nome,rel,cat FROM modelos"):
            por_nome[r["nome"].lower()].append(r["rel"])
            rels.add(r["rel"].replace("\\", "/").lower())
        nomes_modelos = list(por_nome)
        stems = {os.path.splitext(n)[0]: n for n in nomes_modelos}
    mapa = _mapa_pacotes()
    base = os.path.join(folder_paths.get_user_directory(), "default", "workflows")
    arqs = sorted(glob.glob(os.path.join(base, "**", "*.json"), recursive=True))
    linhas = []
    for i, p in enumerate(arqs):
        if prog: prog(i, len(arqs), os.path.basename(p))
        rel = os.path.relpath(p, base)
        st = os.stat(p)
        try:
            w = json.load(open(p, encoding="utf-8"))
        except Exception as e:
            linhas.append((rel, os.path.basename(p), os.path.dirname(rel), st.st_mtime, st.st_size, 0, "[]", "[]", "{}", "[]", "{}", "[]", "erro", str(e)[:200]))
            continue
        ns = _nodes_wf(w)
        sg = {s.get("id") for s in ((w.get("definitions") or {}).get("subgraphs", []) if isinstance(w, dict) else [])}
        gn = set(((w.get("extra") or {}).get("groupNodes") or {}).keys()) if isinstance(w, dict) else set()
        tipos = Counter(); falt = {}; modelos = set()
        for n in ns:
            t = n.get("type") or ""
            if not t: continue
            tipos[t] += 1
            if t in sg or t in FRONT or FRONT_RE.search(t) or t.split("/", 1)[-1] in gn or t.split(">", 1)[-1] in gn:
                pass
            elif t not in tipos_ok:
                pr = n.get("properties") or {}
                falt[t] = mapa.get(t) or pr.get("cnr_id") or pr.get("aux_id") or "?"
            if n.get("mode") in (2, 4):
                continue
            wv = n.get("widgets_values")
            vals = wv if isinstance(wv, list) else (list(wv.values()) if isinstance(wv, dict) else [])
            for v in vals:
                if isinstance(v, str) and len(v) < 260 and RE_EXT.search(v.strip()):
                    modelos.add(v.strip().replace("\\", "/"))
        faltam_m = []; sug = {}
        for m in sorted(modelos):
            b = os.path.basename(m).lower()
            if m.lower() in rels or b in por_nome:
                continue
            faltam_m.append(m)
            prox = difflib.get_close_matches(os.path.splitext(b)[0], list(stems), n=3, cutoff=0.72)
            if prox:
                sug[m] = [por_nome[stems[x]][0] for x in prox]
        txt = json.dumps(w)[:300000].lower()
        fam = [k for k, rx in FAMILIAS_WF if re.search(rx, txt)]
        status = "pronto" if not falt and not faltam_m else ("falta node" if falt else "falta modelo")
        if falt and faltam_m: status = "falta node e modelo"
        linhas.append((rel, os.path.basename(p), os.path.dirname(rel), st.st_mtime, st.st_size, len(ns),
                       json.dumps(dict(tipos), ensure_ascii=False), json.dumps(sorted(modelos), ensure_ascii=False),
                       json.dumps(falt, ensure_ascii=False), json.dumps(faltam_m, ensure_ascii=False),
                       json.dumps(sug, ensure_ascii=False), json.dumps(fam, ensure_ascii=False), status, None))
    with db() as c:
        c.execute("DELETE FROM workflows")
        c.executemany("INSERT INTO workflows VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", linhas)
    return len(linhas)


# ============================================================================ saídas
TXT_CHAVES = ("text", "text_g", "text_l", "prompt", "positive", "negative", "tema", "positivo", "negativo", "value",
              "string", "texto", "prompt_positivo", "prompt_negativo", "user_prompt", "caption")
NAO_SEGUIR = {"clip", "model", "vae", "image", "images", "samples", "latent", "latent_image", "pixels", "mask",
              "control_net", "noise", "sigmas", "sampler", "upscale_model", "clip_vision", "style_model"}

def _textos_do_ramo(g, nid, vistos, prof=0):
    """Segue um ramo de conditioning até os nodes de texto e devolve os textos encontrados."""
    nid = str(nid)
    if nid in vistos or prof > 8 or nid not in g:
        return []
    vistos.add(nid)
    out = []
    ins = (g[nid].get("inputs") or {})
    for k, v in ins.items():
        if isinstance(v, str) and k in TXT_CHAVES and len(v.strip()) > 2:
            out.append(v.strip())
        elif isinstance(v, list) and len(v) == 2 and isinstance(v[1], int) and k not in NAO_SEGUIR:
            out += _textos_do_ramo(g, v[0], vistos, prof + 1)
    return out

def _ramos_sampler(g, n, prof=0):
    ins = n.get("inputs") or {}
    if prof > 3:
        return None, None
    pos = ins.get("positive"); neg = ins.get("negative")
    if isinstance(pos, list):
        return pos, neg if isinstance(neg, list) else None
    gd = ins.get("guider")
    if isinstance(gd, list) and str(gd[0]) in g:
        ig = g[str(gd[0])].get("inputs") or {}
        if isinstance(ig.get("conditioning"), list):
            return ig["conditioning"], None
        return _ramos_sampler(g, g[str(gd[0])], prof + 1)
    return None, None

def _meta_png(img):
    info = getattr(img, "info", {}) or {}
    r = dict(prompt="", negativo="", seed="", passos="", cfg="", sampler="", modelo="", modelos_usados=[],
             tem_workflow=1 if "workflow" in info else 0)
    pr = info.get("prompt")
    if pr:
        try:
            g = json.loads(pr)
            textos = []; pos_t = []; neg_t = []; usados = []
            for nid, n in g.items():
                ct = n.get("class_type", ""); ins = n.get("inputs", {}) or {}
                if n.get("mode") in (2, 4):
                    continue
                if "Sampler" in ct or "sampler" in ct.lower():
                    for k_, alvo in (("seed", "seed"), ("noise_seed", "seed"), ("steps", "passos"), ("cfg", "cfg"),
                                     ("sampler_name", "sampler")):
                        v = ins.get(k_)
                        if v is not None and not isinstance(v, list) and not r[alvo]:
                            r[alvo] = str(v)
                    p_, n_ = _ramos_sampler(g, n)
                    if p_ and not pos_t:
                        pos_t = _textos_do_ramo(g, p_[0], set())
                    if n_ and not neg_t:
                        neg_t = _textos_do_ramo(g, n_[0], set())
                for k_, v in ins.items():
                    if isinstance(v, str) and len(v) < 260 and RE_EXT.search(v.strip()):
                        b = os.path.basename(v.strip().replace("\\", "/"))
                        if b not in usados:
                            usados.append(b)
                        if k_ in ("ckpt_name", "unet_name", "model_name") and not r["modelo"] and "Loader" in ct and "upscale" not in ct.lower():
                            r["modelo"] = v
                for k_ in ("text", "positive", "text_g", "prompt", "tema", "positivo"):
                    v = ins.get(k_)
                    if isinstance(v, str) and len(v) > 15:
                        textos.append(v)
            if pos_t:
                r["prompt"] = "\n\n".join(dict.fromkeys(pos_t))[:3000]
            else:
                r["prompt"] = max(textos, key=len)[:3000] if textos else ""
            r["negativo"] = "\n\n".join(dict.fromkeys(neg_t))[:2000]
            r["modelos_usados"] = usados[:40]
        except Exception:
            pass
    elif "parameters" in info:  # A1111/Forge
        s = str(info["parameters"]); partes = s.split("Negative prompt:")
        r["prompt"] = partes[0][:3000]
        if len(partes) > 1:
            r["negativo"] = re.split(r"\n(Steps|Seed):", partes[1])[0].strip()[:2000]
        for k_, alvo in (("Seed", "seed"), ("Steps", "passos"), ("CFG scale", "cfg"), ("Sampler", "sampler"), ("Model", "modelo")):
            m = re.search(rf"{k_}: ([^,]+)", s)
            if m: r[alvo] = m.group(1)
        r["modelos_usados"] = [r["modelo"]] if r["modelo"] else []
        for m in re.finditer(r"<lora:([^:>]+)", r["prompt"]):
            r["modelos_usados"].append(m.group(1))
    return r

def _e_texto(path):
    """Texto ou binário pelo conteúdo, não pela extensão."""
    try:
        with open(path, "rb") as f:
            b = f.read(4096)
        if b"\x00" in b:
            return False
        b.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False
    except Exception:
        return False

def ler_texto(path, limite=200_000):
    if not _e_texto(path):
        return dict(binario=True, texto="")
    with open(path, encoding="utf-8", errors="replace") as f:
        t = f.read(limite)
    if path.lower().endswith(".json"):
        try:
            t = json.dumps(json.loads(t), ensure_ascii=False, indent=2)
        except Exception:
            pass
    return dict(binario=False, texto=t)

VERSAO_SAIDAS = "2"

def indexar_saidas(prog=None):
    from PIL import Image
    base = folder_paths.get_output_directory()
    arqs = []
    for raiz, subs, fs in os.walk(base):
        subs[:] = [s for s in subs if not s.startswith(".")]
        for fn in fs:
            fl = fn.lower()
            if fl.endswith(EXT_IMG + EXT_VID + EXT_AUD + EXT_TXT):
                arqs.append(os.path.join(raiz, fn))
    with db() as c:
        antigos = {r["path"]: r["mtime"] for r in c.execute("SELECT path,mtime FROM saidas")}
        v = c.execute("SELECT v FROM config WHERE k='versao_saidas'").fetchone()
        refazer = (v is None or v[0] != VERSAO_SAIDAS)
        c.execute("INSERT OR REPLACE INTO config VALUES('versao_saidas',?)", (VERSAO_SAIDAS,))
    vistos = set()
    for i, p in enumerate(arqs):
        if prog and i % 20 == 0: prog(i, len(arqs), os.path.basename(p))
        vistos.add(p)
        try:
            st = os.stat(p)
        except Exception:
            continue
        if not refazer and antigos.get(p) == st.st_mtime:
            continue
        fl = p.lower()
        tipo = ("imagem" if fl.endswith(EXT_IMG) else "vídeo" if fl.endswith(EXT_VID) else
                "áudio" if fl.endswith(EXT_AUD) else "texto")
        w = h = None
        m = dict(prompt="", negativo="", seed="", passos="", cfg="", sampler="", modelo="", modelos_usados=[], tem_workflow=0)
        if tipo == "imagem":
            try:
                with Image.open(p) as im:
                    w, h = im.size; m = _meta_png(im)
            except Exception:
                pass
        elif tipo == "texto":
            try:
                t = ler_texto(p, 4000)
                m["prompt"] = "" if t["binario"] else t["texto"][:3000]
            except Exception:
                pass
        with db() as c:
            c.execute("INSERT OR REPLACE INTO saidas(path,nome,sub,tipo,tamanho,mtime,largura,altura,prompt,seed,passos,cfg,"
                      "sampler,modelo,tem_workflow,negativo,modelos_usados) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (p, os.path.basename(p), os.path.relpath(os.path.dirname(p), base), tipo, st.st_size, st.st_mtime,
                       w, h, m["prompt"], m["seed"], m["passos"], m["cfg"], m["sampler"], m["modelo"], m["tem_workflow"],
                       m["negativo"], json.dumps(m["modelos_usados"], ensure_ascii=False)))
    with db() as c:
        for p in set(antigos) - vistos:
            c.execute("DELETE FROM saidas WHERE path=?", (p,))
    return len(arqs)

def miniatura(path, lado=320):
    from PIL import Image
    st = os.stat(path)
    nome = hashlib.sha1(f"{path}|{st.st_mtime}|{lado}".encode()).hexdigest() + ".jpg"
    alvo = os.path.join(THUMBS, nome)
    if os.path.exists(alvo):
        return alvo
    fl = path.lower()
    if fl.endswith(EXT_TXT + EXT_AUD):
        return None
    if fl.endswith(EXT_VID):
        ff = shutil.which("ffmpeg")
        if not ff:
            return None
        subprocess.run([ff, "-y", "-loglevel", "error", "-ss", "1", "-i", path, "-frames:v", "1",
                        "-vf", f"scale={lado}:-1", alvo], timeout=30)
        return alvo if os.path.exists(alvo) else None
    with Image.open(path) as im:
        im.thumbnail((lado, lado))
        if im.mode not in ("RGB", "L"):
            fundo = Image.new("RGB", im.size, (40, 40, 40))
            im = im.convert("RGBA"); fundo.paste(im, mask=im.split()[3]); im = fundo
        im.save(alvo, "JPEG", quality=82)
    return alvo


# ============================================================================ execução em segundo plano
def _prog_factory(etapa):
    def prog(i, total, item=""):
        ESTADO.update(etapa=etapa, feito=i, total=total, msg=item)
    return prog

def indexar_tudo(alvos=("modelos", "nodes", "workflows", "saidas")):
    if ESTADO["rodando"]:
        return False
    def run():
        ESTADO.update(rodando=True, erro=None)
        t0 = time.time()
        try:
            global _MONT
            _MONT = None
            if "modelos" in alvos: indexar_modelos(_prog_factory("Modelos"))
            if "nodes" in alvos: indexar_nodes(_prog_factory("Custom nodes"))
            if "workflows" in alvos: indexar_workflows(_prog_factory("Workflows"))
            if "saidas" in alvos: indexar_saidas(_prog_factory("Saídas"))
            ESTADO.update(ultimo=time.time(), msg=f"concluído em {time.time() - t0:.0f} s")
        except Exception as e:
            import traceback; traceback.print_exc()
            ESTADO["erro"] = str(e)
        finally:
            ESTADO.update(rodando=False, etapa="")
    threading.Thread(target=run, daemon=True).start()
    return True


# ============================================================================ consultas
def _uso_modelos():
    """nome-base (minúsculo) → lista de workflows que o usam."""
    uso = defaultdict(list)
    with db() as c:
        for r in c.execute("SELECT path,modelos FROM workflows"):
            for m in json.loads(r["modelos"] or "[]"):
                uso[os.path.basename(m).lower()].append(r["path"])
    return uso

def resumo():
    with db() as c:
        q = lambda s: c.execute(s).fetchone()[0]
        r = dict(
            modelos=q("SELECT COUNT(*) FROM modelos"), modelos_bytes=q("SELECT COALESCE(SUM(tamanho),0) FROM modelos"),
            workflows=q("SELECT COUNT(*) FROM workflows"), wf_prontos=q("SELECT COUNT(*) FROM workflows WHERE status='pronto'"),
            nodes=q("SELECT COUNT(*) FROM nodes"), nodes_problema=q("SELECT COUNT(*) FROM nodes WHERE situacao NOT IN ('ok','desativado') AND situacao NOT LIKE 'só interface%' AND situacao NOT LIKE 'ok · %'"),
            saidas=q("SELECT COUNT(*) FROM saidas"), saidas_bytes=q("SELECT COALESCE(SUM(tamanho),0) FROM saidas"),
            duplicados=q("SELECT COALESCE(SUM(n-1),0) FROM (SELECT COUNT(*) n FROM modelos WHERE impressao IS NOT NULL GROUP BY impressao HAVING n>1)"),
            dup_bytes=q("SELECT COALESCE(SUM((n-1)*t),0) FROM (SELECT COUNT(*) n, MAX(tamanho) t FROM modelos WHERE impressao IS NOT NULL GROUP BY impressao HAVING n>1)"),
            corrompidos=q("SELECT COUNT(*) FROM modelos WHERE integro LIKE 'truncado%' OR integro LIKE 'ERRO%'"),
        )
        r["por_categoria"] = [dict(x) for x in c.execute("SELECT cat, disco, COUNT(*) n, SUM(tamanho) bytes FROM modelos GROUP BY cat, disco ORDER BY bytes DESC")]
        r["por_familia"] = [dict(x) for x in c.execute("SELECT familia, COUNT(*) n, SUM(tamanho) bytes FROM modelos GROUP BY familia ORDER BY bytes DESC LIMIT 20")]
    r["discos"] = discos()
    r["estado"] = dict(ESTADO)
    return r

def _fam_base(f):
    return re.sub(r" \(pelo nome\)$", "", f or "?")

def _sensivel_modelo(r, marcas, civ=None):
    """(sensível?, motivo) para um modelo. Marcação manual > Civitai > nome/gatilhos."""
    mk = marcas.get(r["path"])
    if mk and mk.get("nsfw") is not None:
        return bool(mk["nsfw"]), "marcado por você"
    civ = civ if civ is not None else (json.loads(r["civitai"]) if r.get("civitai") else {})
    if civ.get("nsfw"):
        return True, "Civitai: modelo adulto"
    if config_ler()["nsfw_nomes_modelos"] == "1":
        t = termo_sensivel(r["nome"])
        if t:
            return True, f"nome contém “{t}”"
        meta = r["meta"] if isinstance(r.get("meta"), dict) else json.loads(r.get("meta") or "{}")
        t = termo_sensivel(meta.get("gatilhos (tags de treino)", ""))
        if t:
            return True, f"tags de treino contêm “{t}”"
    return False, ""

PREV_EXT = (".preview.png", ".preview.jpg", ".preview.jpeg", ".preview.webp", ".png", ".jpg", ".jpeg", ".webp", ".thumb.jpg")

def _previa_lateral(path):
    stem = os.path.splitext(path)[0]
    for e in PREV_EXT:
        if os.path.isfile(stem + e):
            return stem + e
    return None

def _ultima_saida_por_modelo():
    """nome do arquivo (minúsculo) → saída de imagem mais recente que usou esse modelo/LoRA."""
    mapa = {}
    with db() as c:
        for r in c.execute("SELECT path, prompt, modelos_usados FROM saidas WHERE tipo='imagem' AND modelos_usados IS NOT NULL "
                           "AND modelos_usados!='[]' ORDER BY mtime DESC"):
            for m in json.loads(r["modelos_usados"] or "[]"):
                k = os.path.basename(m).lower()
                if k not in mapa:
                    mapa[k] = (r["path"], r["prompt"])
                k2 = os.path.splitext(k)[0]
                if k2 not in mapa:
                    mapa[k2] = (r["path"], r["prompt"])
    return mapa

def resolver_previa(r, marcas=None, saidas_map=None):
    """Imagem de prévia de um modelo: escolhida por você > arquivo ao lado do modelo > Civitai > última imagem gerada com ele."""
    marcas = marcas if marcas is not None else _marcas()
    mk = marcas.get(r["path"]) or {}
    if mk.get("previa") and os.path.isfile(mk["previa"]):
        return dict(arquivo=mk["previa"], origem="escolhida por você", sensivel=_sensivel_saida_simples(mk["previa"], marcas))
    lat = _previa_lateral(r["path"])
    if lat:
        return dict(arquivo=lat, origem="arquivo ao lado do modelo", sensivel=None)
    civ = json.loads(r["civitai"]) if r.get("civitai") else {}
    if civ.get("previa") and os.path.isfile(os.path.join(PREVIAS, civ["previa"])):
        return dict(arquivo=os.path.join(PREVIAS, civ["previa"]), origem="Civitai",
                    sensivel=(civ.get("previa_nivel") or 0) >= 4)
    if saidas_map is None:
        saidas_map = _ultima_saida_por_modelo()
    nm = r["nome"].lower()
    sp = saidas_map.get(nm) or saidas_map.get(os.path.splitext(nm)[0])
    if sp:
        return dict(arquivo=sp[0], origem="última imagem gerada com ele", sensivel=_sensivel_saida_simples(sp[0], marcas, sp[1]))
    return None

def _sensivel_saida_simples(path, marcas, prompt=None):
    mk = marcas.get(path)
    if mk and mk.get("nsfw") is not None:
        return bool(mk["nsfw"])
    if prompt is None:
        with db() as c:
            rr = c.execute("SELECT prompt FROM saidas WHERE path=?", (path,)).fetchone()
        prompt = rr["prompt"] if rr else ""
    return bool(termo_sensivel(prompt))

def listar_modelos(q="", cat="", disco="", filtro="", ordem="tamanho", limite=1000, familia=""):
    uso = _uso_modelos()
    marcas = _marcas(); smap = _ultima_saida_por_modelo()
    sql = "SELECT * FROM modelos WHERE 1=1"; args = []
    if q:
        sql += " AND (nome LIKE ? OR rel LIKE ? OR familia LIKE ? OR meta LIKE ? OR civitai LIKE ?)"; args += [f"%{q}%"] * 5
    if cat: sql += " AND cat=?"; args.append(cat)
    if disco: sql += " AND disco=?"; args.append(disco)
    if familia: sql += " AND (familia=? OR familia=?)"; args += [familia, familia + " (pelo nome)"]
    if filtro == "duplicados":
        sql += " AND impressao IN (SELECT impressao FROM modelos GROUP BY impressao HAVING COUNT(*)>1)"
    if filtro == "problemas":
        sql += " AND (integro LIKE 'truncado%' OR integro LIKE 'ERRO%')"
    if filtro == "offline":
        sql += " AND offline=1"
    ordem_sql = {"tamanho": "tamanho DESC", "nome": "nome COLLATE NOCASE", "data": "mtime DESC", "familia": "familia, nome"}.get(ordem, "tamanho DESC")
    if filtro == "duplicados": ordem_sql = "impressao, tamanho DESC"
    sql += f" ORDER BY {ordem_sql}"
    with db() as c:
        rows = [dict(r) for r in c.execute(sql, args)]
    out = []
    for r in rows:
        r["usado_por"] = uso.get(r["nome"].lower(), [])
        if filtro == "nao_usados" and (r["usado_por"] or r["cat"] in ("upscale_models", "embeddings", "vae_approx")):
            continue
        r["meta"] = json.loads(r["meta"] or "{}")
        civ = json.loads(r["civitai"]) if r.get("civitai") else {}
        r["sensivel"], r["sensivel_motivo"] = _sensivel_modelo(r, marcas, civ)
        pv = resolver_previa(r, marcas, smap)
        if pv:
            if pv["sensivel"] is None:
                pv["sensivel"] = r["sensivel"]
            pv["sensivel"] = bool(pv["sensivel"] or r["sensivel"])
            pv.pop("arquivo", None)
        r["previa"] = pv
        r["familia_inferida"] = (r["familia"] or "").endswith("(pelo nome)") or r["cat"] in CAT_FAM
        r["nova_versao"] = civ.get("nova_versao")
        if filtro == "sem_previa" and pv:
            continue
        if filtro == "sensiveis" and not r["sensivel"]:
            continue
        out.append(r)
        if len(out) >= limite: break
    return out

def facetas(cat="", disco=""):
    with db() as c:
        cats = [dict(r) for r in c.execute("SELECT cat, COUNT(*) n, SUM(tamanho) bytes FROM modelos " +
                                           ("WHERE disco=? " if disco else "") + "GROUP BY cat ORDER BY n DESC", [disco] if disco else [])]
        sql = "SELECT familia, COUNT(*) n FROM modelos WHERE 1=1"; a = []
        if cat: sql += " AND cat=?"; a.append(cat)
        if disco: sql += " AND disco=?"; a.append(disco)
        fam = Counter()
        for r in c.execute(sql + " GROUP BY familia", a):
            fam[_fam_base(r["familia"])] += r["n"]
        discos_ = [dict(r) for r in c.execute("SELECT disco, COUNT(*) n, SUM(tamanho) bytes, MAX(offline) offline FROM modelos GROUP BY disco")]
    return dict(cats=cats, familias=[dict(familia=k, n=v) for k, v in fam.most_common()], discos=discos_)

def arquivo_previa(path_modelo):
    with db() as c:
        r = c.execute("SELECT * FROM modelos WHERE path=?", (path_modelo,)).fetchone()
    if not r:
        return None
    pv = resolver_previa(dict(r))
    return pv["arquivo"] if pv else None

def saidas_do_modelo(nome, limite=24):
    nm = os.path.basename(nome)
    marcas = _marcas()
    with db() as c:
        rows = [dict(r) for r in c.execute("SELECT * FROM saidas WHERE tipo='imagem' AND (modelos_usados LIKE ? OR modelos_usados LIKE ?) "
                                           "ORDER BY mtime DESC LIMIT ?", (f'%"{nm}"%', f'%"{os.path.splitext(nm)[0]}"%', limite))]
    _anotar_saidas(rows, marcas)
    return rows

def listar_workflows(q="", status=""):
    sql = "SELECT * FROM workflows WHERE 1=1"; args = []
    if q: sql += " AND (path LIKE ? OR modelos LIKE ? OR tipos LIKE ?)"; args += [f"%{q}%"] * 3
    if status: sql += " AND status=?"; args.append(status)
    sql += " ORDER BY pasta COLLATE NOCASE, nome COLLATE NOCASE"
    with db() as c:
        rows = [dict(r) for r in c.execute(sql, args)]
    for r in rows:
        for k in ("modelos", "faltam_nodes", "faltam_modelos", "sugestoes", "familias", "tipos"):
            r[k] = json.loads(r[k] or ("{}" if k in ("faltam_nodes", "sugestoes", "tipos") else "[]"))
    return rows

def listar_nodes():
    with db() as c:
        rows = [dict(r) for r in c.execute("SELECT n.*, a.situacao AS atualizacao, a.remoto, a.quando AS verificado "
                                           "FROM nodes n LEFT JOIN atualizacoes a ON a.pasta=n.pasta "
                                           "ORDER BY n.situacao!='ok', n.nome COLLATE NOCASE")]
        wfs = [set(json.loads(r["tipos"] or "{}")) for r in c.execute("SELECT tipos FROM workflows")]
    for r in rows:
        r["classes"] = json.loads(r["classes"] or "[]")
        cl = set(r["classes"])
        r["workflows_que_usam"] = sum(1 for t in wfs if t & cl)
    return rows

def _modelos_sensiveis():
    marcas = _marcas(); out = {}
    with db() as c:
        for r in c.execute("SELECT path, nome, meta, civitai FROM modelos"):
            sv, mot = _sensivel_modelo(dict(r), marcas)
            if sv:
                out[r["nome"].lower()] = mot
                out[os.path.splitext(r["nome"].lower())[0]] = mot
    return out

def _anotar_saidas(rows, marcas=None, sens_mod=None):
    marcas = marcas if marcas is not None else _marcas()
    sens_mod = sens_mod if sens_mod is not None else _modelos_sensiveis()
    base = folder_paths.get_output_directory()
    for r in rows:
        r["rel"] = os.path.relpath(r["path"], base)
        r["modelos_usados"] = json.loads(r.get("modelos_usados") or "[]") if isinstance(r.get("modelos_usados"), str) else (r.get("modelos_usados") or [])
        mk = marcas.get(r["path"])
        if mk and mk.get("nsfw") is not None:
            r["sensivel"], r["sensivel_motivo"] = bool(mk["nsfw"]), "marcado por você"
            continue
        t = termo_sensivel(r.get("prompt") if r.get("tipo") != "texto" else "")
        if t:
            r["sensivel"], r["sensivel_motivo"] = True, f"prompt contém “{t}”"
            continue
        for m in r["modelos_usados"]:
            k = os.path.basename(m).lower()
            mot = sens_mod.get(k) or sens_mod.get(os.path.splitext(k)[0])
            if mot:
                r["sensivel"], r["sensivel_motivo"] = True, f"usou o modelo {os.path.basename(m)} ({mot})"
                break
        else:
            r["sensivel"], r["sensivel_motivo"] = False, ""

def listar_saidas(q="", tipo="", pagina=0, por_pag=60, sens="", ordem="data"):
    sql = "SELECT * FROM saidas WHERE 1=1"; args = []
    if q: sql += " AND (nome LIKE ? OR sub LIKE ? OR prompt LIKE ? OR modelo LIKE ? OR seed LIKE ? OR modelos_usados LIKE ?)"; args += [f"%{q}%"] * 6
    if tipo: sql += " AND tipo=?"; args.append(tipo)
    ordem_sql = {"data": "mtime DESC", "antigas": "mtime", "tamanho": "tamanho DESC", "nome": "nome COLLATE NOCASE"}.get(ordem, "mtime DESC")
    with db() as c:
        rows = [dict(r) for r in c.execute(sql + f" ORDER BY {ordem_sql}", args)]
    _anotar_saidas(rows)
    n_sens = sum(1 for r in rows if r["sensivel"])
    if sens == "ocultar":
        rows = [r for r in rows if not r["sensivel"]]
    elif sens == "so":
        rows = [r for r in rows if r["sensivel"]]
    total = len(rows)
    return dict(total=total, sensiveis=n_sens, itens=rows[pagina * por_pag:(pagina + 1) * por_pag])

def limpeza():
    uso = _uso_modelos()
    with db() as c:
        grandes = [dict(r) for r in c.execute("SELECT path,nome,cat,disco,tamanho,familia FROM modelos ORDER BY tamanho DESC LIMIT 40")]
        dups = defaultdict(list)
        for r in c.execute("SELECT path,nome,cat,disco,tamanho,impressao FROM modelos WHERE impressao IN (SELECT impressao FROM modelos GROUP BY impressao HAVING COUNT(*)>1) ORDER BY tamanho DESC"):
            dups[r["impressao"]].append(dict(r))
        nao_usados = [dict(r) for r in c.execute("SELECT path,nome,cat,disco,tamanho,familia,mtime FROM modelos WHERE cat NOT IN ('upscale_models','embeddings','vae_approx') ORDER BY tamanho DESC")]
        problemas = [dict(r) for r in c.execute("SELECT path,nome,cat,disco,tamanho,integro FROM modelos WHERE integro LIKE 'truncado%' OR integro LIKE 'ERRO%'")]
        saidas_pastas = [dict(r) for r in c.execute("SELECT sub, COUNT(*) n, SUM(tamanho) bytes FROM saidas GROUP BY sub ORDER BY bytes DESC LIMIT 30")]
    nao_usados = [r for r in nao_usados if not uso.get(r["nome"].lower())][:80]
    for r in grandes:
        r["usado_por"] = len(uso.get(r["nome"].lower(), []))
    incompletos = []
    for cat, dirs in _raizes_modelos().items():
        for d in dirs:
            for p in glob.glob(os.path.join(d, "**", "*.incomplete"), recursive=True) + \
                     glob.glob(os.path.join(d, "**", "*.part"), recursive=True):
                try: incompletos.append(dict(path=p, nome=os.path.basename(p), tamanho=os.path.getsize(p), cat=cat))
                except Exception: pass
    return dict(grandes=grandes, duplicados=list(dups.values()), nao_usados=nao_usados, problemas=problemas,
                incompletos=incompletos, saidas_pastas=saidas_pastas, discos=discos())

def busca(q, limite=30):
    q = (q or "").strip()
    if not q: return {}
    return dict(modelos=listar_modelos(q=q, limite=limite), workflows=listar_workflows(q=q)[:limite],
                saidas=listar_saidas(q=q, por_pag=limite)["itens"],
                nodes=[n for n in listar_nodes() if q.lower() in (n["nome"] + " " + " ".join(n["classes"])).lower()][:limite])


# ============================================================================ ações (seguras)
def _permitido(path):
    rp = os.path.realpath(path)
    raizes = [os.path.realpath(d) for ds in _raizes_modelos().values() for d in ds]
    raizes.append(os.path.realpath(folder_paths.get_output_directory()))
    return any(rp.startswith(r.rstrip("/") + "/") for r in raizes)

def _lixeira_de(path):
    """Lixeira freedesktop correta para o disco do arquivo (restaurável pelo Nautilus)."""
    home = os.path.expanduser("~")
    xdg = os.environ.get("XDG_DATA_HOME") or os.path.join(home, ".local", "share")
    if os.stat(path).st_dev == os.stat(home).st_dev:
        return os.path.join(xdg, "Trash")
    mp, _ = disco_de(path)
    t = os.path.join(mp, f".Trash-{os.getuid()}")
    os.makedirs(t, mode=0o700, exist_ok=True)
    return t

def mover_para_lixeira(paths):
    feitos, erros = [], []
    for p in paths:
        try:
            if not _permitido(p) or not os.path.isfile(p):
                raise ValueError("fora das pastas de modelos/saídas")
            lx = _lixeira_de(p)
            os.makedirs(os.path.join(lx, "files"), exist_ok=True); os.makedirs(os.path.join(lx, "info"), exist_ok=True)
            base = os.path.basename(p); nome = base; i = 1
            while os.path.exists(os.path.join(lx, "files", nome)) or os.path.exists(os.path.join(lx, "info", nome + ".trashinfo")):
                r, e = os.path.splitext(base); nome = f"{r}.{i}{e}"; i += 1
            with open(os.path.join(lx, "info", nome + ".trashinfo"), "w") as f:
                f.write("[Trash Info]\nPath=" + urllib.parse.quote(os.path.abspath(p)) +
                        "\nDeletionDate=" + time.strftime("%Y-%m-%dT%H:%M:%S") + "\n")
            os.rename(p, os.path.join(lx, "files", nome))
            feitos.append(p)
            with db() as c:
                c.execute("DELETE FROM modelos WHERE path=?", (p,)); c.execute("DELETE FROM saidas WHERE path=?", (p,))
        except Exception as e:
            erros.append(f"{os.path.basename(p)}: {e}")
    registrar("lixeira", dict(feitos=feitos, erros=erros))
    return dict(feitos=feitos, erros=erros)

MOVENDO = {"ativo": False, "arquivo": "", "feito": 0, "total": 0, "erro": None, "fim": None}

def destinos_para(path):
    with db() as c:
        r = c.execute("SELECT cat, raiz, rel FROM modelos WHERE path=?", (path,)).fetchone()
    if not r: return []
    out = []
    for d in _raizes_modelos().get(r["cat"], []):
        if os.path.realpath(d) != os.path.realpath(r["raiz"]):
            mp, nome = disco_de(d)
            try: livre = shutil.disk_usage(d).free
            except Exception: livre = None
            out.append(dict(raiz=d, disco=nome, livre=livre, destino=os.path.join(d, r["rel"])))
    return out

def mover_modelo(path, raiz_destino):
    """Move (ou copia) um modelo entre SSD e HD mantendo a subpasta — o ComfyUI continua achando pelo mesmo nome."""
    if MOVENDO["ativo"]:
        return False
    with db() as c:
        r = c.execute("SELECT cat, raiz, rel FROM modelos WHERE path=?", (path,)).fetchone()
    if not r or raiz_destino not in _raizes_modelos().get(r["cat"], []):
        raise ValueError("destino inválido para esta categoria")
    destino = os.path.join(raiz_destino, r["rel"])
    if os.path.exists(destino):
        raise ValueError("já existe um arquivo com esse nome no destino")
    tam = os.path.getsize(path)
    if shutil.disk_usage(raiz_destino).free < tam * 1.02:
        raise ValueError("espaço insuficiente no destino")
    def run():
        MOVENDO.update(ativo=True, arquivo=os.path.basename(path), feito=0, total=tam, erro=None, fim=None)
        tmp = destino + ".cofre-copiando"
        try:
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            with open(path, "rb") as fi, open(tmp, "wb") as fo:
                while True:
                    b = fi.read(32 * 1024 * 1024)
                    if not b: break
                    fo.write(b); MOVENDO["feito"] += len(b)
                fo.flush(); os.fsync(fo.fileno())
            if os.path.getsize(tmp) != tam:
                raise IOError("cópia incompleta")
            os.rename(tmp, destino)
            shutil.copystat(path, destino)
            os.remove(path)
            registrar("mover", dict(de=path, para=destino))
            with db() as c:
                c.execute("DELETE FROM modelos WHERE path=?", (path,))
            indexar_modelos()
        except Exception as e:
            MOVENDO["erro"] = str(e)
            try: os.remove(tmp)
            except Exception: pass
        finally:
            MOVENDO.update(ativo=False, fim=time.time())
    threading.Thread(target=run, daemon=True).start()
    return True

def abrir_pasta(path):
    if not _permitido(path) and not os.path.realpath(path).startswith(os.path.realpath(folder_paths.base_path)):
        raise ValueError("pasta não permitida")
    d = path if os.path.isdir(path) else os.path.dirname(path)
    xo = shutil.which("xdg-open")
    if not xo: raise ValueError("xdg-open não encontrado")
    subprocess.Popen([xo, d], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    return True

def _http_json(url, timeout=20):
    import urllib.request
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "ComfyUI-Cofre"}), timeout=timeout) as resp:
        return json.loads(resp.read())

def _sem_html(t, n=700):
    t = re.sub(r"<br\s*/?>|</p>", "\n", t or "")
    t = re.sub(r"<[^>]+>", "", t)
    import html as _h
    return re.sub(r"\n{3,}", "\n\n", _h.unescape(t)).strip()[:n]

def _baixar_previa(imagens, chave):
    """Baixa a primeira imagem (não vídeo) da versão, preferindo uma não adulta; guarda miniatura local."""
    import urllib.request, io
    from PIL import Image
    imgs = [i for i in (imagens or []) if (i.get("type") or "image") == "image" and i.get("url")]
    if not imgs:
        return None, None
    imgs.sort(key=lambda i: (i.get("nsfwLevel") or 1) >= 4)
    esc = imgs[0]
    url = re.sub(r"/(width|original)=[^/]+/", "/width=512/", esc["url"])
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "ComfyUI-Cofre"}), timeout=30) as resp:
            dados = resp.read(15_000_000)
        with Image.open(io.BytesIO(dados)) as im:
            im = im.convert("RGB"); im.thumbnail((512, 512))
            nome = chave + ".jpg"
            im.save(os.path.join(PREVIAS, nome), "JPEG", quality=85)
        return nome, esc.get("nsfwLevel") or (4 if esc.get("nsfw") not in (None, False, "None") else 1)
    except Exception:
        return None, None

def consultar_civitai(path, baixar_previa=True):
    if config_ler()["civitai"] != "1":
        raise ValueError("consultas ao Civitai estão desativadas nas Configurações")
    with db() as c:
        r = c.execute("SELECT sha256, impressao FROM modelos WHERE path=?", (path,)).fetchone()
        sha = r["sha256"] if r and r["sha256"] else None
        if not sha and r and r["impressao"]:
            o = c.execute("SELECT sha256 FROM modelos WHERE impressao=? AND sha256 IS NOT NULL LIMIT 1", (r["impressao"],)).fetchone()
            sha = o[0] if o else None
    if not sha:
        sha = sha256_arquivo(path)
    with db() as c:
        c.execute("UPDATE modelos SET sha256=? WHERE path=?", (sha, path))
    try:
        d = _http_json(f"https://civitai.com/api/v1/model-versions/by-hash/{sha}")
        mod = d.get("model") or {}
        info = dict(modelo=mod.get("name"), versao=d.get("name"), base=d.get("baseModel"), tipo=mod.get("type"),
                    gatilhos=d.get("trainedWords") or [], nsfw=bool(mod.get("nsfw")),
                    link=f"https://civitai.com/models/{d.get('modelId')}?modelVersionId={d.get('id')}",
                    publicado=(d.get("publishedAt") or d.get("createdAt") or "")[:10], descricao=_sem_html(d.get("description")))
        try:
            m = _http_json(f"https://civitai.com/api/v1/models/{d.get('modelId')}")
            info["nsfw"] = bool(m.get("nsfw")) or info["nsfw"]   # nsfwLevel do modelo soma as imagens da galeria: não usar
            info["autor"] = (m.get("creator") or {}).get("username")
            info["tags"] = (m.get("tags") or [])[:12]
            if not info["descricao"]:
                info["descricao"] = _sem_html(m.get("description"))
            vs = m.get("modelVersions") or []
            if vs and vs[0].get("id") != d.get("id"):
                info["nova_versao"] = dict(nome=vs[0].get("name"), base=vs[0].get("baseModel"),
                                           link=f"https://civitai.com/models/{d.get('modelId')}?modelVersionId={vs[0].get('id')}")
        except Exception:
            pass
        if baixar_previa:
            nome, nivel = _baixar_previa(d.get("images"), sha[:24])
            if nome:
                info["previa"] = nome; info["previa_nivel"] = nivel
    except Exception as e:
        info = dict(erro=f"não encontrado no Civitai ({str(e)[:60]})")
    with db() as c:
        c.execute("UPDATE modelos SET civitai=? WHERE path=?", (json.dumps(info, ensure_ascii=False), path))
    registrar("civitai", dict(path=path, achado=not info.get("erro")))
    return dict(sha256=sha, **info)

ENRIQ = {"ativo": False, "feito": 0, "total": 0, "atual": "", "achados": 0, "erro": None, "parar": False}

def enriquecer_lote(paths):
    """Consulta o Civitai em segundo plano para vários modelos (calcula o SHA256 de cada um, sem enviar o arquivo)."""
    if ENRIQ["ativo"]:
        return False
    paths = [p for p in paths if _permitido(p) and os.path.isfile(p)]
    def run():
        ENRIQ.update(ativo=True, feito=0, total=len(paths), atual="", achados=0, erro=None, parar=False)
        try:
            for i, p in enumerate(paths):
                if ENRIQ["parar"]:
                    break
                ENRIQ.update(feito=i, atual=os.path.basename(p))
                try:
                    r = consultar_civitai(p)
                    if not r.get("erro"):
                        ENRIQ["achados"] += 1
                except Exception as e:
                    ENRIQ["erro"] = str(e)[:120]
                    if "desativadas" in str(e):
                        break
                time.sleep(0.4)
            ENRIQ["feito"] = len(paths)
        finally:
            ENRIQ.update(ativo=False, atual="")
    threading.Thread(target=run, daemon=True).start()
    return True


# ============================================================================ atualizações dos custom nodes (só leitura)
ATUALIZ = {"ativo": False, "feito": 0, "total": 0}

def verificar_atualizacoes():
    """Compara o commit local com o remoto via `git ls-remote` (não altera nada)."""
    if ATUALIZ["ativo"]:
        return False
    git = shutil.which("git")
    if not git:
        raise ValueError("git não encontrado no sistema")
    with db() as c:
        alvos = [dict(r) for r in c.execute("SELECT pasta, git_url, branch, commit_ FROM nodes WHERE git_url IS NOT NULL")]
    def um(r):
        ref = r["branch"] if r["branch"] and r["branch"] != "(destacado)" else "HEAD"
        try:
            env = dict(os.environ, GIT_TERMINAL_PROMPT="0", GIT_ASKPASS="echo")
            out = subprocess.run([git, "-C", r["pasta"], "ls-remote", "origin", ref], capture_output=True, text=True,
                                 timeout=20, env=env).stdout.split()
            remoto = out[0] if out else ""
            if not remoto:
                sit = "não consegui consultar"
            elif r["commit_"] and remoto.startswith(r["commit_"]):
                sit = "atualizado"
            else:
                sit = "atualização disponível"
        except Exception as e:
            remoto, sit = "", "erro: " + str(e)[:60]
        with db() as c:
            c.execute("INSERT OR REPLACE INTO atualizacoes VALUES(?,?,?,?)", (r["pasta"], remoto[:10], sit, time.time()))
        ATUALIZ["feito"] += 1
    def run():
        from concurrent.futures import ThreadPoolExecutor
        ATUALIZ.update(ativo=True, feito=0, total=len(alvos))
        try:
            with ThreadPoolExecutor(8) as ex:
                list(ex.map(um, alvos))
        finally:
            ATUALIZ["ativo"] = False
            registrar("verificar atualizações", dict(pacotes=len(alvos)))
    threading.Thread(target=run, daemon=True).start()
    return True

def atividade(limite=300):
    with db() as c:
        return [dict(quando=r["quando"], acao=r["acao"], detalhe=json.loads(r["detalhe"] or "{}"))
                for r in c.execute("SELECT * FROM log ORDER BY quando DESC LIMIT ?", (limite,))]
