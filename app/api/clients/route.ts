import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'

interface Client {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  monthly_price: number
  created_at: string
  updated_at: string | null
}

interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

// Authenticate and get supabase client with session
async function getAuthenticatedContext(): Promise<{ supabase: ReturnType<typeof createServerClient>, userId: string }> {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  console.log('[AUTH] Cookies present:', allCookies.map(c => c.name))
  
  // First: try cookies from SSR
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
  
  let { data: { user }, error } = await supabase.auth.getUser()
  console.log('[AUTH] getAuthenticatedUser (cookies) - User:', user?.id || 'none', 'error:', error?.message)
  
  // Fallback: use Authorization header token
  if (!user) {
    const headersList = await headers()
    const authHeader = headersList.get('authorization')
    const refreshToken = headersList.get('x-refresh-token') // Try to get refresh token
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      console.log('[AUTH] Trying token from Authorization header')
      console.log('[AUTH] Refresh token available:', !!refreshToken)
      
      // Validate token first
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      console.log('[AUTH] getAuthenticatedUser (token) - User:', tokenUser?.id || 'none', 'error:', tokenError?.message)
      
      if (tokenUser && !tokenError) {
        // Set session so RLS can use auth.uid()
        // If we have refresh token, use it; otherwise try with empty (might work for some cases)
        const refreshTok = refreshToken || ''
        
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshTok
        })
        
        console.log('[AUTH] Session set for RLS, error:', setSessionError?.message || 'none')
        
        return { supabase, userId: tokenUser.id }
      }
    }
  }
  
  if (error || !user) {
    throw new Error('Unauthorized')
  }
  
  return { supabase, userId: user.id }
}

async function getClientsByUserId(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<ServiceResult<Client[]>> {
  console.log('[DEBUG] Querying for user_id:', userId)
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  console.log('[DEBUG] Supabase select result:', JSON.stringify(data))
  console.log('[DEBUG] Supabase select error:', error ? JSON.stringify(error) : 'null')

  if (error) {
    console.error('[DB] getClientsByUserId - Full error:', JSON.stringify(error))
    return { success: false, error: `Database error: ${error.message}` }
  }

  console.log('[DB] getClientsByUserId - Got data:', data?.length || 0, 'records')
  return { success: true, data: data || [] }
}

async function createClientInDb(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  data: { name: string; email?: string; phone?: string; monthlyPrice: number }
): Promise<ServiceResult<Client>> {
  const insertData = {
    user_id: userId,
    name: data.name.trim(),
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    monthly_price: data.monthlyPrice
  }
  
  console.log('[DEBUG] Insert data:', JSON.stringify(insertData))
  
  const { data: result, error } = await supabase
    .from('clients')
    .insert(insertData)
    .select()
    .single()

  console.log('[DEBUG] Supabase insert result:', result ? JSON.stringify(result) : 'null')
  console.log('[DEBUG] Supabase insert error:', error ? JSON.stringify(error) : 'null')

  if (error) {
    console.error('[DB] createClientInDb - Full error:', JSON.stringify(error))
    console.error('[DB] createClientInDb - Error code:', error.code)
    return { success: false, error: `Failed to create client: ${error.message}` }
  }

  console.log('[DB] createClientInDb - Result:', JSON.stringify(result))
  return { success: true, data: result }
}

export async function GET() {
  try {
    console.log('[API] GET /clients - Starting')
    
    const { supabase, userId } = await getAuthenticatedContext()
    console.log('[API] GET /clients - User ID:', userId)
    
    console.log('[API] GET /clients - Fetching for user_id:', userId)
    const result = await getClientsByUserId(supabase, userId)
    
    console.log('[API] GET /clients - Result:', JSON.stringify(result))
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    console.log('[API] GET /clients - Success, count:', result.data?.length || 0)
    return NextResponse.json({ data: result.data })
  } catch (error) {
    console.error('[API] GET /clients - Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    console.log('[API] POST /clients - Starting')
    
    const { supabase, userId } = await getAuthenticatedContext()
    console.log('[API] POST /clients - User ID:', userId)
    
    let body: { name?: unknown; monthlyPrice?: unknown; email?: unknown; phone?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    console.log('[DEBUG] Request body:', JSON.stringify(body))

    const name = typeof body.name === 'string' ? body.name.trim() : body.name
    const monthlyPrice = body.monthlyPrice

    console.log('[API] POST /clients - Parsed name:', name, 'price:', monthlyPrice)

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const priceNum = typeof monthlyPrice === 'string' || typeof monthlyPrice === 'number' ? Number(monthlyPrice) : NaN
    if (!priceNum || priceNum <= 0 || isNaN(priceNum)) {
      return NextResponse.json({ error: 'Valid monthly price is required' }, { status: 400 })
    }

    console.log('[API] POST /clients - Calling createClientInDb with user.id:', userId)
    const result = await createClientInDb(supabase, userId, {
      name,
      email: typeof body.email === 'string' ? body.email : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      monthlyPrice: priceNum
    })

    console.log('[DEBUG] Supabase response result:', JSON.stringify(result))
    console.log('[API] POST /clients - Result:', JSON.stringify(result))

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    console.log('[API] POST /clients - Success, id:', result.data?.id)
    return NextResponse.json({ data: result.data }, { status: 201 })
  } catch (error) {
    console.error('[API] POST /clients - Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}