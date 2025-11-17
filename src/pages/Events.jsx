import React, { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../services/supabase'
import EventModal from '../components/modals/EventModal'
import ConfirmModal from '../components/modals/ConfirmModal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import useResponsive from '../hooks/useResponsive'
import toast from 'react-hot-toast'

const Events = () => {
  const { isMobile, isTablet } = useResponsive()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventToDelete, setEventToDelete] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedEvents, setExpandedEvents] = useState(new Set())

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    setLoading(true)
    try {
      // Carregar eventos
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('data', { ascending: false })

      if (eventsError) throw eventsError

      // Carregar contagem de ingressos por evento (apenas pagos)
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('event_id, quantity, payment_status')

      if (ticketsError) throw ticketsError

      // Calcular estatísticas por evento
      const eventsWithStats = eventsData.map(event => {
        const eventTickets = ticketsData.filter(ticket => ticket.event_id === event.id)
        // Contar apenas ingressos pagos como vendidos
        const paidTickets = eventTickets.filter(ticket => ticket.payment_status === 'paid')
        const totalTicketsSold = paidTickets.reduce((sum, ticket) => sum + (ticket.quantity || 0), 0)
        
        return {
          ...event,
          totalTicketsSold: totalTicketsSold,
          totalOrders: eventTickets.length,
          paidOrders: paidTickets.length
        }
      })

      setEvents(eventsWithStats || [])
    } catch (error) {
      toast.error('Erro ao carregar eventos')
    } finally {
      setLoading(false)
    }
  }

  const handleNewEvent = () => {
    setSelectedEvent(null)
    setShowModal(true)
  }

  const handleEditEvent = (event) => {
    setSelectedEvent(event)
    setShowModal(true)
  }

  const handleDeleteEvent = (eventId) => {
    setEventToDelete(eventId)
    setShowConfirmModal(true)
  }

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return
    
    try {
      // Primeiro, buscar IDs dos tickets do evento
      const { data: ticketIds, error: ticketIdsError } = await supabase
        .from('tickets')
        .select('id')
        .eq('event_id', eventToDelete)
      
      if (ticketIdsError) {
      }
      
      // Excluir mensagens relacionadas aos tickets
      if (ticketIds && ticketIds.length > 0) {
        const ticketIdArray = ticketIds.map(ticket => ticket.id)
        const { error: messagesError } = await supabase
          .from('messages')
          .delete()
          .in('ticket_id', ticketIdArray)
        
        if (messagesError) {
        }
      }
      
      // Depois, excluir tickets do evento
      const { error: ticketsError } = await supabase
        .from('tickets')
        .delete()
        .eq('event_id', eventToDelete)
      
      if (ticketsError) {
        throw ticketsError
      }
      
      // Por último, excluir o evento
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventToDelete)

      if (error) {
        throw error
      }

      toast.success('Evento excluído com sucesso!')
      loadEvents()
      setShowConfirmModal(false)
      setEventToDelete(null)
    } catch (error) {
      toast.error(`Erro ao excluir evento: ${error.message}`)
    }
  }

  const cancelDeleteEvent = () => {
    setShowConfirmModal(false)
    setEventToDelete(null)
  }

  const handleModalSuccess = () => {
    setShowModal(false)
    setSelectedEvent(null)
    loadEvents()
  }

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.local?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <LoadingSpinner text="Carregando eventos..." />
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
            Eventos
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
          <button 
            onClick={handleNewEvent}
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
            Novo Evento
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
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
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
            <Search size={20} color="#8b5cf6" />
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
              Buscar evento
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
                placeholder="Buscar por nome, descrição..."
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
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="completed">Finalizado</option>
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

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          color: '#6b7280',
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          Nenhum evento encontrado
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredEvents.map((event) => {
            // Determinar status baseado na data do evento
            const eventDate = new Date(event.data)
            const currentDate = new Date()
            currentDate.setHours(0, 0, 0, 0)

            const getStatusColor = (eventDateObj) => {
              if (!(eventDateObj instanceof Date) || Number.isNaN(eventDateObj.getTime())) {
                return { bg: '#dbeafe', text: '#1e40af', label: 'Programado', border: '#93c5fd' }
              }

              const compareDate = new Date(eventDateObj.getFullYear(), eventDateObj.getMonth(), eventDateObj.getDate())

              if (compareDate < currentDate) {
                return { bg: '#f1f5f9', text: '#475569', label: 'Finalizado', border: '#cbd5e1' }
              }

              return { bg: '#dbeafe', text: '#1e40af', label: 'Programado', border: '#93c5fd' }
            }

            const normalizeDateValue = (value) => {
              if (!value) return null
              if (typeof value === 'string') return value
              if (typeof value === 'object') {
                if (value.date) return value.date
                if (value.value) return value.value
              }
              return null
            }

            const extractDateParts = (value) => {
              const normalized = normalizeDateValue(value)
              if (!normalized) return null
              const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(normalized)
              if (!match) return null
              const [, year, month, day] = match
              return {
                year: Number(year),
                month: Number(month),
                day: Number(day)
              }
            }

            const formatDateParts = ({ day, month, year }) => {
              const dd = String(day).padStart(2, '0')
              const mm = String(month).padStart(2, '0')
              return `${dd}/${mm}/${year}`
            }

            const toDateObject = (parts) => new Date(parts.year, parts.month - 1, parts.day)

            const rawDates = Array.isArray(event.dates)
              ? event.dates
              : Array.isArray(event.datas)
                ? event.datas
                : event.data
                  ? [event.data]
                  : []

            const datePartsList = rawDates
              .map(extractDateParts)
              .filter(Boolean)

            const formattedDates = datePartsList.map((parts, index) => ({
              id: `${event.id}-date-${index}`,
              label: formatDateParts(parts),
              dateObj: toDateObject(parts)
            }))

            const fallbackDateParts = extractDateParts(event.data)
            const primaryDateObj = formattedDates[0]?.dateObj || (fallbackDateParts ? toDateObject(fallbackDateParts) : null)
            const summaryDateLabel = formattedDates[0]?.label
              || (fallbackDateParts ? formatDateParts(fallbackDateParts) : 'Data não informada')

            const statusColors = getStatusColor(primaryDateObj)

            const sectors = Array.isArray(event.sectors_config) ? event.sectors_config : []
            const activeSectorsCount = sectors.filter((sector) => sector?.active !== false).length

            return (
              <div
                key={event.id}
                className="autofood-card"
              >
                {/* Left Content */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '0.75rem' : '1rem',
                  flex: 1,
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center'
                }}>
                  
                  {/* Event Info */}
                  <div style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: isMobile ? '0.9rem' : '0.95rem',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '0.25rem'
                    }}>
                      {event.nome}
                    </h3>
                    <div style={{
                      display: 'flex',
                      gap: isMobile ? '0.75rem' : '1rem',
                      fontSize: isMobile ? '0.8rem' : '0.85rem',
                      color: '#6b7280',
                      flexDirection: isMobile ? 'column' : 'row',
                      marginTop: isMobile ? '0.5rem' : '0'
                    }}>
                      <span>{summaryDateLabel}</span>
                      <span>{event.local}</span>
                      <span>🎫 {event.totalTicketsSold || 0} vendidos</span>
                    </div>
                    
                    {/* Expanded Event Details */}
                    {expandedEvents.has(event.id) && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1.25rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 8px rgba(148, 163, 184, 0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem'
                      }}>
                        <section>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.75rem'
                          }}>
                            <strong style={{ color: '#1f2937' }}>Datas do evento</strong>
                            {event.horario && (
                              <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '0.8rem' }}>
                                Horário padrão: {event.horario}
                              </span>
                            )}
                          </div>
                          {formattedDates.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {formattedDates.map((dateInfo) => (
                                <span
                                  key={dateInfo.id}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    backgroundColor: '#e0e7ff',
                                    borderRadius: '999px',
                                    fontSize: '0.8rem',
                                    color: '#312e81',
                                    fontWeight: 600
                                  }}
                                >
                                  {dateInfo.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem' }}>
                              Nenhuma data cadastrada.
                            </span>
                          )}
                        </section>

                        <section>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.75rem'
                          }}>
                            <strong style={{ color: '#1f2937' }}>Setores</strong>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {activeSectorsCount} ativos · {sectors.length} cadastrados
                            </span>
                          </div>
                          {sectors.length > 0 ? (
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
                              gap: '0.8rem'
                            }}>
                              {sectors.map((sector, idx) => (
                                <div
                                  key={`${sector?.sector_id || sector?.name || idx}`}
                                  style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '0.9rem',
                                    backgroundColor: 'white',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem'
                                  }}
                                >
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}>
                                    <span style={{ fontWeight: 600, color: '#1f2937' }}>
                                      {sector?.name || 'Setor sem nome'}
                                    </span>
                                    <span style={{
                                      fontSize: '0.75rem',
                                      padding: '0.15rem 0.55rem',
                                      borderRadius: '999px',
                                      backgroundColor: sector?.active !== false ? '#dcfce7' : '#fee2e2',
                                      color: sector?.active !== false ? '#15803d' : '#b91c1c'
                                    }}>
                                      {sector?.active !== false ? 'Ativo' : 'Inativo'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                                    <div>
                                      <strong style={{ color: '#1e293b' }}>Preço:</strong>{' '}
                                      {sector?.price ? sector.price : 'Não informado'}
                                    </div>
                                    <div>
                                      <strong style={{ color: '#1e293b' }}>Lote:</strong>{' '}
                                      {sector?.lot ? sector.lot : 'Não informado'}
                                    </div>
                                  </div>
                                  {sector?.rules?.notes && (
                                    <div style={{
                                      marginTop: '0.35rem',
                                      padding: '0.5rem',
                                      borderRadius: '8px',
                                      backgroundColor: '#f1f5f9',
                                      fontSize: '0.78rem',
                                      color: '#475569',
                                      whiteSpace: 'pre-wrap'
                                    }}>
                                      {sector.rules.notes}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem' }}>
                              Nenhum setor configurado.
                            </span>
                          )}
                        </section>

                        <section>
                          <strong style={{ color: '#1f2937', display: 'block', marginBottom: '0.5rem' }}>
                            Informações gerais
                          </strong>
                          {event.informacoes ? (
                            <div style={{
                              color: '#475569',
                              backgroundColor: '#eef2ff',
                              borderRadius: '8px',
                              padding: '0.75rem',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.45
                            }}>
                              {event.informacoes}
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem' }}>
                              Nenhuma descrição foi adicionada para este evento.
                            </span>
                          )}
                        </section>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Content */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '0.75rem' : '0.75rem',
                  flexDirection: isMobile ? 'column' : 'row',
                  width: isMobile ? '100%' : 'auto',
                  justifyContent: isMobile ? 'stretch' : 'flex-start'
                }}>
                  {/* Status Badge */}
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: statusColors.bg,
                    color: statusColors.text,
                    whiteSpace: 'nowrap'
                  }}>
                    {statusColors.label}
                  </span>

                  {/* Show/Hide Details Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedEvents(prev => {
                        const newSet = new Set(prev)
                        if (newSet.has(event.id)) {
                          newSet.delete(event.id)
                        } else {
                          newSet.add(event.id)
                        }
                        return newSet
                      })
                    }}
                    style={{
                      padding: isMobile ? '0.75rem 1rem' : '0.6rem 1rem',
                      backgroundColor: expandedEvents.has(event.id) ? '#f59e0b' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: isMobile ? '0.8rem' : '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      width: isMobile ? '100%' : 'auto',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-1px)'
                      e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)'
                      e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {expandedEvents.has(event.id) ? 'Ocultar informações' : 'Mostrar informações'}
                  </button>

                  {/* Actions */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem',
                    width: isMobile ? '100%' : 'auto',
                    justifyContent: isMobile ? 'space-between' : 'flex-start'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditEvent(event)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: isMobile ? '44px' : '36px',
                        height: isMobile ? '44px' : '36px',
                        backgroundColor: 'transparent',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        flex: isMobile ? '1' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f9fafb'
                        e.target.style.borderColor = '#d1d5db'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent'
                        e.target.style.borderColor = '#e5e7eb'
                      }}
                    >
                      <Edit2 size={isMobile ? 16 : 14} color="#6b7280" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteEvent(event.id)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: isMobile ? '44px' : '36px',
                        height: isMobile ? '44px' : '36px',
                        backgroundColor: 'transparent',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        flex: isMobile ? '1' : 'none'
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
                      <Trash2 size={isMobile ? 16 : 14} color="#dc2626" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <EventModal
        show={showModal}
        onHide={() => setShowModal(false)}
        event={selectedEvent}
        onSuccess={handleModalSuccess}
      />

      <ConfirmModal
        show={showConfirmModal}
        onHide={cancelDeleteEvent}
        onConfirm={confirmDeleteEvent}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita e todos os ingressos relacionados também serão excluídos."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </div>
  )
}

export default Events
