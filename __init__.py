# -*- coding: utf-8 -*-
"""ComfyUI-Cofre — painel local para inventariar e cuidar da biblioteca do ComfyUI (otimizado para Linux).

Abre como uma aba na barra lateral do ComfyUI (ícone de cofre). Não adiciona nodes ao grafo.
"""
import os
import json
import asyncio

from aiohttp import web
from server import PromptServer

from . import core

WEB_DIRECTORY = "./web"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
__version__ = "1.0.0"

rotas = PromptServer.instance.routes


def _j(d, status=200):
    return web.json_response(d, status=status, dumps=lambda o: json.dumps(o, ensure_ascii=False, default=str))


async def _thread(fn, *a, **kw):
    return await asyncio.get_running_loop().run_in_executor(None, lambda: fn(*a, **kw))


def _erro(e):
    return _j({"erro": str(e)}, 400)


@rotas.get("/cofre/resumo")
async def r_resumo(req):
    return _j(await _thread(core.resumo))


@rotas.get("/cofre/estado")
async def r_estado(req):
    return _j({"indexacao": core.ESTADO, "movendo": core.MOVENDO})


@rotas.post("/cofre/indexar")
async def r_indexar(req):
    try:
        d = await req.json()
    except Exception:
        d = {}
    alvos = d.get("alvos") or ["modelos", "nodes", "workflows", "saidas"]
    ok = core.indexar_tudo(tuple(alvos))
    return _j({"iniciado": ok})


@rotas.get("/cofre/modelos")
async def r_modelos(req):
    q = req.query
    return _j(await _thread(core.listar_modelos, q.get("q", ""), q.get("cat", ""), q.get("disco", ""),
                            q.get("filtro", ""), q.get("ordem", "tamanho"), int(q.get("limite", 500))))


@rotas.get("/cofre/workflows")
async def r_workflows(req):
    q = req.query
    return _j(await _thread(core.listar_workflows, q.get("q", ""), q.get("status", "")))


@rotas.get("/cofre/nodes")
async def r_nodes(req):
    return _j(await _thread(core.listar_nodes))


@rotas.get("/cofre/saidas")
async def r_saidas(req):
    q = req.query
    return _j(await _thread(core.listar_saidas, q.get("q", ""), q.get("tipo", ""), int(q.get("pagina", 0)),
                            int(q.get("por_pag", 60))))


@rotas.get("/cofre/limpeza")
async def r_limpeza(req):
    return _j(await _thread(core.limpeza))


@rotas.get("/cofre/busca")
async def r_busca(req):
    return _j(await _thread(core.busca, req.query.get("q", "")))


@rotas.get("/cofre/miniatura")
async def r_mini(req):
    p = req.query.get("path", "")
    if not core._permitido(p) or not os.path.isfile(p):
        return web.Response(status=404)
    try:
        alvo = await _thread(core.miniatura, p, int(req.query.get("lado", 320)))
    except Exception:
        alvo = None
    if not alvo:
        return web.Response(status=404)
    return web.FileResponse(alvo, headers={"Cache-Control": "max-age=86400"})


@rotas.get("/cofre/arquivo")
async def r_arquivo(req):
    """Entrega o arquivo de saída original (para carregar o workflow embutido no PNG)."""
    p = req.query.get("path", "")
    if not core._permitido(p) or not os.path.isfile(p):
        return web.Response(status=404)
    return web.FileResponse(p)


@rotas.post("/cofre/lixeira")
async def r_lixeira(req):
    d = await req.json()
    if not d.get("confirmar"):
        return _erro("confirmação obrigatória")
    return _j(await _thread(core.mover_para_lixeira, d.get("paths") or []))


@rotas.get("/cofre/destinos")
async def r_destinos(req):
    return _j(await _thread(core.destinos_para, req.query.get("path", "")))


@rotas.post("/cofre/mover")
async def r_mover(req):
    d = await req.json()
    if not d.get("confirmar"):
        return _erro("confirmação obrigatória")
    try:
        return _j({"iniciado": core.mover_modelo(d["path"], d["raiz_destino"])})
    except Exception as e:
        return _erro(e)


@rotas.post("/cofre/abrir_pasta")
async def r_abrir(req):
    d = await req.json()
    try:
        return _j({"ok": core.abrir_pasta(d.get("path", ""))})
    except Exception as e:
        return _erro(e)


@rotas.post("/cofre/civitai")
async def r_civitai(req):
    d = await req.json()
    p = d.get("path", "")
    if not core._permitido(p):
        return _erro("arquivo não permitido")
    try:
        return _j(await _thread(core.consultar_civitai, p))
    except Exception as e:
        return _erro(e)


print(f"[Cofre] v{__version__} carregado — abra pela aba 'Cofre' na barra lateral do ComfyUI.")
