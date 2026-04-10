# Análise de Arquitetura - Projeto Mensalify

## Visão Geral do Projeto

- **Stack**: Next.js 14 (App Router), React, Supabase (Auth + DB)
- **ORM**: Supabase Client (sem ORM adicional como Drizzle/Prisma)
- **UI**: Shadcn UI + Framer Motion
- **Auth**: Supabase Auth via cliente browser

---

## 1. ARQUITETURA

### Avaliação Atual

| Aspecto | Status | Problema |
|---------|--------|-----------|
| Separação UI/Hooks | ⚠️ Ruim | Hooks fazem queries DB diretamente |
| Services Layer | ❌ Ausente | Lógica de negócio misturada com hooks |
| API Routes | ❌ Ausente | Não há API routes (pode ser intencional para MVP) |
| Camada DB | ⚠️ Ruim | Queries duplicadas em múltiplos hooks |

### Estrutura Atual
```
/app               → Páginas OK
/hooks             → DB + estado + lógica (problema)
/contexts          → Wrapper inútil (remover)
/lib               → Types, utils, supabase (bom)
/components       → UI components (bom)
```

### Problemas Identificados

1. **Hooks = Backend no Frontend**
   - `use-clients.ts` faz queries diretas ao Supabase
   - Mesma lógica duplicada em `use-payments.ts`
   - Impossível reutilizar lógica em API routes futuramente

2. **Contexts são wrappers desnecessários**
   - `clients-context.tsx` = wrapper do hook `useClients()`
   - `auth-context.tsx` = útil para auth, mas tem lógica demais

3. **Sem layer de services**
   - Não há onde colocar lógica de negócio reutilizável
   - Não há como testar lógica de negócio isolada

---

## 2. AUTENTICAÇÃO

### Análise do `auth-context.tsx`

| Aspecto | Avaliação | Nota |
|---------|-----------|------|
| Localização | Correta | Context é adequado para auth |
| Lógica de negócio | ⚠️ Muita | Login/register/logout têm muita lógica |
| Segurança | ⚠️ Risco | Tudo exposto no cliente |
| Session handling | ✅ Bom | Usa onAuthStateChange corretamente |

### Problemas de Segurança

1. **Auth completamente client-side**
   - Não há middleware para proteger rotas no servidor
   - `ProtectedRoute` é client-only (pode ser burlado)
   - Usuário não autenticado pode ver o dashboard brevemente antes do redirect

2. **Sem server-side validation**
   - Validação só no frontend (`login/page.tsx`)
   - API calls não validam sessão no servidor

3. **Exposição de lógica**
   - `fetchProfile` faz query direta ao DB
   - Lógica de timeout (10s) é arbitrária

### Recomendações Auth

```
PRIORIDADE ALTA:

1. Criar middleware.ts para proteção server-side
   - Verificar session cookie antes de renderizar
   - Redirect imediato para /login se não autenticado

2. Mover auth para services (futuro):
   - services/auth.ts → login, register, logout, updateProfile
   - Hook só chama service, não tem lógica
```

### Código do Middleware (recomendado):
```typescript
// middleware.ts na raiz
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: (name) => request.cookies.getAll(name),
        setAll: (cookies) => cookies.forEach(({ name, value }) => 
          response.cookies.set(name, value)
        ),
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

---

## 3. DESIGN DE API

### Situação Atual

- **Não há API routes** - O projeto usa chamadas diretas do cliente ao Supabase
- Para MVP isso é aceitável, mas tem limitações

### Quando API Routes faz sentido:

| Cenário | Recomendação |
|---------|--------------|
| MVP simples | Direct client → Supabase (atual) ✅ |
| Expor para mobile/app | API Routes necessários |
| Lógica server-side complexa | API Routes necessários |
| Rate limiting | API Routes necessários |
| Validação rigorosa | API Routes necessários |

### Se precisar de API Routes futuramente:
```
/app/api
├── auth/
│   ├── login/route.ts
│   └── register/route.ts
├── clients/
│   ├── route.ts       → GET, POST
│   └── [id]/route.ts  → GET, PUT, DELETE
└── payments/
    ├── route.ts
    └── [id]/route.ts
```

### Estrutura recomendada (quando implementar):
```typescript
// app/api/clients/route.ts
import { NextResponse } from 'next/server'
import { getClients } from '@/services/clients'

export async function GET() {
  // Apenas HTTP + chamar service
  const clients = await getClients(userId)
  return NextResponse.json({ clients })
}
```

**Regra de ouro**: API routes devem ter ~10 linhas, só HTTP e validação.

---

## 4. CAMADA DE SERVICES

### Situação Atual
- **Services layer NÃO existe**
- Lógica de negócio nos hooks
- Queries DB nos hooks

### O que precisa ser criado:

```
/services
├── auth.ts        → login, register, logout, updateProfile
├── clients.ts     → CRUD clients
├── payments.ts   → CRUD payments
└── stats.ts      → cálculos dashboard
```

### Service Example (`services/clients.ts`):
```typescript
import { supabase } from '@/lib/supabase'
import type { Client, ClientFormData } from '@/lib/types'

