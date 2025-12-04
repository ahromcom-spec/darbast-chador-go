import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. حذف آدرس‌هایی که بیش از ۱ ساعت از ایجادشان گذشته و هیچ پروژه‌ای ندارند
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    // دریافت آدرس‌های قدیمی بدون پروژه
    const { data: emptyOldLocations, error: fetchError } = await supabase
      .from('locations')
      .select(`
        id,
        created_at,
        projects_hierarchy!left(id)
      `)
      .lt('created_at', oneHourAgo)
      .is('is_active', true)

    if (fetchError) {
      console.error('Error fetching locations:', fetchError)
      throw fetchError
    }

    // فیلتر آدرس‌هایی که پروژه ندارند
    const locationsToDelete = emptyOldLocations?.filter(loc => 
      !loc.projects_hierarchy || loc.projects_hierarchy.length === 0
    ) || []

    let deletedCount = 0

    if (locationsToDelete.length > 0) {
      const idsToDelete = locationsToDelete.map(loc => loc.id)
      
      // حذف نرم (غیرفعال کردن)
      const { error: deleteError } = await supabase
        .from('locations')
        .update({ is_active: false })
        .in('id', idsToDelete)

      if (deleteError) {
        console.error('Error deleting empty locations:', deleteError)
        throw deleteError
      }

      deletedCount = idsToDelete.length
      console.log(`Deactivated ${deletedCount} empty locations older than 1 hour`)
    }

    // 2. حذف آدرس‌هایی که همه پروژه‌هایشان حذف/رد شده یا بسته شده
    const { data: locationsWithProjects, error: fetchError2 } = await supabase
      .from('locations')
      .select(`
        id,
        projects_hierarchy(
          id,
          orders:projects_v3(id, status)
        )
      `)
      .is('is_active', true)

    if (fetchError2) {
      console.error('Error fetching locations with projects:', fetchError2)
      throw fetchError2
    }

    let additionalDeleted = 0

    for (const location of locationsWithProjects || []) {
      const projects = location.projects_hierarchy || []
      
      // اگر پروژه دارد، بررسی کن که آیا همه سفارش‌ها حذف یا رد شده‌اند
      if (projects.length > 0) {
        let hasActiveOrders = false
        
        for (const project of projects) {
          const orders = (project as any).orders || []
          
          // اگر سفارشی دارد که وضعیتش rejected یا closed نیست
          for (const order of orders) {
            if (order.status !== 'rejected' && order.status !== 'closed') {
              hasActiveOrders = true
              break
            }
          }
          
          if (hasActiveOrders) break
        }
        
        // اگر همه سفارش‌ها غیرفعال هستند، آدرس را حذف کن
        if (!hasActiveOrders && projects.every((p: any) => p.orders?.length === 0 || p.orders?.every((o: any) => o.status === 'rejected' || o.status === 'closed'))) {
          const { error: deactivateError } = await supabase
            .from('locations')
            .update({ is_active: false })
            .eq('id', location.id)

          if (!deactivateError) {
            additionalDeleted++
          }
        }
      }
    }

    console.log(`Total cleanup: ${deletedCount + additionalDeleted} locations deactivated`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `پاکسازی انجام شد`,
        deletedEmptyOld: deletedCount,
        deletedNoActiveOrders: additionalDeleted
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Cleanup error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})