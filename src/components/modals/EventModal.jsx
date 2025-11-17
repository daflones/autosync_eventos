import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Form, Row, Col } from 'react-bootstrap'
import { supabase } from '../../services/supabase'
import useResponsive from '../../hooks/useResponsive'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import SectorModal from './SectorModal'

const defaultSector = () => ({
  sector_id: null,
  name: '',
  price: '',
  lot: '',
  rules: {},
  active: true
})

const generateLocalId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const defaultDate = (date = '') => ({ id: generateLocalId(), date })

const EventModal = ({ show, onHide, onSuccess, event = null }) => {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    horario: '',
    local: '',
    informacoes: '',
    setores: [defaultSector()],
    dates: [defaultDate()]
  })
  const [availableSectors, setAvailableSectors] = useState([])
  const [sectorModalState, setSectorModalState] = useState({ show: false, index: null, sector: null })
  const [supportsDatesColumn, setSupportsDatesColumn] = useState(true)

  useEffect(() => {
    if (show) {
      loadSectors()
      checkDatesColumn()
    }
  }, [show])

  useEffect(() => {
    if (event) {
      setFormData({
        nome: event.nome || '',
        horario: event.horario || '',
        local: event.local || '',
        informacoes: event.informacoes || '',
        dates: Array.isArray(event.dates) && event.dates.length > 0
          ? event.dates.map(dateString => defaultDate(typeof dateString === 'string' ? dateString : dateString?.date || ''))
          : Array.isArray(event.datas) && event.datas.length > 0
            ? event.datas.map(dateValue => defaultDate(typeof dateValue === 'string' ? dateValue : dateValue?.date || ''))
            : [defaultDate(event.data ? event.data.split('T')[0] : '')],
        setores: Array.isArray(event.sectors_config) && event.sectors_config.length > 0
          ? event.sectors_config.map(sector => ({
              sector_id: sector.sector_id || null,
              name: sector.name || '',
              price: sector.price || '',
              lot: sector.lot || '',
              rules: sector.rules || {},
              active: sector.active !== false
            }))
          : [defaultSector()]
      })
    } else {
      setFormData({
        nome: '',
        horario: '',
        local: '',
        informacoes: '',
        dates: [defaultDate()],
        setores: [defaultSector()]
      })
    }
  }, [event])

  const checkDatesColumn = async () => {
    try {
      const { error } = await supabase
        .from('events')
        .select('dates')
        .limit(1)

      if (error) {
        const message = error.message?.toLowerCase?.() || ''
        if (message.includes('column') && message.includes('dates')) {
          setSupportsDatesColumn(false)
          return
        }
        throw error
      }

      setSupportsDatesColumn(true)
    } catch (error) {
      console.error('Erro ao verificar coluna dates:', error)
      setSupportsDatesColumn(false)
    }
  }

  const loadSectors = async () => {
    try {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setAvailableSectors(data || [])
    } catch (error) {
      console.error('Erro ao carregar setores:', error)
      toast.error('Erro ao carregar setores')
    }
  }

  const handleChangeField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleDateChange = (id, value) => {
    setFormData(prev => ({
      ...prev,
      dates: prev.dates.map(date => date.id === id ? { ...date, date: value } : date)
    }))
  }

  const addDate = () => {
    setFormData(prev => ({
      ...prev,
      dates: [...prev.dates, defaultDate()]
    }))
  }

  const removeDate = (id) => {
    setFormData(prev => ({
      ...prev,
      dates: prev.dates.length > 1 ? prev.dates.filter(date => date.id !== id) : prev.dates
    }))
  }

  const handleSectorFieldChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      setores: prev.setores.map((sector, idx) => (
        idx === index
          ? { ...sector, [field]: value }
          : sector
      ))
    }))
  }

  const addSector = () => {
    setFormData(prev => ({
      ...prev,
      setores: [...prev.setores, defaultSector()]
    }))
  }

  const removeSector = (index) => {
    setFormData(prev => ({
      ...prev,
      setores: prev.setores.length > 1
        ? prev.setores.filter((_, idx) => idx !== index)
        : prev.setores
    }))
  }

  const handleSelectExistingSector = (index, sectorId) => {
    const selected = availableSectors.find(s => s.id === sectorId)
    if (!selected) {
      handleSectorFieldChange(index, 'sector_id', null)
      return
    }
    setFormData(prev => ({
      ...prev,
      setores: prev.setores.map((sector, idx) => (
        idx === index
          ? {
              sector_id: selected.id,
              name: selected.name,
              price: selected.default_price || '',
              lot: selected.default_lot || '',
              rules: selected.rules || {},
              active: selected.active
            }
          : sector
      ))
    }))
  }

  const openSectorModal = (index, sectorId = null) => {
    const baseSector = sectorId ? availableSectors.find(s => s.id === sectorId) : null
    setSectorModalState({ show: true, index, sector: baseSector || null })
  }

  const closeSectorModal = () => {
    setSectorModalState({ show: false, index: null, sector: null })
  }

  const handleSectorModalSuccess = (savedSector) => {
    if (!savedSector || sectorModalState.index === null) {
      closeSectorModal()
      return
    }

    setAvailableSectors(prev => {
      const exists = prev.some(item => item.id === savedSector.id)
      if (exists) {
        return prev.map(item => (item.id === savedSector.id ? savedSector : item))
      }
      return [...prev, savedSector]
    })

    setFormData(prev => {
      const setoresAtualizados = prev.setores.map((sector, idx) => {
        if (idx !== sectorModalState.index) return sector

        const hasCustomPrice = sector.price && sector.price !== ''
        const hasCustomLot = sector.lot && sector.lot !== ''
        const hasCustomRules = sector.rules && Object.keys(sector.rules).length > 0 && sector.rules.notes

        return {
          sector_id: savedSector.id,
          name: savedSector.name,
          price: hasCustomPrice ? sector.price : (savedSector.default_price || ''),
          lot: hasCustomLot ? sector.lot : (savedSector.default_lot || ''),
          rules: hasCustomRules ? sector.rules : (savedSector.rules || {}),
          active: savedSector.active
        }
      })

      return {
        ...prev,
        setores: setoresAtualizados
      }
    })

    closeSectorModal()
  }

  const normalizedDates = useMemo(() => (
    formData.dates
      .map(date => date.date)
      .filter(Boolean)
  ), [formData.dates])

  const normalizedSectors = useMemo(() => (
    formData.setores
      .filter(sector => sector.name.trim() !== '')
      .map(sector => ({
        sector_id: sector.sector_id,
        name: sector.name.trim(),
        price: sector.price?.trim() || null,
        lot: sector.lot?.trim() || null,
        rules: sector.rules || {},
        active: sector.active !== false
      }))
  ), [formData.setores])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!formData.nome.trim()) {
        toast.error('Informe o nome do evento')
        return
      }

      if (normalizedDates.length === 0) {
        toast.error('Adicione ao menos uma data')
        return
      }

      if (normalizedSectors.length === 0) {
        toast.error('Configure ao menos um setor')
        return
      }

      const eventPayload = {
        nome: formData.nome.trim(),
        horario: formData.horario || null,
        local: formData.local?.trim() || null,
        informacoes: formData.informacoes || null,
        data: normalizedDates[0] || null,
        sectors_config: normalizedSectors
      }

      if (supportsDatesColumn) {
        eventPayload.dates = normalizedDates
      }

      if (!supportsDatesColumn || (event && Object.prototype.hasOwnProperty.call(event, 'datas'))) {
        eventPayload.datas = normalizedDates
      }

      let response
      if (event?.id) {
        response = await supabase
          .from('events')
          .update(eventPayload)
          .eq('id', event.id)
      } else {
        response = await supabase
          .from('events')
          .insert([eventPayload])
      }

      if (response.error) throw response.error

      toast.success(event ? 'Evento atualizado com sucesso!' : 'Evento criado com sucesso!')
      onSuccess?.()
      onHide?.()
    } catch (error) {
      console.error('Erro ao salvar evento:', error)
      toast.error(error?.message || error?.details || 'Erro ao salvar evento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Modal show={show} onHide={onHide} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{event ? 'Editar Evento' : 'Novo Evento'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body style={{ padding: isMobile ? '1rem' : '1.5rem' }}>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome do Evento *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.nome}
                    onChange={(e) => handleChangeField('nome', e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Horário padrão</Form.Label>
                  <Form.Control
                    type="time"
                    value={formData.horario || ''}
                    onChange={(e) => handleChangeField('horario', e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Local</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.local}
                    onChange={(e) => handleChangeField('local', e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Label>Datas do Evento *</Form.Label>
              {formData.dates.map((date, index) => (
                <div key={date.id} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                  <Form.Control
                    type="date"
                    value={date.date || ''}
                    onChange={(e) => handleDateChange(date.id, e.target.value)}
                    required={index === 0}
                    style={{ flex: isMobile ? '1' : '0 0 240px' }}
                  />
                  {formData.dates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDate(date.id)}
                      style={{
                        backgroundColor: '#fee2e2',
                        border: '1px solid #fecaca',
                        color: '#b91c1c',
                        borderRadius: '8px',
                        padding: '0.45rem 0.65rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addDate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#6366f1',
                  background: 'none',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} /> Adicionar data
              </button>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Informações Adicionais</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.informacoes}
                onChange={(e) => handleChangeField('informacoes', e.target.value)}
              />
            </Form.Group>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h5 style={{ margin: 0 }}>Informações de Setores, Lote e Preço do Evento</h5>
              <button
                type="button"
                onClick={addSector}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} /> Adicionar setor
              </button>
            </div>

            {formData.setores.map((sector, index) => (
              <div key={index} style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1rem',
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem'
                }}>
                  <strong>Setor {index + 1}</strong>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {formData.setores.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSector(index)}
                        style={{
                          backgroundColor: '#fee2e2',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          padding: '0.35rem 0.6rem',
                          cursor: 'pointer',
                          color: '#b91c1c'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Setor existente</Form.Label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Form.Select
                          value={sector.sector_id || ''}
                          onChange={(e) => handleSelectExistingSector(index, e.target.value || null)}
                        >
                          <option value="">-- Selecionar setor --</option>
                          {availableSectors
                            .filter(option => option.active || option.id === sector.sector_id)
                            .map(option => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                                {!option.active ? ' (inativo)' : ''}
                              </option>
                            ))}
                        </Form.Select>
                        <button
                          type="button"
                          onClick={() => openSectorModal(index)}
                          style={{
                            backgroundColor: '#e0e7ff',
                            border: '1px solid #c7d2fe',
                            borderRadius: '8px',
                            padding: '0.35rem 0.6rem',
                            cursor: 'pointer',
                            color: '#4338ca'
                          }}
                          title="Criar novo setor"
                        >
                          <Plus size={14} />
                        </button>
                        {sector.sector_id && (
                          <button
                            type="button"
                            onClick={() => openSectorModal(index, sector.sector_id)}
                            style={{
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '0.35rem 0.6rem',
                              cursor: 'pointer',
                              color: '#475569'
                            }}
                            title="Editar setor global"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nome do setor *</Form.Label>
                      <Form.Control
                        type="text"
                        value={sector.name}
                        onChange={(e) => handleSectorFieldChange(index, 'name', e.target.value)}
                        placeholder="Ex: Frontstage"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Valor do ingresso</Form.Label>
                      <Form.Control
                        type="text"
                        value={sector.price || ''}
                        onChange={(e) => handleSectorFieldChange(index, 'price', e.target.value)}
                        placeholder="R$ 100,00"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Lote / Descrição</Form.Label>
                      <Form.Control
                        type="text"
                        value={sector.lot || ''}
                        onChange={(e) => handleSectorFieldChange(index, 'lot', e.target.value)}
                        placeholder="Lote 1, Promoção, VIP..."
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Regras / Observações</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={sector.rules?.notes || ''}
                    onChange={(e) => handleSectorFieldChange(index, 'rules', { ...(sector.rules || {}), notes: e.target.value })}
                    placeholder="Detalhes, requisitos ou regras específicas para este setor"
                  />
                </Form.Group>

                <Form.Check
                  type="switch"
                  id={`sector-active-${index}`}
                  label="Setor ativo para este evento"
                  checked={sector.active !== false}
                  onChange={(e) => handleSectorFieldChange(index, 'active', e.target.checked)}
                />
              </div>
            ))}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={onHide}>
              Cancelar
            </Button>
            <button
              type="submit"
              className="btn"
              disabled={loading}
              style={{
                backgroundColor: '#8b5cf6',
                borderColor: '#8b5cf6',
                color: 'white',
                border: '1px solid #8b5cf6',
                padding: '0.5rem 1.2rem',
                borderRadius: '0.375rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Salvando...' : (event ? 'Atualizar' : 'Criar evento')}
            </button>
          </Modal.Footer>
        </Form>
      </Modal>

      <SectorModal
        show={sectorModalState.show}
        onHide={closeSectorModal}
        sector={sectorModalState.sector}
        onSuccess={handleSectorModalSuccess}
      />
    </>
  )
}

export default EventModal