export async function getClients(userId: string): Promise<Client[]> {
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  return data || []
}

export async function createClient(userId: string, data: ClientFormData) {
  return supabase.from('clients').insert({
    user_id: userId,
    name: data.name.trim(),
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    monthly_price: Number(data.monthly_price),
  })
}

export async function updateClient(id: string, data: Partial<ClientFormData>) {
  return supabase
    .from('clients')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
}

export async function deleteClient(id: string) {
  return supabase.from('clients').delete().eq('id', id)
}
```

### Service Stats (`services/stats.ts`):
```typescript
import type { ClientWithStatus, DashboardStats, ChartData } from '@/lib/types'

export function calculateStats(clients: ClientWithStatus[]): DashboardStats {
  const paid = clients.filter(c => c.status === 'pago')
  const pending = clients.filter(c => c.status === 'pendente')

  return {
    totalReceived: paid.reduce((sum, c) => sum + c.monthly_price, 0),
    totalPending: pending.reduce((sum, c) => sum + c.monthly_price, 0),
    totalClients: clients.length,
    paidClients: paid.length,
    pendingClients: pending.length,
  }
}

export function calculateChartData(
  clients: ClientWithStatus[],
  payments: Payment[]
): ChartData[] {
  // lógica de gráfico aqui
  return months.map(...)
}
```

---

## 5. HOOKS

### Avaliação Atual

| Hook | Tamanho | Problema |
|------|---------|----------|
| `use-clients.ts` | 341 linhas | Queries DB + lógica + estado |
| `use-payments.ts` | 246 linhas | Queries DB + lógica + estado |
| `auth-context.tsx` | 246 linhas | Auth + estado (aceitável) |

### O que hooks DEVEM fazer:
```typescript
// BOM - hooks apenas gerenciam estado e effects
export function useClients() {
  const [clients, setClients] = useState<ClientWithStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Chama service, não faz query direta
  useEffect(() => {
    getClients(user.id).then(data => {
      setClients(enrichClientsWithStatus(data))
      setIsLoading(false)
    })
  }, [])

  // Wrapper que chama service
  const addClient = async (data: ClientFormData) => {
    return createClient(user.id, data)
  }

  return { clients, isLoading, addClient, ... }
}
```

### O que hooks NÃO DEVEM fazer:
```typescript
// RUIM - fazendo queries e lógica de negócio
const fetchClients = useCallback(async () => {
  const { data } = await supabase  // ❌ DB direto
    .from('clients')
    .select('*')
    .eq('user_id', userId)
  
  const clientsWithStatus = data.map(client => ({  // ❌ Lógica de negócio
    ...client,
    status: paymentStatus[client.id]?.paid ? 'pago' : 'pendente'
  }))
}, [])
```

---

## 6. DATABASE & SUPABASE

### Queries Atuais

| Arquivo | Queries | Problema |
|---------|---------|----------|
| `hooks/use-clients.ts` | 4+ | Queries duplicadas em outros hooks |
| `hooks/use-payments.ts` | 5+ | Queries duplicadas |
| `auth-context.tsx` | 2 | Profile fetch duplicado |

### Estrutura Atual (aceitável para MVP)
- Sem ORM (Supabase client direto)
- Queries simples
- Sem repository pattern necessário ainda

### Quando considerar ORM (Drizzle/Prisma):
- Quando schema crescer muito
- Quando precisar de migrations
- Quando queries ficarem complexas

### Por agora: services são suficientes

---

## 7. QUALIDADE DE CÓDIGO

### Funções Grandes Identificadas

| Arquivo | Linhas | Função | Problema |
|---------|--------|--------|----------|
| `use-clients.ts` | 341 | `fetchClients` | 40+ linhas, faz太多 |
| `use-clients.ts` | 341 | `getChartData` | 50+ linhas |
| `clients-table.tsx` | 290 | Componente |DesktopTable + MobileCards dentro |

### Código Duplicado

1. **Date handling** em `use-clients.ts`:
   ```typescript
   const getCurrentMonth = useCallback(() => { ... }, [])
   const getMonthKey = useCallback((date) => { ... }, [])
   // Duplicado em stats.ts ou deve ser utilitário
   ```

2. **Filter logic** em `clients/page.tsx` + `clients-table.tsx`:
   ```typescript
   // página tem lógica de busca
   // tabela também filtra
   // deve estar em um lugar só
   ```

3. **Toast handling** em múltiplos lugares

### Nomenclatura
- ✅ `useClients`, `usePayments` - convenção React
- ✅ `ClientWithStatus`, `DashboardStats` - types claros
- ⚠️ `fetchPaymentStatus`, `fetchAllPayments` - nomes muito similares
- ⚠️ `getStats`, `getChartData` - nomes genéricos

---

## 8. SEGURANÇA

### Riscos Identificados

| Risco | Severidade | Descrição |
|-------|------------|------------|
| Sem middleware | 🔴 Alta | Rotas não protegidas no servidor |
| Client-side only auth | 🟠 Média | Pode ser burlado |
| Exposed user data | 🟡 Baixa | Dados de usuário em client state |
| Input validation | 🟡 Baixa | Só client-side, sem sanitização server |

### Operações Sensíveis

O que está no cliente mas deveria estar no servidor:
1. ❌ Queries DB diretas - OK para Supabase (RLS faz proteção)
2. ⚠️ Profile update - precisa validar sessão
3. ✅ Auth já usa Supabase Auth (seguro)

### RLS (Row Level Security)
Verificar se está configurado no Supabase:
```sql
-- clients table
CREATE POLICY "Users can only see own clients"
ON clients FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert own clients"
ON clients FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

