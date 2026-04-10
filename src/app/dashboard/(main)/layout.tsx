import WorkspaceShell from '@/components/workspace/WorkspaceShell'

export default function DashboardMainLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell requireAuth>{children}</WorkspaceShell>
}
