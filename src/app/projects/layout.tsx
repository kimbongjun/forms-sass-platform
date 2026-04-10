import WorkspaceShell from '@/components/workspace/WorkspaceShell'

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell requireAuth>{children}</WorkspaceShell>
}
