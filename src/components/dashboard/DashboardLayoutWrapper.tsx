import { useState } from 'react'
import DashboardNavbar from './DashboardNavbar'
import DashboardSidebar from './DashboardSidebar'

interface Props {
  currentPath: string
}

export default function DashboardLayoutWrapper({ currentPath }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      <DashboardNavbar 
        currentPath={currentPath} 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <DashboardSidebar 
        currentPath={currentPath}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </>
  )
}





