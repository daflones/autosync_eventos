import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Edit2, Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '../services/supabase'
import SectorModal from '../components/modals/SectorModal'
import ConfirmModal from '../components/modals/ConfirmModal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import useResponsive from '../hooks/useResponsive'
import toast from 'react-hot-toast'

const EventSectors = () => {
  const { isMobile } = useResponsive()
  const [sectors, setSectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedSector, setSelectedSector] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [sectorToDelete, setSectorToDelete] = useState(null)
  const [updatingSectorId, setUpdatingSectorId] = useState(null)

  useEffect(() => {
    loadSectors()
  }, [])

  const loadSectors = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setSectors(data || [])
    } catch (error) {
      console.error('Erro ao carregar setores:', error)
      toast.error('Erro ao carregar setores')
    } finally {
      setLoading(false)
    }
  }

  const filteredSectors = useMemo(() => {
    if (!searchTerm) return sectors
    return sectors.filter(sector =>
      sector.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sector.default_lot?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [sectors, searchTerm])

  const handleNewSector = () => {
    setSelectedSector(null)
    setShowModal(true)
  }

  const handleEditSector = (sector) => {
    setSelectedSector(sector)
    setShowModal(true)
  }

  const requestDeleteSector = (sector) => {
    setSectorToDelete(sector)
    setShowConfirmModal(true)
  }

  const handleDeleteSector = async () => {
    if (!sectorToDelete?.id) return

    try {
      const { error } = await supabase
        .from('sectors')
        .delete()
        .eq('id', sectorToDelete.id)

      if (error) throw error

      toast.success('Setor excluído com sucesso!')
      setShowConfirmModal(false)
      setSectorToDelete(null)
      loadSectors()
    } catch (error) {
      console.error('Erro ao excluir setor:', error)
      toast.error('Erro ao excluir setor')
    }
  }

  const handleToggleActive = async (sector) => {
    setUpdatingSectorId(sector.id)
    try {
      const { error } = await supabase
        .from('sectors')
        .update({ active: !sector.active })
        .eq('id', sector.id)

      if (error) throw error

      setSectors(prev => prev.map(item =>
        item.id === sector.id ? { ...item, active: !sector.active } : item
      ))
      toast.success(`Setor ${!sector.active ? 'ativado' : 'desativado'} com sucesso!`)
    } catch (error) {
      console.error('Erro ao atualizar setor:', error)
      toast.error('Erro ao atualizar setor')
    } finally {
      setUpdatingSectorId(null)
    }
  }

  const handleModalSuccess = () => {
    setShowModal(false)
    setSelectedSector(null)
    loadSectors()
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh'
      }}>
        <LoadingSpinner text="Carregando setores..." />
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      padding: isMobile ? '0.5rem' : '1rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '1rem',
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
            Setores
          </h1>
          <p style={{
            margin: 0,
            color: '#64748b',
            maxWidth: '620px'
          }}>
            Gerencie os setores disponíveis para uso nos eventos. Somente setores ativos aparecem para seleção nas campanhas e vendas.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={loadSectors}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
          <button
            onClick={handleNewSector}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#7c3aed'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#8b5cf6'}
          >
            <Plus size={18} />
            Novo Setor
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: isMobile ? '1.5rem' : '2rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #f1f5f9'
      }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1e293b', marginBottom: '1.5rem' }}>Filtrar setores</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>Buscar por nome ou lote</label>
            <input
              type="text"
              placeholder="Ex: Frontstage"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
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
      </div>

      {/* Lista */}
      {filteredSectors.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#6b7280',
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          Nenhum setor encontrado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredSectors.map((sector) => (
            <div
              key={sector.id}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: isMobile ? '1.25rem' : '1.75rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)'
              }}
            >
              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                gap: '1rem'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#111827'
                    }}>
                      {sector.name}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: sector.active ? '#dcfce7' : '#fee2e2',
                      color: sector.active ? '#15803d' : '#b91c1c'
                    }}>
                      {sector.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '1rem',
                    marginTop: '0.75rem',
                    fontSize: '0.95rem',
                    color: '#475569'
                  }}>
                    {sector.default_price && (
                      <span><strong>Valor padrão:</strong> {sector.default_price}</span>
                    )}
                    {sector.default_lot && (
                      <span><strong>Lote padrão:</strong> {sector.default_lot}</span>
                    )}
                  </div>

                  {sector.rules?.notes && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.85rem',
                      color: '#475569'
                    }}>
                      <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#334155' }}>Regras / Observações:</strong>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{sector.rules.notes}</span>
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: '0.75rem',
                  alignItems: 'stretch'
                }}>
                  <button
                    onClick={() => handleToggleActive(sector)}
                    disabled={updatingSectorId === sector.id}
                    style={{
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: sector.active ? '#fecdd3' : '#dcfce7',
                      color: sector.active ? '#b91c1c' : '#15803d',
                      fontWeight: '600',
                      cursor: updatingSectorId === sector.id ? 'wait' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {sector.active ? 'Desativar' : 'Ativar'}
                  </button>

                  <button
                    onClick={() => handleEditSector(sector)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: 'white',
                      color: '#475569',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#f8fafc'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'white'
                    }}
                  >
                    <Edit2 size={16} style={{ marginRight: '0.5rem' }} />
                    Editar
                  </button>

                  <button
                    onClick={() => requestDeleteSector(sector)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid #fee2e2',
                      backgroundColor: '#fef2f2',
                      color: '#b91c1c',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#fee2e2'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#fef2f2'
                    }}
                  >
                    <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectorModal
        show={showModal}
        onHide={() => setShowModal(false)}
        sector={selectedSector}
        onSuccess={handleModalSuccess}
      />

      <ConfirmModal
        show={showConfirmModal}
        onHide={() => setShowConfirmModal(false)}
        onConfirm={handleDeleteSector}
        title="Excluir setor"
        message={sectorToDelete ? `Tem certeza que deseja excluir o setor "${sectorToDelete.name}"? Essa ação não pode ser desfeita.` : 'Tem certeza que deseja excluir este setor?'}
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </div>
  )
}

export default EventSectors
