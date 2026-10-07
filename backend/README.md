# Backend de Auditoria Operacional

Backend novo para regras de contagem por produto, geração de disparos operacionais e endpoints mobile/admin.

## Estrutura

- `src/modules/operational-alerts`
  - `types`
  - `repository`
  - `service`
  - `scheduler`
  - `controller`
  - `routes`
- `sql/schema.sql`

## Recursos entregues

- cadastro de regras de contagem por produto/unidade/usuário
- geração automática de disparos:
  - `diario`
  - `quinzenal`
  - `mensal`
- vencimento automático de alertas
- endpoints mobile:
  - `GET /mobile/operational-alerts`
  - `POST /mobile/operational-alerts/:id/start`
  - `POST /mobile/operational-alerts/:id/complete`
  - `POST /mobile/operational-alerts/:id/expire`
- endpoints administrativos:
  - `GET /admin/operational-rules`
  - `POST /admin/operational-rules`
  - `PATCH /admin/operational-rules/:id`
  - `GET /admin/operational-alerts`
  - `GET /admin/operational-alerts/dashboard-summary`
  - `POST /admin/operational-alerts/run-scheduler`

## Como subir

1. Instale as dependências:

```powershell
cd backend
npm.cmd install
```

2. Use o banco já existente `auditoria_estoque` e aplique apenas o schema do módulo:

```sql
\i sql/schema.sql
```

3. Crie o `.env` com base em `.env.example`

4. Rode em desenvolvimento:

```powershell
npm.cmd run dev
```

## Observações

- O scheduler roda em memória via `setInterval`.
- A primeira execução do scheduler já tenta gerar disparos e vencer alertas atrasados.
- O vínculo com a auditoria do app é salvo em `linked_audit_session_id`.
- O schema foi preparado para reutilizar o banco existente e adicionar apenas as tabelas novas do módulo.
- A listagem mobile aceita `userId` e `unitId` via query string.
