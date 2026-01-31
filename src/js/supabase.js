import { createClient } from '@supabase/supabase-js'

// TODO: Replace with actual URL and Key from User or keep as placeholder until provided
const supabaseUrl = 'https://cnyhczcaancznxzhdyyg.supabase.co'
const supabaseKey = 'sb_publishable_G14e0sTRgPAF96vxw8Zv3w_p1X_rQ_A'

export const supabase = createClient(supabaseUrl, supabaseKey)