---

## 9. PLANO DE REFATORAÇÃO

### PRIORIDADE 1 - Segurança (FAZER AGORA)

| Ação | Esforço | Impacto |
|------|---------|---------|
| Criar middleware.ts | Baixo | Alto |
| Configurar RLS no Supabase | Médio | Alto |

```typescript
// middleware.ts - criar na raiz do projeto
```

### PRIORIDADE 2 - Services (FAZER EM 1 SEMANA)

| Ação | Esforço | Impacto |
|------|---------|---------|
| Criar `/services/clients.ts` | Médio | Alto |
| Criar `/services/payments.ts` | Médio | Alto |
| Criar `/services/stats.ts` | Baixo | Médio |
| Mover queries dos hooks para services | Médio | Alto |

### PRIORIDADE 3 - Limpeza (FAZER EM 2 SEMANAS)

| Ação | Esforço | Impacto |
|------|---------|---------|
| Remover `contexts/clients-context.tsx` | Baixo | Médio |
| Simplificar hooks para só estado UI | Médio | Médio |
| Extrair utils de data para `/lib` | Baixo | Baixo |

### PRIORIDADE 4 - Melhorias (OPCIONAL)

| Ação | Esforço | Impacto |
|------|---------|---------|
| Separar DesktopTable/MobileCards | Baixo | Baixo |
| Adicionar testes | Alto | Médio |
| API Routes (se precisar) | Alto | Médio |

---

## 10. ESTRUTURA IDEAL

### Após refatoração:

```
mensalify/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx           → providers + sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── clients/
│   │   │   └── page.tsx
│   │   ├── reports/
│   │   └── settings/
│   ├── api/                    → (futuro se precisar)
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── ui/                     → shadcn components
│   ├── dashboard/
│   │   ├── clients-table.tsx   → split DesktopTable/MobileCards
│   │   ├── stats-cards.tsx
│   │   ├── sidebar.tsx
│   │   └── ...
│   └── protected-route.tsx
│
├── contexts/                   → só auth (remover clients-context)
│   └── auth-context.tsx
│
├── hooks/                      → só estado UI + chamar services
│   ├── use-clients.ts         → refatorado
│   └── use-payments.ts       → refatorado
│
├── lib/
│   ├── supabase.ts            → cliente DB
│   ├── types.ts               → tipos
│   ├── utils.ts               → helpers
│   ├── validation.ts          → validação
│   └── constants.ts           → constantes
│
├── services/                  → NOVO: lógica de negócio
│   ├── auth.ts               → (futuro)
│   ├── clients.ts
│   ├── payments.ts
│   └── stats.ts
│
├── middleware.ts              → NOVO: proteção server-side
└── middleware.ts (futuro)
```

### Resumo das Mudanças:

| O que era | O que fica |
|-----------|-----------|
| `hooks/use-clients.ts` (341 linhas) | `services/clients.ts` + `hooks/use-clients.ts` simplificado |
| `contexts/clients-context.tsx` | ❌ Remover |
| `hooks/use-payments.ts` (246 linhas) | `services/payments.ts` + `hooks/use-payments.ts` simplificado |
| Queries diretas nos hooks | Queries nos services |
| Sem middleware | `middleware.ts` com proteção |

---

## CONCLUSÃO

| Aspecto | Nota | Prioridade |
|---------|------|------------|
| Arquitetura | 4/10 | Criar services |
| Auth | 6/10 | Adicionar middleware |
| API | N/A | Não precisa por agora |
| Services | 0/10 | Criar urgente |
| Hooks | 4/10 | Simplificar |
| DB | 7/10 | OK por agora |
| Segurança | 5/10 | Adicionar middleware |
| Código | 6/10 | Limpeza básica |

### ROI das mudanças:
1. **Middleware** - maior segurança com pouco esforço
2. **Services** - maior manutenibilidade, possibilida futura de API
3. **Limpar contexts** - código mais limpo, debugging mais fácil