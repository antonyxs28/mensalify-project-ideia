# Mensalify

Sistema de gestão de assinaturas e cobranças recorrentes. Controle clientes, ciclos de cobrança e pagamentos em um só lugar.

## 🚀 Tecnologias

- **Next.js 16** (App Router)
- **TypeScript**
- **Supabase** (Auth + Database)
- **Tailwind CSS 4**
- **Radix UI** (componentes)
- **React Hook Form** + **Zod**
- **Recharts** (gráficos)
- **Framer Motion**

## ✨ Funcionalidades

- Autenticação de usuários (login/registro)
- CRUD completo de clientes
- Gestão de assinaturas (mensal, semanal, anual)
- Controle de ciclos de cobrança por período
- Registro e acompanhamento de pagamentos
- Dashboard com estatísticas e gráficos
- Relatórios de receita
- Configurações do usuário
- Design responsivo com tema escuro

## 🛠️ Como Rodar

```bash
# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Preencha as variáveis com suas credenciais do Supabase

# Rodar em desenvolvimento
pnpm dev
```

Acesse `http://localhost:3000`

## 📁 Estrutura

```
/app               - Rotas e páginas (Next.js App Router)
/components        - Componentes React (UI + dashboard)
/services          - Lógica de negócio (clientes, cobranças, pagamentos)
/hooks             - Hooks customizados
/supabase          - Schema do banco e migrações
```

## 🔮 Próximas Melhorias

- Envio de notificações por email
- Integração com gateways de pagamento (MercadoPago, Stripe)
- Exportação de relatórios (PDF/Excel)
- App mobile
- Multi-idioma