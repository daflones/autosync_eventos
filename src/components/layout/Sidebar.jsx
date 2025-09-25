import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, ShoppingCart, Users, Calendar, Send, LogOut, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import useResponsive from '../../hooks/useResponsive'

const Sidebar = ({ isOpen, onClose }) => {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const { isMobile } = useResponsive()

  console.log('Sidebar render - isOpen:', isOpen, 'isMobile:', isMobile)

  const handleSignOut = () => {
    signOut()
  }

  const isActive = (path) => location.pathname === path

  const menuItems = [
    { path: '/', icon: BarChart3, label: 'Dashboard' },
    { path: '/events', icon: Calendar, label: 'Eventos' },
    { path: '/orders', icon: ShoppingCart, label: 'Ingressos' },
    { path: '/customers', icon: Users, label: 'Clientes' },
    { path: '/disparador', icon: Send, label: 'Disparador' }
  ]

  // Close sidebar on route change for mobile
  useEffect(() => {
    if (isMobile && onClose) {
      onClose()
    }
  }, [location.pathname, isMobile, onClose])

  // Handle menu item click
  const handleMenuClick = () => {
    if (isMobile && onClose) {
      onClose()
    }
  }

  return (
    <div style={{
      width: '250px',
      height: '100vh',
      backgroundColor: 'white',
      color: '#1e293b',
      position: 'fixed',
      left: isMobile ? (isOpen ? '0' : '-100%') : '0',
      top: 0,
      zIndex: 1001,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #e5e7eb',
      boxShadow: isMobile && isOpen ? '4px 0 12px rgba(0, 0, 0, 0.15)' : '2px 0 4px rgba(0, 0, 0, 0.05)',
      transition: 'left 0.3s ease, transform 0.3s ease',
      transform: 'translateX(0)',
      visibility: isMobile ? (isOpen ? 'visible' : 'hidden') : 'visible'
    }}>
      <div style={{ padding: isMobile ? '1.5rem 1rem' : '2rem 1.5rem', flex: 1 }}>
        {/* Mobile close button */}
        {isMobile && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '1rem'
          }}>
            <button
              onClick={(e) => {
                e.preventDefault()
                console.log('Close button clicked')
                onClose()
              }}
              style={{
                padding: '0.75rem',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#64748b',
                cursor: 'pointer',
                minHeight: '44px',
                minWidth: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        )}
        
        {/* Logo */}
        <div style={{ marginBottom: isMobile ? '2rem' : '3rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}>
              <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>NS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1e293b' }}>
                NanoSync
              </span>
              <span style={{ 
                fontSize: '0.875rem', 
                fontWeight: '500',
                color: '#a78bfa',
                lineHeight: '1.2'
              }}>
                (Eventos)
              </span>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav style={{ marginBottom: '2rem' }}>
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleMenuClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  marginBottom: '0.5rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: active ? 'white' : '#64748b',
                  backgroundColor: active ? '#8b5cf6' : 'transparent',
                  fontWeight: active ? '600' : '500',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: active ? '0 4px 12px rgba(139, 92, 246, 0.25)' : 'none'
                }}
                onMouseOver={(e) => {
                  if (!active) {
                    e.target.style.backgroundColor = '#f3f0ff'
                    e.target.style.color = '#8b5cf6'
                    e.target.style.transform = 'translateX(4px)'
                  }
                }}
                onMouseOut={(e) => {
                  if (!active) {
                    e.target.style.backgroundColor = 'transparent'
                    e.target.style.color = '#64748b'
                    e.target.style.transform = 'translateX(0)'
                  }
                }}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            )
          })}
        </nav>

      </div>
      
      {/* User Info - Fixed at bottom */}
      <div style={{
        padding: '1.5rem',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          marginBottom: '1rem',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '0.25rem'
          }}>
            {user?.user_metadata?.full_name || 'Usuário'}
          </div>
          <div style={{ 
            fontSize: '0.75rem', 
            color: '#64748b'
          }}>
            {user?.email}
          </div>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            width: '100%',
            padding: '0.75rem 1rem',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '0.95rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#fef2f2'
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'transparent'
          }}
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </div>
  )
}

export default Sidebar
