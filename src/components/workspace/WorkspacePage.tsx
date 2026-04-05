import Link from 'next/link'

interface WorkspacePageStat {
  label: string
  value: string
  helper?: string
}

interface WorkspacePageAction {
  href: string
  label: string
  variant?: 'primary' | 'secondary'
}

interface WorkspacePageProps {
  eyebrow: string
  title: string
  description?: string
  stats?: WorkspacePageStat[]
  actions?: WorkspacePageAction[]
  children?: React.ReactNode
}

export default function WorkspacePage({
  eyebrow,
  title,
  description,
  stats = [],
  actions = [],
  children,
}: WorkspacePageProps) {
  return (
    <div className="mx-auto max-w-8xl px-4 py-5 sm:px-6 sm:py-8">
      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">{eyebrow}</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
            {description && <p className="mt-3 text-sm leading-6 text-gray-500">{description}</p>}
          </div>

          {actions.length > 0 && (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              {actions.map((action) => (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className={[
                    'rounded-xl px-4 py-2.5 text-center text-sm font-medium transition-colors sm:text-left',
                    action.variant === 'secondary'
                      ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      : 'brand-btn',
                  ].join(' ')}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {stats.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">{stat.label}</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">{stat.value}</p>
                {stat.helper && <p className="mt-2 text-sm text-gray-500">{stat.helper}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}
