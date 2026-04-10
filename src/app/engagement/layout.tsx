import WorkspaceShell from '@/components/workspace/WorkspaceShell'

export default function EngagementLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell requireAuth>{children}</WorkspaceShell>
}
