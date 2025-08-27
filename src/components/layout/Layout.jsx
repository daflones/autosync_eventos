import React, { useState } from 'react'
import Sidebar from './Sidebar'
import MobileSidebar from './MobileSidebar'
import useResponsive from '../../hooks/useResponsive'

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isMobile } = useResponsive()

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}
      
      {/* Mobile Sidebar */}
      {isMobile && (
        <MobileSidebar 
          isOpen={sidebarOpen} 
          onClose={closeSidebar}
        />
      )}
      
      <main style={{
        marginLeft: isMobile ? '0' : '250px',
        flex: 1,
        padding: isMobile ? '1rem' : '2rem',
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        transition: 'margin-left 0.3s ease'
      }}>
        {/* Mobile header */}
        {isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            padding: '0.75rem 0',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <button
              onClick={toggleSidebar}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                backgroundColor: sidebarOpen ? '#8b5cf6' : '#f8fafc',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                color: sidebarOpen ? 'white' : '#64748b',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                minHeight: '48px',
                minWidth: '80px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'rgba(139, 92, 246, 0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div style={{ width: '100%', height: '2px', backgroundColor: 'currentColor' }}></div>
                <div style={{ width: '100%', height: '2px', backgroundColor: 'currentColor' }}></div>
                <div style={{ width: '100%', height: '2px', backgroundColor: 'currentColor' }}></div>
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: '500', userSelect: 'none' }}>Menu</span>
            </button>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>NS</span>
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
                NanoSync
              </span>
            </div>
          </div>
        )}
        
        {children}
      </main>
    </div>
  )
}

export default Layout
