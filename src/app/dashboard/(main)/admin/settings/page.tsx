import { createServerClient, getUserRole } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminSettingsForm from './AdminSettingsForm'

export default async function AdminSettingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const role = await getUserRole(user.id)
  if (role !== 'administrator') redirect('/dashboard')

  const { data } = await supabase.from('site_settings').select('settings').eq('id', 1).single()
  const settings = data?.settings ?? {}

  return (
    <AdminSettingsForm
      initialSettings={settings}
      integrationStatus={{
        instagramAccessTokenConfigured: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN),
        instagramBusinessAccountConfigured: Boolean(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
      }}
    />
  )
}
