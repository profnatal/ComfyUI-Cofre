# Changelog

Todas as mudanças relevantes deste projeto ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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
