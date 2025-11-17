import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Badge, Button, Form, InputGroup } from 'react-bootstrap'
import { Users, Plus, Search, Filter, Phone, Mail, User, CreditCard, Edit, Trash2, Grid3X3, List } from 'lucide-react'
import { supabase } from '../services/supabase'
import CustomerModal from '../components/modals/CustomerModal'
import ConfirmModal from '../components/modals/ConfirmModal'
import useResponsive from '../hooks/useResponsive'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/common/LoadingSpinner'

function Customers() {
  const { isMobile, isTablet } = useResponsive()
  const [customers, setCustomers] = useState([])
  const [filteredCustomers, setFilteredCustomers] = useState([])
  const [customerStats, setCustomerStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list') // 'kanban' or 'list'
  const [showModal, setShowModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerToDelete, setCustomerToDelete] = useState(null)
  const [draggedCustomer, setDraggedCustomer] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    filterCustomers()
  }, [customers, searchTerm, statusFilter])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const { data: customersData, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Load tickets data for each customer
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('customer_id, total_amount, payment_status')

      if (ticketsError) throw ticketsError

      // Calculate stats for each customer
      const stats = {}
      customersData.forEach(customer => {
        const customerTickets = ticketsData.filter(ticket => ticket.customer_id === customer.id)
        stats[customer.id] = {
          totalTickets: customerTickets.length,
          totalSpent: customerTickets.filter(ticket => ticket.payment_status === 'paid').reduce((sum, ticket) => sum + (parseFloat(ticket.total_amount) || 0), 0),
          paidOrders: customerTickets.filter(ticket => ticket.payment_status === 'paid').length
        }
      })

      setCustomers(customersData || [])
      setCustomerStats(stats)
    } catch (error) {
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  const handleNewCustomer = () => {
    setSelectedCustomer(null)
    setShowModal(true)
  }

  const handleEditCustomer = (customer) => {
    setSelectedCustomer(customer)
    setShowModal(true)
  }

  const handleDeleteCustomer = (customer) => {
    setCustomerToDelete(customer)
    setShowConfirmModal(true)
  }

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return
    
    try {
      // Primeiro, buscar tickets do cliente
      const { data: customerTickets, error: ticketsQueryError } = await supabase
        .from('tickets')
        .select('id')
        .eq('customer_id', customerToDelete.id)
      
      if (ticketsQueryError) {
      }
      
      // Excluir mensagens relacionadas aos tickets do cliente
      if (customerTickets && customerTickets.length > 0) {
        const ticketIds = customerTickets.map(ticket => ticket.id)
        const { error: messagesError } = await supabase
          .from('messages')
          .delete()
          .in('ticket_id', ticketIds)
        
        if (messagesError) {
        }
      }
      
      // Excluir mensagens diretas do cliente (se houver)
      const { error: directMessagesError } = await supabase
        .from('messages')
        .delete()
        .eq('customer_id', customerToDelete.id)
      
      if (directMessagesError) {
      }
      
      // Depois, excluir tickets do cliente
      const { error: ticketsError } = await supabase
        .from('tickets')
        .delete()
        .eq('customer_id', customerToDelete.id)
      
      if (ticketsError) {
        throw ticketsError
      }
      
      // Por último, excluir o cliente
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id)

      if (error) {
        throw error
      }
      
      toast.success('Cliente excluído com sucesso!')
      loadCustomers()
      setShowConfirmModal(false)
      setCustomerToDelete(null)
    } catch (error) {
      toast.error(`Erro ao excluir cliente: ${error.message}`)
    }
  }

  const cancelDeleteCustomer = () => {
    setShowConfirmModal(false)
    setCustomerToDelete(null)
  }

  const handleModalSuccess = () => {
    loadCustomers()
  }

  const filterCustomers = () => {
    let filtered = customers

    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(customer =>
        (customer.name?.toLowerCase() || '').includes(searchLower) ||
        (customer.phone || '').includes(searchTerm.trim()) ||
        (customer.email?.toLowerCase() || '').includes(searchLower) ||
        (customer.cpf || '').includes(searchTerm.trim())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(customer => customer.status === statusFilter)
    }

    setFilteredCustomers(filtered)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'lead': return '#8b5cf6'
      case 'customer': return '#10b981'
      case 'inactive': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'lead': return 'Novo Lead'
      case 'customer': return 'Ativo'
      case 'inactive': return 'Inativo'
      default: return 'Indefinido'
    }
  }

  // Drag and Drop handlers
  const handleDragStart = (e, customer) => {
    setDraggedCustomer(customer)
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(customer))
    
    // Create a simple drag image
    const dragElement = e.currentTarget.cloneNode(true)
    dragElement.style.transform = 'rotate(5deg)'
    dragElement.style.opacity = '0.8'
    dragElement.style.position = 'absolute'
    dragElement.style.top = '-1000px'
    document.body.appendChild(dragElement)
    e.dataTransfer.setDragImage(dragElement, 0, 0)
    
    setTimeout(() => {
      document.body.removeChild(dragElement)
    }, 0)
  }

  const handleDragEnd = () => {
    setDraggedCustomer(null)
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
  }

  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    
    const customerData = e.dataTransfer.getData('application/json')
    if (!customerData) return
    
    const customer = JSON.parse(customerData)
    
    if (customer.status === newStatus) {
      setDraggedCustomer(null)
      setIsDragging(false)
      return
    }

    try {
      const { error } = await supabase
        .from('customers')
        .update({ status: newStatus })
        .eq('id', customer.id)

      if (error) throw error

      // Update local state
      setCustomers(prev => prev.map(c => 
        c.id === customer.id 
          ? { ...c, status: newStatus }
          : c
      ))

      const statusNames = {
        'lead': 'Novos Leads',
        'customer': 'Clientes Ativos', 
        'inactive': 'Inativos'
      }
      
      toast.success(`${customer.name} movido para ${statusNames[newStatus]}`)
    } catch (error) {
      toast.error('Erro ao mover cliente')
    } finally {
      setDraggedCustomer(null)
      setIsDragging(false)
    }
  }

  const CustomerKanbanCard = ({ customer, customerStats, handleEditCustomer, handleDeleteCustomer }) => {
    const stats = customerStats[customer.id] || { totalTickets: 0, totalSpent: 0, paidOrders: 0 }
    const statusColor = getStatusColor(customer.status)
    
    return (
      <div 
        draggable
        onDragStart={(e) => handleDragStart(e, customer)}
        onDragEnd={handleDragEnd}
        style={{
          backgroundColor: 'white',
          border: draggedCustomer?.id === customer.id ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem',
          cursor: 'grab',
          transition: 'all 0.2s ease',
          boxShadow: draggedCustomer?.id === customer.id ? '0 8px 25px rgba(139, 92, 246, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
          opacity: draggedCustomer?.id === customer.id ? 0.8 : 1,
          transform: draggedCustomer?.id === customer.id ? 'scale(1.02)' : 'scale(1)',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
          }
        }}
>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.75rem'
        }}>
          <div>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: '600',
              color: '#1f2937',
              margin: 0,
              marginBottom: '0.25rem'
            }}>
              {customer.name}
            </h4>
            <p style={{
              fontSize: '0.8rem',
              color: '#6b7280',
              margin: 0,
              marginBottom: '0.25rem'
            }}>
              {customer.phone}
            </p>
            <div style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <div>CPF: {customer.cpf || 'Não informado'}</div>
              <div>RG: {customer.rg || 'Não informado'}</div>
              <div>{isMobile ? '' : 'Nascimento: '}{customer.age ? new Date(customer.age + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informado'}</div>
            </div>
          </div>
          <div style={{
            backgroundColor: statusColor,
            color: 'white',
            padding: '0.25rem 0.5rem',
            borderRadius: '12px',
            fontSize: '0.7rem',
            fontWeight: '500'
          }}>
            {getStatusLabel(customer.status)}
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          padding: '0.5rem',
          backgroundColor: '#f8fafc',
          borderRadius: '6px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Pedidos</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1f2937' }}>
              {stats.totalTickets}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Total</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#10b981' }}>
              R$ {stats.totalSpent.toFixed(2)}
            </div>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          gap: '0.5rem'
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleEditCustomer(customer)
            }}
            style={{
              flex: 1,
              padding: '0.5rem',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem'
            }}
          >
            <Edit size={12} />
            Editar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteCustomer(customer)
            }}
            style={{
              padding: '0.5rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <LoadingSpinner text="Carregando clientes..." />
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
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ 
            fontSize: isMobile ? '1.25rem' : '2rem', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '0.5rem'
          }}>
            Clientes
          </h1>
        </div>
        <div style={{ 
          display: 'flex', 
          gap: isMobile ? '0.75rem' : '1rem', 
          alignItems: 'center',
          width: isMobile ? '100%' : 'auto',
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          {/* View Mode Toggle */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem',
            width: isMobile ? '100%' : 'auto'
          }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: isMobile ? '0.625rem 1rem' : '0.5rem 1rem',
                backgroundColor: viewMode === 'list' ? '#8b5cf6' : 'transparent',
                color: viewMode === 'list' ? 'white' : '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                fontSize: isMobile ? '0.8rem' : '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flex: isMobile ? '1' : 'none'
              }}
            >
              <List size={isMobile ? 14 : 16} />
              Lista
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: isMobile ? '0.625rem 1rem' : '0.5rem 1rem',
                backgroundColor: viewMode === 'kanban' ? '#8b5cf6' : 'transparent',
                color: viewMode === 'kanban' ? 'white' : '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                fontSize: isMobile ? '0.8rem' : '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flex: isMobile ? '1' : 'none'
              }}
            >
              <Grid3X3 size={isMobile ? 14 : 16} />
              Kanban
            </button>
          </div>
          
          {/* Add Customer Button */}
          <button
            onClick={handleNewCustomer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              width: isMobile ? '100%' : 'auto',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#7c3aed'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#8b5cf6'
            }}
          >
            <Plus size={16} />
            Novo Cliente
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
          
          {/* Status Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              <option value="all">Todos os Status</option>
              <option value="lead">Novo Lead</option>
              <option value="customer">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>

          {/* Clear Button */}
          <button 
            onClick={() => {
              setSearchTerm('')
              setStatusFilter('all')
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
        {(searchTerm || statusFilter !== 'all') && (
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
            {statusFilter !== 'all' && <span style={{ marginLeft: '0.5rem' }}>Status: {statusFilter}</span>}
          </div>
        )}
      </div>

      {/* Customers Content */}
      {viewMode === 'kanban' ? (
        /* Kanban View */
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: isMobile ? '1rem' : '1.5rem',
          marginBottom: '2rem'
        }}>
          {/* Lead Column */}
          <div 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'lead')}
            onDragEnter={handleDragEnter}
            style={{
              backgroundColor: isDragging ? '#faf5ff' : 'white',
              borderRadius: '12px',
              border: isDragging ? '2px dashed #8b5cf6' : '2px solid #e0e7ff',
              padding: '1.5rem',
              minHeight: '200px',
              transition: 'all 0.2s ease'
            }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #e0e7ff'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: '#8b5cf6',
                borderRadius: '50%'
              }}></div>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#1e293b',
                margin: 0
              }}>
                Novos Leads ({filteredCustomers.filter(c => c.status === 'lead').length})
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '100px' }}>
              {filteredCustomers.filter(customer => customer.status === 'lead').map(customer => (
                <CustomerKanbanCard key={customer.id} customer={customer} customerStats={customerStats} handleEditCustomer={handleEditCustomer} handleDeleteCustomer={handleDeleteCustomer} />
              ))}
              {filteredCustomers.filter(customer => customer.status === 'lead').length === 0 && (
                <div style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: '#64748b', 
                  fontSize: '0.875rem',
                  fontStyle: 'italic'
                }}>
                  Arraste clientes aqui
                </div>
              )}
            </div>
          </div>

          {/* Active Column */}
          <div 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'customer')}
            onDragEnter={handleDragEnter}
            style={{
              backgroundColor: isDragging ? '#f0fdf4' : 'white',
              borderRadius: '12px',
              border: isDragging ? '2px dashed #10b981' : '2px solid #d1fae5',
              padding: '1.5rem',
              minHeight: '200px',
              transition: 'all 0.2s ease'
            }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #d1fae5'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: '#10b981',
                borderRadius: '50%'
              }}></div>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#1e293b',
                margin: 0
              }}>
                Clientes Ativos ({filteredCustomers.filter(c => c.status === 'customer').length})
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '100px' }}>
              {filteredCustomers.filter(customer => customer.status === 'customer').map(customer => (
                <CustomerKanbanCard key={customer.id} customer={customer} customerStats={customerStats} handleEditCustomer={handleEditCustomer} handleDeleteCustomer={handleDeleteCustomer} />
              ))}
              {filteredCustomers.filter(customer => customer.status === 'customer').length === 0 && (
                <div style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: '#64748b', 
                  fontSize: '0.875rem',
                  fontStyle: 'italic'
                }}>
                  Arraste clientes aqui
                </div>
              )}
            </div>
          </div>

          {/* Inactive Column */}
          <div 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'inactive')}
            onDragEnter={handleDragEnter}
            style={{
              backgroundColor: isDragging ? '#fef2f2' : 'white',
              borderRadius: '12px',
              border: isDragging ? '2px dashed #ef4444' : '2px solid #fee2e2',
              padding: '1.5rem',
              minHeight: '200px',
              transition: 'all 0.2s ease'
            }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #fee2e2'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: '#6b7280',
                borderRadius: '50%'
              }}></div>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#1e293b',
                margin: 0
              }}>
                Inativos ({filteredCustomers.filter(c => c.status === 'inactive').length})
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '100px' }}>
              {filteredCustomers.filter(customer => customer.status === 'inactive').map(customer => (
                <CustomerKanbanCard key={customer.id} customer={customer} customerStats={customerStats} handleEditCustomer={handleEditCustomer} handleDeleteCustomer={handleDeleteCustomer} />
              ))}
              {filteredCustomers.filter(customer => customer.status === 'inactive').length === 0 && (
                <div style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: '#64748b', 
                  fontSize: '0.875rem',
                  fontStyle: 'italic'
                }}>
                  Arraste clientes aqui
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          padding: '1.5rem'
        }}>
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
              📋 Lista de Clientes ({filteredCustomers.length} clientes)
            </h6>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
              Mostrar mais 10 clientes
            </div>
          </div>

        {filteredCustomers.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            color: '#6b7280',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            Nenhum cliente encontrado
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredCustomers.map((customer) => {
              const getStatusColors = (status) => {
                switch (status) {
                  case 'customer': return { bg: '#d1fae5', text: '#065f46', label: 'Ativo', border: '#a7f3d0' }
                  case 'inactive': return { bg: '#fee2e2', text: '#991b1b', label: 'Inativo', border: '#fca5a5' }
                  case 'lead': return { bg: '#f3f0ff', text: '#7c3aed', label: 'Novo Lead', border: '#c4b5fd' }
                  default: return { bg: '#f1f5f9', text: '#475569', label: 'Indefinido', border: '#cbd5e1' }
                }
              }

              const statusColors = getStatusColors(customer.status)
              const stats = customerStats[customer.id] || { totalTickets: 0, totalSpent: 0, paidOrders: 0 }

              return (
                <div
                  key={customer.id}
                  className="autofood-card"
                >
                  {/* Left Content */}
                  <div style={{
                    display: 'flex',
                    gap: isMobile ? '0.75rem' : '1rem',
                    flex: 1,
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center'
                  }}>
                    {/* Customer Info */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Header com nome e valor total */}
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
                            {customer.name}
                          </h3>
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#6b7280',
                            fontWeight: '500',
                            marginTop: '0.25rem'
                          }}>
                            {customer.phone}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginTop: '0.25rem'
                          }}>
                            CPF: {customer.cpf || 'Não informado'} • RG: {customer.rg || 'Não informado'} • {isMobile ? '' : 'Nascimento: '}{customer.age ? new Date(customer.age + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informado'}
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
                            R$ {stats.totalSpent.toFixed(2)}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginTop: '0.25rem'
                          }}>
                            Total gasto
                          </div>
                        </div>
                      </div>
                      
                      {/* Informações de contato e estatísticas */}
                      <div style={{
                        padding: '0.5rem 0'
                      }}>
                        <div style={{
                          fontSize: '0.85rem',
                          color: '#1f2937',
                          fontWeight: '500',
                          marginBottom: '0.5rem'
                        }}>
                          {customer.email}
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: isMobile ? '0.75rem' : '1rem',
                          fontSize: isMobile ? '0.8rem' : '0.85rem',
                          color: '#1f2937',
                          fontWeight: '500',
                          flexDirection: isMobile ? 'column' : 'row',
                          marginTop: isMobile ? '0.5rem' : '0'
                        }}>
                          <span>{stats.totalTickets} pedidos</span>
                          <span>{stats.paidOrders} pagos</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Content */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    {/* Status Badge */}
                    <span style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: statusColors.bg,
                      color: statusColors.text,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      border: `1px solid ${statusColors.border || statusColors.bg}`
                    }}>
                      {statusColors.label}
                    </span>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditCustomer(customer)
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
                          handleDeleteCustomer(customer)
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
      )}

      <CustomerModal 
        show={showModal}
        onHide={() => setShowModal(false)}
        customer={selectedCustomer}
        onSuccess={handleModalSuccess}
      />

      <ConfirmModal
        show={showConfirmModal}
        onHide={cancelDeleteCustomer}
        onConfirm={confirmDeleteCustomer}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o cliente "${customerToDelete?.name}"? Esta ação não pode ser desfeita e todos os ingressos relacionados também serão excluídos.`}
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </div>
  )
}

export default Customers
