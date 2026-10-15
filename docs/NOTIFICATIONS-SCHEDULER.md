# NEXO — agendamento independente

A rotina existente `scripts/nexo-notify.mjs` é executada diretamente por um serviço Railway Cron, sem GitHub Actions. O Dropbox permanece como fonte dos dados e inscrições push.

## Configuração

1. Criar serviço **exclusivo NEXO** no Railway a partir deste repositório/branch, sem reutilizar os projetos VINISWIM.
2. Configurar variáveis privadas **NEXO_DROPBOX_REFRESH_TOKEN** e **NEXO_VAPID_PRIVATE_KEY** no serviço. Nunca inserir os valores no GitHub.
3. Configurar cron `0 11,15 * * *` (UTC = 08h e 12h America/Sao_Paulo, enquanto o Brasil permanecer UTC-3).
4. Confirmar nos logs os resultados `sent=` e `failed=` e realizar teste controlado com vencimento elegível e dispositivo ativo.
5. Somente depois de comprovar o novo executor, desabilitar o agendamento antigo em `.github/workflows/nexo-notifications.yml` para evitar disparos duplicados.

## Limitações identificadas na rotina atual

- O processo considera sucesso quando não há dispositivos ou vencimentos elegíveis; isso **não comprova entrega**.
- A rotina não persiste idempotência por dispositivo/janela. Antes de habilitar produção, implementar bloqueio durável para reexecuções e concorrência.
- A rotina retorna erro apenas se todos os envios falharem; falhas parciais devem ser observadas.
- Ausência de segredos atualmente encerra com código zero: deve ser corrigida antes da ativação.

**Estado:** configuração preparada; serviço não implantado; workflow antigo não modificado.
