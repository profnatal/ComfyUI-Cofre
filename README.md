<div align="center">

# 🔐 ComfyUI-Cofre

**Painel local para inventariar, diagnosticar e organizar sua biblioteca do ComfyUI — feito para Linux.**

*A local, Linux-first library manager for ComfyUI — models, workflows, custom nodes and outputs.*
*[English summary below](#-english-summary).*

![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green)
![Linux](https://img.shields.io/badge/plataforma-Linux-orange?logo=linux&logoColor=white)
![ComfyUI](https://img.shields.io/badge/testado%20no%20ComfyUI-0.45-blue)
![Sem dependências](https://img.shields.io/badge/depend%C3%AAncias%20extras-nenhuma-brightgreen)

</div>

---

## 📖 Sumário

- [O que é](#-o-que-é)
- [Recursos](#-recursos)
- [Diagnósticos que o Cofre faz](#-diagnósticos-que-o-cofre-faz)
- [Por que "otimizado para Linux"?](#-por-que-otimizado-para-linux)
- [Instalação](#-instalação)
- [Uso](#-uso)
- [Segurança e privacidade](#-segurança-e-privacidade)
- [Como funciona por dentro](#-como-funciona-por-dentro)
- [Perguntas frequentes](#-perguntas-frequentes)
- [Solução de problemas](#-solução-de-problemas)
- [Compatibilidade](#-compatibilidade)
- [Roteiro](#-roteiro)
- [Contribuindo](#-contribuindo)
- [English summary](#-english-summary)
- [Licença](#-licença)

---

## 🔎 O que é

Quem usa o ComfyUI por algum tempo acaba com centenas de modelos espalhados por vários discos, dezenas de workflows baixados de lugares diferentes e uma pasta `custom_nodes` que ninguém mais sabe direito o que contém.

O **Cofre** roda **dentro do ComfyUI**, como uma aba na barra lateral, e responde às perguntas do dia a dia:

- Que modelos eu tenho, de qual família, quanto ocupam e **em qual disco**?
- Este workflow vai rodar? **Falta algum node ou modelo?** Tenho algo parecido já baixado?
- Quais custom nodes **falharam ao carregar**? Algum pacote está **instalado duas vezes**?
- Onde está aquela imagem que gerei semana passada, e **qual foi o prompt e a seed**?
- O que posso apagar com segurança? Tenho **duplicados**? Algum download ficou **incompleto ou corrompido**?

Ele lê o que o próprio ComfyUI já sabe — inclusive as pastas extras do `extra_model_paths.yaml`, como um SSD interno e um HD externo — e **tudo fica na sua máquina**.

---

## ✨ Recursos

| Aba | O que faz |
|---|---|
| 📊 **Painel** | Totais da biblioteca, uso de cada disco (com o rótulo do disco), modelos por categoria, por disco e por família, e um resumo dos problemas encontrados. |
| 🧠 **Modelos** | **Grade de miniaturas** (tamanho P/M/G) ou **lista**, com barra lateral de **pastas, famílias e discos**. Lê o **cabeçalho** de `.safetensors` e `.gguf` sem carregar os pesos: família (Flux 1/2, SDXL, SD 1.5, SD3, Z-Image/Lumina2, Qwen-Image, WAN, HunyuanVideo, VAE, T5, CLIP, LLMs…), papel, precisão/quantização, nº de parâmetros, **integridade**, palavras-gatilho de LoRAs e em quais workflows cada modelo é usado. |
| 🧩 **Workflows** | Verifica cada workflow salvo (inclusive subgrafos e *group nodes*): **nodes que faltam**, com o pacote provável, e **modelos que faltam**, com sugestões parecidas que você já tem. Botão **Abrir no ComfyUI**. |
| 🔌 **Custom nodes** | Origem git (URL, branch e commit, lidos direto da pasta `.git`), requisitos, nodes registrados, tamanho, em quantos workflows cada pacote é usado e quais **não carregaram**. |
| 🖼️ **Saídas** | Imagens, vídeos, áudios e **textos/JSON** em **grade** ou **lista** detalhada. Extrai **prompt positivo e negativo, seed, passos, CFG, sampler, modelo e LoRAs usados**. Visualizador com navegação ← →, busca e **Carregar workflow desta imagem**. |
| 🧹 **Limpeza** | Duplicados, downloads incompletos (`.incomplete`, `.part`), arquivos corrompidos, modelos que nenhum workflow usa, maiores arquivos e pastas de saída que mais ocupam. **Nada é apagado de vez** — tudo vai para a **Lixeira do sistema**. |
| 🔎 **Busca** | Uma busca única em modelos, workflows, nodes e saídas. |
| 📜 **Atividade** | Registro de tudo o que o Cofre alterou ou consultou (lixeira, mover, Civitai, marcações). |
| ⚙️ **Configurações** | Desfoque de conteúdo sensível, lista de palavras, consultas ao Civitai. |

### 🖼️ Prévias dos modelos

Cada modelo ganha uma capa, escolhida nesta ordem:

1. **Imagem escolhida por você** — no detalhe do modelo aparecem as imagens que você gerou com ele; um clique define a capa.
2. **Arquivo ao lado do modelo** com o mesmo nome (`modelo.preview.png`, `modelo.png`, `.jpg`, `.webp`…), padrão usado por outros gerenciadores.
3. **Prévia do Civitai**, baixada quando você consulta o modelo (fica em `user/cofre/previas`).
4. **A imagem mais recente que você gerou** usando aquele modelo ou LoRA.

Sem nenhuma delas, o cartão mostra um ícone da categoria sobre a cor da família.

### 🔞 Conteúdo sensível

Imagens sensíveis ficam **desfocadas** nas miniaturas, nas capas dos modelos e no visualizador. Um clique revela só aquele item; o botão **👁️ Mostrar sensíveis** revela tudo apenas nesta sessão. O Cofre decide nesta ordem:

1. Sua **classificação manual** (🔞 sensível / ✅ seguro), que sempre vale.
2. **Civitai:** modelo marcado como adulto pelo autor.
3. **Palavras** no prompt **positivo** (o negativo é ignorado — “nsfw” no negativo não marca nada) e no nome ou nas tags de treino do modelo. A lista é editável.
4. **Modelos usados:** uma imagem gerada com um LoRA sensível também é marcada.

O seletor **Conteúdo** (abas Modelos, Saídas e Busca) lista **🔓 todo o conteúdo**, **✅ só não-NSFW** ou **🔞 só +18**, e a escolha fica lembrada entre as sessões.

**Pastas sempre desfocadas:** por padrão, as prévias de **checkpoints** e **modelos de difusão** (`diffusion_models`, `unet`) ficam sempre desfocadas, porque costumam vir de galerias com conteúdo adulto. A lista de pastas é configurável.

**Classificação manual:** passe o mouse num cartão e use **🔞 / ✅ / ↺** (sensível, seguro, automático), ou ative **☑ Classificar em lote**, selecione vários cartões e aplique de uma vez. A sua classificação vale para o modelo e para a prévia, e os filtros “Classificados por você” e “Ainda não classificados” ajudam a revisar a biblioteca.

Nomes de arquivo são lidos separando camelCase e números, então `pornmaster`, `version4NSFW` e `TurboNSFWBy` são reconhecidos.

### 🌐 Civitai (opcional)

Por modelo ou em lote (“Buscar prévias no Civitai” na lista atual): o Cofre calcula o SHA256 no seu disco e envia **só o hash**. Traz prévia, gatilhos (clique para copiar), descrição, autor, tags, classificação adulta e o aviso **⬆️ versão nova disponível**. Pode ser desligado nas Configurações.

**Ações disponíveis em cada modelo:** abrir a pasta no gerenciador de arquivos, **consultar o Civitai pelo hash** (opcional), **mover para outro disco** mantendo a subpasta (o modelo continua visível para o ComfyUI) e enviar para a Lixeira.

---

## 🩺 Diagnósticos que o Cofre faz

| Sinal | O que significa |
|---|---|
| ⛔ **Arquivo truncado** | O tamanho declarado no cabeçalho do `.safetensors` não bate com o tamanho real — típico de download interrompido. Baixe de novo. |
| 👯 **Duplicado** | Mesmo conteúdo em dois caminhos. Cópias **no mesmo disco** vêm pré-marcadas para limpeza; cópias **em discos diferentes** ficam desmarcadas, pois podem ser backup intencional. Links simbólicos e *hard links* não contam como duplicado. |
| ⚠️ **Modelo completo na pasta de LoRAs?** | O arquivo é grande demais e tem a estrutura de um modelo base. Provavelmente foi salvo na pasta errada. |
| ⬆️ **Atualização disponível** | O commit instalado do custom node é diferente do remoto (`git ls-remote`, só leitura). |
| ⏏️ **Disco desconectado** | O HD externo não está montado. Os modelos dele continuam no índice, marcados como offline. |
| 🧱 **Componentes** | Checkpoints completos mostram quanto de cada parte trazem (difusão, VAE, codificadores de texto). |
| 🔁 **Pacote instalado duas vezes** | Duas pastas em `custom_nodes` apontam para o mesmo repositório ou registram os mesmos nodes (ex.: `ComfyUI-KJNodes` e `comfyui-kjnodes`). Causa conflito de versão. |
| ⚠️ **Re-registra nodes de outros pacotes** | O pacote sobrescreve nodes que pertencem a outros pacotes. Pode mudar o comportamento de workflows sem aviso. |
| ❌ **Falhou ao importar** | O pacote está na pasta, mas o ComfyUI não conseguiu carregá-lo (lido do log de inicialização). |
| 🧩 **Node faltando** | O workflow usa um node que não está instalado. O Cofre indica o pacote provável. |
| 📦 **Modelo faltando** | O workflow pede um arquivo que não existe na biblioteca. O Cofre sugere nomes parecidos que você já tem. |

---

## 🐧 Por que "otimizado para Linux"?

- Identifica discos e rótulos por `/proc/mounts` e `/dev/disk/by-label` — você vê "SSD" e "HD Externo", não UUIDs.
- Lixeira no padrão **freedesktop.org**, a mesma do Nautilus, Dolphin, Thunar e Nemo, com a pasta correta em cada disco (`~/.local/share/Trash` ou `<disco>/.Trash-<uid>`). Tudo é restaurável pelo gerenciador de arquivos.
- "Abrir pasta" usa `xdg-open`; miniaturas de vídeo usam `ffmpeg` (opcional).
- Mover modelos entre discos com cópia em blocos, `fsync`, conferência de tamanho e **só então** remoção do original.
- Não sobe processo extra, não abre porta extra e não precisa de PyTorch extra: usa o próprio servidor do ComfyUI.

---

## 📦 Instalação

### Manual (recomendado)

```bash
cd ~/ComfyUI/custom_nodes        # ajuste para o caminho da sua instalação
git clone https://github.com/profnatal/ComfyUI-Cofre
```

Reinicie o ComfyUI. **Não há dependências Python extras.**

Opcional, para miniaturas de vídeo:

```bash
sudo apt install ffmpeg          # Debian/Ubuntu
sudo dnf install ffmpeg          # Fedora
sudo pacman -S ffmpeg            # Arch
```

### Pelo ComfyUI-Manager

Procure por **ComfyUI-Cofre** (quando publicado no registro) ou use **Install via Git URL** com o endereço acima.

### Atualizar

```bash
cd ~/ComfyUI/custom_nodes/ComfyUI-Cofre && git pull
```

---

## 🚀 Uso

1. Clique no ícone de **cadeado (Cofre)** na barra lateral do ComfyUI — ou pressione **Ctrl + Alt + V**.
2. Clique em **🔄 Atualizar índice**. Na primeira vez pode levar alguns minutos em bibliotecas grandes; depois, só o que mudou é relido (segundos).
3. Navegue pelas abas:
   - Clique numa linha de **modelo** para ver detalhes e ações.
   - Clique numa **miniatura** para ver os metadados da imagem e carregar o workflow dela.
   - Na **Limpeza**, marque o que quiser remover e clique em **Enviar selecionados para a Lixeira**.

> 💡 **Dica:** rode **Atualizar índice** sempre que baixar modelos novos ou instalar custom nodes.

---

## 🔒 Segurança e privacidade

- Lê apenas **cabeçalhos** de `.safetensors` e `.gguf`. Arquivos `.pt`, `.pth`, `.ckpt` e `.bin` (formato *pickle*) **não são abertos**, pois podem executar código.
- O código dos custom nodes **não é executado** pelo Cofre — ele só lê metadados, a pasta `.git` e o que o ComfyUI já carregou.
- Exclusões e movimentações **exigem confirmação** e só acontecem **dentro das pastas de modelos e de saída** do ComfyUI. Cada ação fica registrada (`user/cofre/cofre.db`, tabela `log`).
- Chamadas externas só acontecem quando você clica: a consulta ao Civitai (envia apenas o SHA256) e a verificação de atualizações dos custom nodes (`git ls-remote`, que não baixa nem altera nada).
- O banco (SQLite) e as miniaturas ficam em `ComfyUI/user/cofre/`. Para zerar o Cofre, apague essa pasta.

---

## ⚙️ Como funciona por dentro

```
ComfyUI-Cofre/
├── __init__.py      # rotas HTTP (/cofre/...) no servidor do ComfyUI
├── core.py          # indexação, análise de modelos, diagnósticos, lixeira, mover
└── web/cofre.js     # interface (aba lateral + painel em tela cheia)
```

- **Índice:** SQLite em `ComfyUI/user/cofre/cofre.db` (tabelas `modelos`, `workflows`, `nodes`, `saidas`, `marcas`, `atualizacoes`, `log`, `config`).
- **Medido × inferido:** como no Asset Vault, cada informação do modelo indica a origem — **medido** (lido do arquivo, em âmbar) ou **~ inferido** (pelo nome ou pela pasta, em violeta). A indexação roda em segundo plano e não trava o ComfyUI.
- **Impressão digital rápida:** SHA-1 de tamanho + 1 MB do início, do meio e do fim de cada arquivo. Detecta duplicados em segundos, mesmo com centenas de GB. O SHA256 completo só é calculado sob demanda (consulta ao Civitai).
- **Links e atalhos:** arquivos alcançados por mais de um caminho (symlinks, bind mounts) são reconhecidos pelo par `(st_dev, st_ino)` e contados uma vez só.
- **Rotas da API:** `/cofre/resumo`, `/cofre/estado`, `/cofre/indexar`, `/cofre/modelos`, `/cofre/workflows`, `/cofre/nodes`, `/cofre/saidas`, `/cofre/limpeza`, `/cofre/busca`, `/cofre/miniatura`, `/cofre/lixeira`, `/cofre/destinos`, `/cofre/mover`, `/cofre/abrir_pasta`, `/cofre/civitai`, `/cofre/civitai_lote`, `/cofre/facetas`, `/cofre/previa`, `/cofre/saidas_do_modelo`, `/cofre/texto`, `/cofre/marcar`, `/cofre/config`, `/cofre/atualizacoes`, `/cofre/atividade`.

O Cofre **não adiciona nodes** ao grafo — ele é só uma ferramenta de gestão.

---

## ❓ Perguntas frequentes

**Ele apaga arquivos?**
Não de forma definitiva. Tudo vai para a Lixeira do sistema e pode ser restaurado pelo gerenciador de arquivos. Para liberar espaço de verdade, esvazie a Lixeira depois de conferir.

**Funciona com modelos no HD externo?**
Sim. Ele lê as pastas do `extra_model_paths.yaml` e mostra em qual disco cada arquivo está. A Lixeira de cada disco externo é usada corretamente.

**Por que um modelo aparece como "não usado"?**
Nenhum workflow **salvo** o referencia. Pode ser um modelo que você usa só em workflows não salvos, ou um que realmente pode ir embora.

**Mover um modelo quebra meus workflows?**
Não, desde que o destino seja uma pasta que o ComfyUI enxerga (o Cofre só oferece essas). Os workflows guardam o nome do arquivo relativo à categoria, não o caminho completo.

**Envia dados para algum lugar?**
Não. A consulta ao Civitai é opcional, acontece só com o seu clique e envia apenas o hash.

---

## 🛠️ Solução de problemas

| Sintoma | O que fazer |
|---|---|
| O ícone do cadeado não aparece | Confira se a pasta está em `ComfyUI/custom_nodes/ComfyUI-Cofre`, reinicie o ComfyUI e recarregue a página com **Ctrl + Shift + R**. |
| O índice parece desatualizado | Clique em **🔄 Atualizar índice**. Para começar do zero, apague `ComfyUI/user/cofre/`. |
| Sem miniaturas de vídeo | Instale o `ffmpeg` (veja [Instalação](#-instalação)). |
| "Abrir pasta" não faz nada | Verifique se `xdg-open` funciona no terminal. Em servidores sem interface gráfica essa ação não está disponível. |
| Erro ao mover para outro disco | Confira se há espaço livre no destino e se o disco está montado com permissão de escrita. O original só é removido depois de a cópia ser conferida. |

---

## 🧩 Compatibilidade

- Testado em **Ubuntu** com ComfyUI 0.45, frontend 1.58 e Python 3.14, com uma biblioteca de ~300 modelos (≈730 GB) em dois discos.
- Deve funcionar em qualquer distribuição Linux.
- macOS: a maior parte funciona; Lixeira e identificação de discos seguem o padrão Linux.
- Windows: não é o foco deste projeto.

---

## 🛣️ Roteiro

- [ ] Instalar o pacote que falta direto da aba Workflows (via ComfyUI-Manager).
- [ ] Exportar o inventário em CSV.
- [ ] Busca semântica opcional por prompt.
- [ ] Prévia de modelos 3D (`.glb`).
- [ ] Tradução da interface para inglês.

Sugestões são bem-vindas nas [Issues](https://github.com/profnatal/ComfyUI-Cofre/issues).

---

## 🤝 Contribuindo

1. Faça um *fork* e crie um branch: `git checkout -b minha-melhoria`.
2. Mantenha o projeto **sem dependências extras** e **sem executar código de terceiros**.
3. Teste com **Atualizar índice** numa biblioteca real antes de abrir o *pull request*.
4. Descreva o que mudou e por quê.

Relatos de bugs são muito úteis: informe a distro, a versão do ComfyUI e, se possível, o trecho do log do terminal.

---

## 🌎 English summary

**ComfyUI-Cofre** ("vault") is a local, Linux-first library manager that lives in the ComfyUI sidebar.

- **Models:** safetensors/GGUF header inspection — family, precision, parameter count, **integrity (truncated downloads)**, LoRA trigger words, and which workflows use each model. Open folder, optional Civitai lookup by hash, **move between disks** (e.g. external HDD → internal SSD), send to Trash.
- **Workflows:** finds **missing nodes** (with the likely pack) and **missing models** (with similar files you already have). One-click open.
- **Custom nodes:** git origin and commit, registered nodes, **load failures**, **packs installed twice**, packs that **override other packs' nodes** — without executing their code.
- **Outputs:** gallery with cached thumbnails, prompt/seed/model metadata, search and **load workflow from image**.
- **Thumbnails & privacy:** model grid with previews (your pick, sidecar image, Civitai, or your latest render with that model), list/grid for outputs, and **automatic blur for NSFW content** (manual mark, Civitai flag, positive-prompt keywords, or NSFW models used).
- **Civitai (opt-in):** previews, trigger words, description, adult flag and **newer version available** — only the hash is sent.
- **Cleanup:** duplicates (same-disk copies pre-selected; cross-disk copies left alone as likely backups), incomplete downloads, unused models — all moved to the **freedesktop Trash**, so everything is restorable.

No extra Python dependencies, no extra server or port, nothing uploaded.

**Install:** `git clone https://github.com/profnatal/ComfyUI-Cofre` into `ComfyUI/custom_nodes`, restart ComfyUI, then open it with the lock icon or **Ctrl + Alt + V**.

---

## 📄 Licença

[MIT](LICENSE) © 2026 Jhon Kleiton Natal ([@profnatal](https://github.com/profnatal))
