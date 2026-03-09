import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Daily ping to keep the Supabase project active (free tier pauses after inactivity)
export async function GET(request: Request) {
  // Verify the request comes from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Simple query to keep the database active
    const { data, error } = await supabase
      .from('assistants')
      .select('id')
      .limit(1)

    if (error) {
      console.error('Keep-alive ping failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Keep-alive ping successful:', new Date().toISOString())
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      rows: data?.length ?? 0,
    })
  } catch (error) {
    console.error('Keep-alive error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
