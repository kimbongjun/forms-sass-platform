import WorkspaceShell from '@/components/workspace/WorkspaceShell'

export default function SomeContentLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell requireAuth>{children}</WorkspaceShell>
}
