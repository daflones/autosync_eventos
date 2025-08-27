import React, { useState, useEffect } from 'react'
import { Calendar, Users, ShoppingBag, TrendingUp, Package, Clock, CheckCircle, AlertCircle, ShoppingCart, DollarSign } from 'lucide-react'
import { supabase } from '../services/supabase'
import toast from 'react-hot-toast'
import useResponsive from '../hooks/useResponsive'
import StatusBadge from '../components/common/StatusBadge'
import LoadingSpinner from '../components/common/LoadingSpinner'

const Dashboard = () => {
  const { isMobile, isTablet } = useResponsive()
  const [tickets, setTickets] = useState([])
  const [metrics, setMetrics] = useState({
    totalTickets: 0,
    todayTickets: 0,
    totalClients: 0,
    pendingPayments: 0,
    pendingDeliveries: 0,
    totalRevenue: 0
  })
  const [statusData, setStatusData] = useState([
    { label: 'Confirmadas', value: 0, color: '#10b981' },
    { label: 'Pendentes', value: 0, color: '#f59e0b' },
    { label: 'Canceladas', value: 0, color: '#ef4444' },
    { label: 'Expiradas', value: 0, color: '#f59e0b' },
    { label: 'Finalizadas', value: 0, color: '#6366f1' }
  ])
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load metrics
      const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
      
      const { data: customers } = await supabase
        .from('customers')
        .select('*')

      console.log('Tickets loaded:', tickets)
      console.log('Tickets count:', tickets?.length)

      if (tickets) {
        setTickets(tickets)
        const today = new Date().toDateString()
        const todayReservations = tickets.filter(t => 
          new Date(t.created_at).toDateString() === today && t.payment_status === 'paid'
        ).length

        const pendingPayments = tickets.filter(t => 
          t.payment_status === 'pending'
        ).length

        const pendingDeliveries = tickets.filter(t => 
          t.delivery_status === 'pending'
        ).length

        const totalRevenue = tickets
          .filter(t => t.payment_status === 'paid')
          .reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0)

        setMetrics({
          totalTickets: tickets.length,
          todayTickets: todayReservations,
          totalClients: customers?.length || 0,
          pendingPayments,
          pendingDeliveries,
          totalRevenue
        })

        // Update status data
        const statusCounts = {
          confirmed: tickets.filter(t => t.payment_status === 'paid').length,
          pending: tickets.filter(t => t.payment_status === 'pending').length,
          cancelled: tickets.filter(t => t.payment_status === 'failed' || t.payment_status === 'cancelled').length,
          expired: tickets.filter(t => t.payment_status === 'expired').length,
          finished: tickets.filter(t => t.delivery_status === 'delivered').length
        }

        console.log('Status counts:', statusCounts)

        setStatusData([
          { label: 'Pagamentos Confirmados', value: statusCounts.confirmed, color: '#10b981' },
          { label: 'Pendentes', value: statusCounts.pending, color: '#f59e0b' },
          { label: 'Cancelados', value: statusCounts.cancelled, color: '#ef4444' },
          { label: 'Expirados', value: statusCounts.expired, color: '#f59e0b' }
        ])
      }

      // Load recent orders
      const { data: orders } = await supabase
        .from('tickets')
        .select(`
          *,
          customers (
            name,
            phone,
            cpf,
            age
          ),
          events (
            nome
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (orders) {
        setRecentOrders(orders)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        padding: '1rem'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px' 
        }}>
          <LoadingSpinner text="Carregando dashboard..." />
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      padding: '1rem'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ 
          fontSize: isMobile ? '1.25rem' : '2rem', 
          fontWeight: '700', 
          color: '#1e293b',
          marginBottom: '0.5rem'
        }}>
          Dashboard
        </h1>
        <p style={{ color: '#64748b', fontSize: isMobile ? '0.875rem' : '1rem' }}>
          Visão geral do sistema de ingressos
        </p>
      </div>

      {/* Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: isMobile ? '1rem' : '1.5rem',
        marginBottom: isMobile ? '1.5rem' : '2rem'
      }}>
        <div className="metric-card">
          <div style={{ 
            width: '36px', 
            height: '36px', 
            backgroundColor: '#dbeafe', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <Calendar size={18} color="#8b5cf6" />
          </div>
          <h3 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '0.25rem'
          }}>
            {metrics.totalTickets}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
            Total de Ingressos
          </p>
        </div>

        <div className="metric-card">
          <div style={{ 
            width: '36px', 
            height: '36px', 
            backgroundColor: '#dcfce7', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <ShoppingCart size={18} color="#10b981" />
          </div>
          <h3 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '0.25rem'
          }}>
            {metrics.todayTickets}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
            Ingressos comprados hoje
          </p>
        </div>

        <div className="metric-card">
          <div style={{ 
            width: '36px', 
            height: '36px', 
            backgroundColor: '#f3e8ff', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <Users size={18} color="#8b5cf6" />
          </div>
          <h3 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '0.25rem'
          }}>
            {metrics.totalClients}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
            Clientes
          </p>
        </div>

        <div className="metric-card">
          <div style={{ 
            width: '36px', 
            height: '36px', 
            backgroundColor: '#dcfce7', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <DollarSign size={18} color="#10b981" />
          </div>
          <h3 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '0.25rem'
          }}>
            R$ {metrics.totalRevenue.toFixed(2)}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
            Receita Total
          </p>
        </div>

        <div className="metric-card">
          <div style={{ 
            width: '36px', 
            height: '36px', 
            backgroundColor: '#fef3c7', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <Clock size={18} color="#f59e0b" />
          </div>
          <h3 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '0.25rem'
          }}>
            {metrics.pendingPayments}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
            Pagamentos pendentes
          </p>
        </div>

        <div className="metric-card">
          <div style={{ 
            width: '36px', 
            height: '36px', 
            backgroundColor: '#fef3c7', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <Clock size={18} color="#f59e0b" />
          </div>
          <h3 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '0.25rem'
          }}>
            {metrics.pendingDeliveries}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
            Entregas pendentes
          </p>
        </div>
      </div>

      {/* Charts and Status */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : '1fr 400px', 
        gap: isMobile ? '1.5rem' : '2rem',
        marginBottom: '2rem'
      }}>
        {/* Chart Placeholder */}
        <div className="modern-card">
          <h6 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '1.5rem'
          }}>
            Ingressos por status
          </h6>
          <div style={{ 
            height: isMobile ? '250px' : '300px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '1rem' : '1.5rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'end',
              gap: isMobile ? '1rem' : '2rem',
              height: isMobile ? '180px' : '220px',
              width: '100%',
              maxWidth: isMobile ? '100%' : '600px'
            }}>
              {statusData.map((item, index) => {
                const maxValue = Math.max(...statusData.map(s => s.value)) || 1
                const barHeight = item.value === 0 ? 8 : Math.max((item.value / maxValue) * (isMobile ? 120 : 180), 16)
                
                return (
                  <div key={index} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1,
                    gap: '0.75rem'
                  }}>
                    {/* Value label */}
                    <div style={{
                      fontSize: '1.125rem',
                      fontWeight: '700',
                      color: '#1e293b',
                      minHeight: '28px'
                    }}>
                      {item.value > 0 ? item.value : ''}
                    </div>
                    
                    {/* Bar */}
                    <div style={{
                      width: isMobile ? '40px' : '60px',
                      height: `${barHeight}px`,
                      backgroundColor: item.color,
                      borderRadius: '8px 8px 6px 6px',
                      position: 'relative',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                      background: `linear-gradient(180deg, ${item.color} 0%, ${item.color}cc 100%)`,
                      transition: 'all 0.3s ease'
                    }}></div>
                    
                    {/* Category label */}
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#64748b',
                      textAlign: 'center',
                      lineHeight: '1.3',
                      maxWidth: '80px',
                      fontWeight: '500'
                    }}>
                      {item.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Status List */}
        <div className="modern-card">
          <h6 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '1.5rem'
          }}>
            Status dos Ingressos
          </h6>
          <div>
            {statusData.map((item, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0',
                borderBottom: index < statusData.length - 1 ? '1px solid #e2e8f0' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: item.color
                  }}></div>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {item.label}
                  </span>
                </div>
                <span style={{ 
                  fontSize: '1rem', 
                  fontWeight: '600', 
                  color: '#1e293b' 
                }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders and Gifts */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
        gap: isMobile ? '1.5rem' : '2rem'
      }}>
        {/* Recent Orders */}
        <div className="modern-card">
          <h6 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '1.5rem'
          }}>
            Pedidos Recentes
          </h6>
          <div>
            {recentOrders.length === 0 ? (
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Nenhum pedido recente.
              </div>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      {order.customers?.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      CPF: {order.customers?.cpf || 'Não informado'} • {isMobile ? '' : 'Nascimento: '}{order.customers?.age ? new Date(order.customers.age).toLocaleDateString('pt-BR') : 'Não informado'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {order.events?.nome || 'Evento não encontrado'} • {order.ticket_type} • {order.quantity}x
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#10b981' }}>
                      R$ {parseFloat(order.total_amount || 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(order.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Gifts */}
        <div className="modern-card">
          <h6 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '1.5rem'
          }}>
            Resumo de Ingressos
          </h6>
          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Ingressos Entregues:</span>
                <span style={{ fontWeight: '600', color: '#10b981' }}>
                  {tickets.filter(t => t.delivery_status === 'delivered').length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Ingressos Pendentes:</span>
                <span style={{ fontWeight: '600', color: '#f59e0b' }}>
                  {metrics.pendingDeliveries}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Pagamentos Pendentes:</span>
                <span style={{ fontWeight: '600', color: '#f59e0b' }}>
                  {metrics.pendingPayments}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pagamentos Confirmados:</span>
                <span style={{ fontWeight: '600', color: '#10b981' }}>
                  {statusData.find(s => s.label === 'Pagamentos Confirmados')?.value || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
