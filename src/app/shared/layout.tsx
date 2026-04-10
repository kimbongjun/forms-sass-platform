import WorkspaceShell from '@/components/workspace/WorkspaceShell'

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell requireAuth>{children}</WorkspaceShell>
}
