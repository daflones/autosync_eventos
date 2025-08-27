import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, ShoppingCart, Users, Calendar, LogOut, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const MobileSidebar = ({ isOpen, onClose }) => {
  const { signOut, user } = useAuth()
  const location = useLocation()

  const handleSignOut = () => {
    signOut()
  }

  const isActive = (path) => location.pathname === path

  const menuItems = [
    { path: '/', icon: BarChart3, label: 'Dashboard' },
    { path: '/events', icon: Calendar, label: 'Eventos' },
    { path: '/orders', icon: ShoppingCart, label: 'Ingressos' },
    { path: '/customers', icon: Users, label: 'Clientes' }
  ]

  const handleMenuClick = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 998,
          animation: 'fadeIn 0.3s ease'
        }}
        onClick={onClose}
      />
      
      {/* Mobile Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: isOpen ? '0' : '-280px',
        width: '280px',
        height: '100vh',
        backgroundColor: 'white',
        zIndex: 999,
        transition: isOpen ? 'left 0.3s ease' : 'none',
        boxShadow: '4px 0 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>NS</span>
            </div>
            <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1e293b' }}>
              NanoSync
            </span>
          </div>
          
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu Items */}
        <div style={{ flex: 1, padding: '1rem 0' }}>
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
                  padding: '0.875rem 1.5rem',
                  color: active ? '#8b5cf6' : '#64748b',
                  backgroundColor: active ? '#f3f4f6' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: active ? '600' : '500',
                  borderLeft: active ? '3px solid #8b5cf6' : '3px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* User Section */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#8b5cf6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
                {user?.email || 'Usuário'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Operador
              </div>
            </div>
          </div>
          
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </>
  )
}

export default MobileSidebar
