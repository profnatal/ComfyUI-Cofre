# Changelog

Todas as mudanças relevantes deste projeto ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.3.0] — 2026-11-22

### Adicionado
- Seletor **Conteúdo** nas abas Modelos, Saídas e Busca: todo o conteúdo, só não-NSFW ou só +18 (lembrado entre sessões).

## [1.2.0] — 2026-11-22

### Adicionado
- **Prévias de checkpoints e modelos de difusão sempre desfocadas** por padrão (pastas configuráveis).
- **Classificação manual**: botões 🔞 / ✅ / ↺ no cartão, três estados no detalhe e modo **Classificar em lote**.
- Filtros “Classificados por você” e “Ainda não classificados”.

### Melhorado
- Nomes de modelos são lidos separando camelCase e números (`pornmaster`, `version4NSFW`, `TurboNSFWBy`).
- A classificação manual de um modelo vale também para a imagem de prévia.

## [1.1.0] — 2026-11-22

### Adicionado
- **Modelos em grade de miniaturas** (P/M/G) ou lista, com barra lateral de pastas, famílias e discos e detalhe em janela.
- **Prévias dos modelos:** escolhida por você, arquivo ao lado do modelo, Civitai ou a última imagem gerada com ele.
- **Desfoque de conteúdo sensível** com revelar por item ou por sessão, marcação manual e lista de palavras editável.
- **Saídas em lista** (miniatura, modelo/LoRAs, seed, prompt, ações) além da grade; filtro de sensíveis; ordenação; itens por página.
- Visualizador com navegação ← →, **prompt negativo**, modelos e LoRAs usados.
- Saídas de **texto/JSON** com prévia formatada (texto ou binário decidido pelo conteúdo).
- **Civitai em lote**, com prévia, gatilhos, descrição, autor, tags, classificação adulta e aviso de versão nova.
- **Verificar atualizações** dos custom nodes (`git ls-remote`, só leitura).
- Rótulos **medido × ~ inferido** e **componentes** de checkpoints.
- **Discos desconectados** mantêm os modelos no índice como offline.
- Abas **Atividade** e **Configurações**; ordenação por idade na Limpeza.

### Corrigido
- O prompt positivo agora é separado do negativo (antes o texto mais longo era tomado como prompt).

## [1.0.0] — 2026-11-22

### Adicionado
- Aba lateral **Cofre** (ícone de cadeado) e atalho **Ctrl + Alt + V**.
- **Painel** com totais, uso de cada disco e modelos por categoria, disco e família.
- **Modelos:** leitura de cabeçalhos `.safetensors` e `.gguf` (família, precisão, parâmetros, integridade, gatilhos de LoRA), consulta opcional ao Civitai por hash e mover entre discos.
- **Workflows:** detecção de nodes e modelos faltando, com sugestões.
- **Custom nodes:** origem git, falhas de importação, pacotes instalados em duas pastas e pacotes que re-registram nodes de outros.
- **Saídas:** galeria com miniaturas, metadados de geração e carregar workflow a partir da imagem.
- **Limpeza:** duplicados, downloads incompletos, arquivos corrompidos e modelos não usados, com envio para a Lixeira freedesktop.
- **Busca** unificada.
