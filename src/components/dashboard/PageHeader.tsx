import { useState, useEffect } from 'react'

interface Tab {
  id: string
  label: string
  href: string
}

interface PageHeaderProps {
  title: string
  status?: string
  tabs?: Tab[]
  activeTab?: string
  showSearch?: boolean
  searchPlaceholder?: string
  onSearch?: (query: string) => void
}

export default function PageHeader({
  title,
  status,
  tabs = [],
  activeTab,
  showSearch = true,
  searchPlaceholder = 'Buscar...',
  onSearch
}: PageHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    setCurrentPath(window.location.pathname)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSearch) {
      onSearch(searchQuery)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6 overflow-hidden">
      {/* Fila superior */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {/* Izquierda: Logo, título y status */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {title.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {status && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-md text-sm font-medium border border-green-200">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{status}</span>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
          </div>

          {/* Derecha: Búsqueda */}
          {showSearch && (
            <form onSubmit={handleSearch} className="hidden md:block">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={searchPlaceholder}
                />
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="px-6 border-b border-gray-200">
          <nav className="flex gap-8 -mb-px">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id || currentPath === tab.href
              return (
                <a
                  key={tab.id}
                  href={tab.href}
                  className={`
                    py-4 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                    ${
                      isActive
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab.label}
                </a>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )
}


