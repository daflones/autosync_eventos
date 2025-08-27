import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Edit, Trash2, Download, MessageSquare } from 'lucide-react'
import { supabase } from '../services/supabase'
import OrderModal from '../components/modals/OrderModal'
import MessageModal from '../components/modals/MessageModal'
import ConfirmModal from '../components/modals/ConfirmModal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import useResponsive from '../hooks/useResponsive'
import toast from 'react-hot-toast'

const Orders = () => {
  const { isMobile, isTablet } = useResponsive()
  const [orders, setOrders] = useState([])
  const [filteredOrders, setFilteredOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [deliveryFilter, setDeliveryFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderToDelete, setOrderToDelete] = useState(null)
  const [sendingMessages, setSendingMessages] = useState(new Set())

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, searchTerm, paymentFilter, deliveryFilter])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Carregar dados relacionados para cada ticket
      const ordersWithRelations = await Promise.all(
        (data || []).map(async (order) => {
          try {
            // Carregar customer
            const { data: customer, error: customerError } = await supabase
              .from('customers')
              .select('id, name, phone, cpf, age')
              .eq('id', order.customer_id)
              .maybeSingle()

            // Carregar event
            const { data: event, error: eventError } = await supabase
              .from('events')
              .select('nome, data, horario, local')
              .eq('id', order.event_id)
              .maybeSingle()

            if (customerError) console.error('Customer error:', customerError)
            if (eventError) console.error('Event error:', eventError)

            // Carregar mensagens
            const { data: messages } = await supabase
              .from('messages')
              .select('sent_at, created_at')
              .eq('ticket_id', order.id)
              .order('created_at', { ascending: false })
              .limit(1)
            
            return {
              ...order,
              customer: customer || {},
              event: event || {},
              messages: messages || []
            }
          } catch (relError) {
            console.error('Error loading relations for ticket:', order.id, relError)
            return {
              ...order,
              customer: {},
              event: {},
              messages: []
            }
          }
        })
      )
      
      setOrders(ordersWithRelations)
    } catch (error) {
      console.error('Error loading orders:', error)
      toast.error('Erro ao carregar ingressos')
    } finally {
      setLoading(false)
    }
  }

  const filterOrders = () => {
    let filtered = orders

    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(order =>
        (order.customer?.name?.toLowerCase() || '').includes(searchLower) ||
        (order.customer?.phone || '').includes(searchTerm.trim()) ||
        (order.ticket_type?.toLowerCase() || '').includes(searchLower) ||
        (order.customer?.cpf || '').includes(searchTerm.trim())
      )
    }

    if (paymentFilter !== 'all') {
      filtered = filtered.filter(order => order.payment_status === paymentFilter)
    }

    if (deliveryFilter !== 'all') {
      filtered = filtered.filter(order => order.delivery_status === deliveryFilter)
    }

    setFilteredOrders(filtered)
  }

  const handleSendMessage = (customer, ticket) => {
    setSelectedCustomer(customer)
    setSelectedTicket(ticket)
    setShowMessageModal(true)
  }

  const handleMessageSent = () => {
    setShowMessageModal(false)
    setSelectedCustomer(null)
    setSelectedTicket(null)
    // Recarregar ingressos para atualizar o status
    loadOrders()
  }

  const getStatusColor = (status, type) => {
    if (type === 'payment') {
      switch (status) {
        case 'paid': return '#10b981'
        case 'pending': return '#f59e0b'
        case 'cancelled': return '#ef4444'
        default: return '#6b7280'
      }
    } else if (type === 'delivery') {
      switch (status) {
        case 'delivered': return '#10b981'
        case 'shipped': return '#8b5cf6'
        case 'pending': return '#f59e0b'
        default: return '#6b7280'
      }
    }
    return '#6b7280'
  }

  const getStatusLabel = (status, type) => {
    if (type === 'payment') {
      switch (status) {
        case 'paid': return 'Pago'
        case 'pending': return 'Pendente'
        case 'cancelled': return 'Cancelado'
        default: return status
      }
    } else if (type === 'delivery') {
      switch (status) {
        case 'delivered': return 'Entregue'
        case 'shipped': return 'Enviado'
        case 'pending': return 'Pendente'
        default: return status
      }
    }
    return status
  }

  const handleEditOrder = (order) => {
    setSelectedOrder(order)
    setShowModal(true)
  }

  const handleDeleteOrder = (orderId) => {
    setOrderToDelete(orderId)
    setShowConfirmModal(true)
  }

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return
    
    try {
      console.log('Tentando excluir pedido ID:', orderToDelete)
      
      // Primeiro, excluir mensagens relacionadas ao ticket
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('ticket_id', orderToDelete)
      
      if (messagesError) {
        console.error('Erro ao excluir mensagens:', messagesError)
        throw messagesError
      }
      
      // Depois, excluir o ticket
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', orderToDelete)

      if (error) {
        console.error('Erro do Supabase:', error)
        throw error
      }

      toast.success('Ingresso excluído com sucesso!')
      loadOrders()
      setShowConfirmModal(false)
      setOrderToDelete(null)
    } catch (error) {
      console.error('Erro ao excluir pedido:', error)
      toast.error(`Erro ao excluir ingresso: ${error.message}`)
    }
  }

  const cancelDeleteOrder = () => {
    setShowConfirmModal(false)
    setOrderToDelete(null)
  }

  const handleModalSuccess = () => {
    setShowModal(false)
    setSelectedOrder(null)
    loadOrders()
  }

  const handleMessageSuccess = () => {
    setShowMessageModal(false)
    // Remover do estado de envio
    if (selectedOrder) {
      setSendingMessages(prev => {
        const newSet = new Set(prev)
        newSet.delete(selectedOrder.id)
        return newSet
      })
    }
    setSelectedOrder(null)
    // Atualizar a lista de ingressos em tempo real
    loadOrders()
  }

  const handleMessageCancel = () => {
    setShowMessageModal(false)
    // Limpar o estado de envio quando cancelar
    if (selectedOrder) {
      setSendingMessages(prev => {
        const newSet = new Set(prev)
        newSet.delete(selectedOrder.id)
        return newSet
      })
    }
    setSelectedOrder(null)
  }

  const handleNewOrder = () => {
    setSelectedOrder(null)
    setShowModal(true)
  }

  const handleExport = () => {
    const csvData = filteredOrders.map(order => ({
      'ID': order.id,
      'Cliente': order.customer_name,
      'Telefone': order.customer_phone,
      'Tipo': order.ticket_type,
      'Quantidade': order.quantity,
      'Valor Total': `R$ ${order.total_amount}`,
      'Status Pagamento': getStatusLabel(order.payment_status, 'payment'),
      'Status Entrega': getStatusLabel(order.delivery_status, 'delivery'),
      'Método Pagamento': order.payment_method,
      'Data': new Date(order.created_at).toLocaleDateString('pt-BR')
    }))

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `ingressos_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success('Relatório exportado com sucesso!')
  }

  const handleSendTicket = (order) => {
    // Marcar como enviando para desabilitar o botão
    setSendingMessages(prev => new Set([...prev, order.id]))
    setSelectedOrder(order)
    setShowMessageModal(true)
  }

  const formatSentDate = (sentAt) => {
    if (!sentAt) return null
    const date = new Date(sentAt)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div style={{ 
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        padding: '1rem'
      }}>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
        <LoadingSpinner text="Carregando ingressos..." />
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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '1rem' : '0',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div>
          <h1 style={{ 
            fontSize: isMobile ? '1.25rem' : '2rem', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '0.5rem'
          }}>
            Ingressos
          </h1>
        </div>
        <button 
          onClick={handleExport}
          style={{
            display: 'flex',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            backgroundColor: 'transparent',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            color: '#64748b',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#f8fafc'
            e.target.style.borderColor = '#8b5cf6'
            e.target.style.color = '#8b5cf6'
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent'
            e.target.style.borderColor = '#e2e8f0'
            e.target.style.color = '#64748b'
          }}
        >
          <Download size={18} />
          Exportar
        </button>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
          <button 
            onClick={handleNewOrder}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: isMobile ? '0.625rem 1rem' : '0.75rem 1.25rem',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              width: isMobile ? '100%' : 'auto',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#7c3aed'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#8b5cf6'}
          >
            <Plus size={isMobile ? 16 : 18} />
            Novo Ingresso
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: isMobile ? '1.5rem' : '2rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #f1f5f9'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: '#f3f0ff',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Filter size={20} color="#8b5cf6" />
          </div>
          <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1e293b' }}>
            Filtros e Busca
          </span>
        </div>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr)) auto',
          gap: isMobile ? '1rem' : '1rem',
          alignItems: 'end'
        }}
        className="filters-grid">
          {/* Search Input */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Buscar cliente
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }} />
              <input
                type="text"
                placeholder="Buscar por nome, telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="filter-input"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem 0.875rem 3rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  backgroundColor: '#fafbfc'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#8b5cf6'
                  e.target.style.backgroundColor = 'white'
                  e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb'
                  e.target.style.backgroundColor = '#fafbfc'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>
          
          {/* Payment Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Pagamento
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="filter-select"
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '0.95rem',
                outline: 'none',
                backgroundColor: '#fafbfc',
                cursor: 'pointer'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8b5cf6'
                e.target.style.backgroundColor = 'white'
                e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.backgroundColor = '#fafbfc'
                e.target.style.boxShadow = 'none'
              }}
            >
              <option value="all">Todos os Pagamentos</option>
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {/* Delivery Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Entrega
            </label>
            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              className="filter-select"
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '0.95rem',
                outline: 'none',
                backgroundColor: '#fafbfc',
                cursor: 'pointer'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8b5cf6'
                e.target.style.backgroundColor = 'white'
                e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.backgroundColor = '#fafbfc'
                e.target.style.boxShadow = 'none'
              }}
            >
              <option value="all">Todas as Entregas</option>
              <option value="pending">Pendente</option>
              <option value="shipped">Enviado</option>
              <option value="delivered">Entregue</option>
            </select>
          </div>

          {/* Clear Button */}
          <button 
            onClick={() => {
              setSearchTerm('')
              setPaymentFilter('all')
              setDeliveryFilter('all')
            }}
            className="filter-clear-btn"
            style={{
              padding: '0.875rem 1.5rem',
              backgroundColor: '#f8fafc',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              color: '#64748b',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f1f5f9'
              e.target.style.borderColor = '#cbd5e1'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f8fafc'
              e.target.style.borderColor = '#e5e7eb'
            }}
          >
            Limpar
          </button>
        </div>

        {/* Filter Summary */}
        {(searchTerm || paymentFilter !== 'all' || deliveryFilter !== 'all') && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #bae6fd',
            fontSize: '0.875rem',
            color: '#0369a1'
          }}>
            <strong>Filtros ativos:</strong>
            {searchTerm && <span style={{ marginLeft: '0.5rem' }}>Busca: "{searchTerm}"</span>}
            {paymentFilter !== 'all' && <span style={{ marginLeft: '0.5rem' }}>Pagamento: {paymentFilter}</span>}
            {deliveryFilter !== 'all' && <span style={{ marginLeft: '0.5rem' }}>Entrega: {deliveryFilter}</span>}
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="modern-card">
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '1.5rem'
        }}>
          <h6 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#1e293b',
            margin: 0
          }}>
            Lista de Ingressos ({filteredOrders.length} ingressos)
          </h6>
        </div>

        {filteredOrders.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            color: '#6b7280',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            Nenhum ingresso encontrado
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1.25rem' : '0.75rem' }}>
            {filteredOrders.map((order) => {
              const getPaymentStatusColor = (status) => {
                switch (status) {
                  case 'paid': return { bg: '#d1fae5', text: '#065f46', label: 'Pagamento Confirmado', border: '#a7f3d0' }
                  case 'pending': return { bg: '#fef3c7', text: '#92400e', label: 'Pagamento Pendente', border: '#fcd34d' }
                  case 'cancelled': return { bg: '#fee2e2', text: '#991b1b', label: 'Pagamento Cancelado', border: '#fca5a5' }
                  default: return { bg: '#f1f5f9', text: '#475569', label: 'Pagamento Indefinido', border: '#cbd5e1' }
                }
              }

              const getDeliveryStatusColor = (status) => {
                switch (status) {
                  case 'delivered': return { bg: '#d1fae5', text: '#065f46', label: 'Ingresso Entregue', border: '#a7f3d0' }
                  case 'shipped': return { bg: '#dbeafe', text: '#1e40af', label: 'Ingresso Enviado', border: '#93c5fd' }
                  case 'pending': return { bg: '#fef3c7', text: '#92400e', label: 'Envio Pendente', border: '#fcd34d' }
                  default: return { bg: '#f1f5f9', text: '#475569', label: 'Não Enviado', border: '#cbd5e1' }
                }
              }

              const paymentColors = getPaymentStatusColor(order.payment_status)
              const deliveryColors = getDeliveryStatusColor(order.delivery_status)

              return (
                <div
                  key={order.id}
                  className="autofood-card"
                >
                  {/* Left Content */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    flex: 1
                  }}>
                    {/* Order Info */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Header com nome e valor */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <h3 style={{
                            margin: 0,
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            color: '#1f2937',
                            lineHeight: '1.2'
                          }}>
                            {order.customer?.name || 'Cliente não definido'}
                          </h3>
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#6b7280',
                            fontWeight: '500',
                            marginTop: '0.25rem'
                          }}>
                            {order.customer?.phone}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginTop: '0.25rem'
                          }}>
                            CPF: {order.customer?.cpf || 'Não informado'} • Nascimento: {order.customer?.age ? new Date(order.customer.age + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informado'}
                          </div>
                        </div>
                        <div style={{
                          textAlign: 'right'
                        }}>
                          <div style={{
                            fontSize: '1.2rem',
                            fontWeight: '700',
                            color: '#10b981',
                            lineHeight: '1'
                          }}>
                            R$ {parseFloat(order.total_amount || 0).toFixed(2)}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginTop: '0.25rem'
                          }}>
                            Qtd: {order.quantity} {order.setor && `• ${order.setor}`} {order.lote && `• Lote: ${order.lote}`}
                          </div>
                        </div>
                      </div>
                      
                      {/* Informações do evento */}
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '0.25rem'
                        }}>
                          {order.event?.nome || 'Evento não definido'}
                        </div>
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#6b7280',
                          fontWeight: '500'
                        }}>
                          {order.event?.data && order.event?.horario 
                            ? `${new Date(order.event.data).toLocaleDateString('pt-BR')} às ${order.event.horario}`
                            : 'Data não definida'
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Content */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '0.75rem' : '1rem',
                    flex: 1,
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center'
                  }}>
                    {/* Status Badges */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: isMobile ? 'row' : 'column', 
                      gap: '0.5rem',
                      alignItems: isMobile ? 'flex-start' : 'flex-end',
                      minWidth: isMobile ? 'auto' : '200px',
                      width: isMobile ? '100%' : 'auto',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          backgroundColor: paymentColors.bg,
                          color: paymentColors.text,
                          border: `1px solid ${paymentColors.border}`,
                          whiteSpace: 'nowrap',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {paymentColors.label}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          backgroundColor: deliveryColors.bg,
                          color: deliveryColors.text,
                          border: `1px solid ${deliveryColors.border}`,
                          whiteSpace: 'nowrap',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {deliveryColors.label}
                        </span>
                      </div>
                      
                      {order.messages && order.messages.length > 0 && order.messages[0].sent_at && (
                        <div style={{
                          fontSize: '0.7rem',
                          color: '#7c3aed',
                          fontWeight: '500',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#f3f0ff',
                          borderRadius: '6px',
                          border: '1px solid #ddd6fe'
                        }}>
                          Enviado: {formatSentDate(order.messages[0].sent_at)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {order.delivery_status !== 'delivered' && !sendingMessages.has(order.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSendTicket(order)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            backgroundColor: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#f3f0ff'
                            e.target.style.borderColor = '#8b5cf6'
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = 'transparent'
                            e.target.style.borderColor = '#e2e8f0'
                          }}
                          title="Enviar Ingresso"
                        >
                          <MessageSquare size={14} color="#8b5cf6" />
                        </button>
                      )}
                      
                      {sendingMessages.has(order.id) && (
                        <button
                          disabled
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            cursor: 'not-allowed'
                          }}
                          title="Enviando..."
                        >
                          <div style={{
                            width: '14px',
                            height: '14px',
                            border: '2px solid #e2e8f0',
                            borderTop: '2px solid #8b5cf6',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }} />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditOrder(order)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          backgroundColor: 'transparent',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#f9fafb'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Edit size={14} color="#6b7280" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteOrder(order.id)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          backgroundColor: 'transparent',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#fef2f2'
                          e.target.style.borderColor = '#fecaca'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent'
                          e.target.style.borderColor = '#e5e7eb'
                        }}
                      >
                        <Trash2 size={14} color="#dc2626" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <OrderModal
        show={showModal}
        onHide={() => setShowModal(false)}
        onSuccess={handleModalSuccess}
        order={selectedOrder}
      />

      <MessageModal
        show={showMessageModal}
        onHide={handleMessageCancel}
        customer={selectedOrder?.customer}
        ticket={selectedOrder}
        onSuccess={handleMessageSuccess}
      />

      <ConfirmModal
        show={showConfirmModal}
        onHide={cancelDeleteOrder}
        onConfirm={confirmDeleteOrder}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este ingresso? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </div>
  )
}

export default Orders
