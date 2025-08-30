import React, { useState, useEffect } from 'react'
import { Modal, Button, Form, Row, Col } from 'react-bootstrap'
import { supabase } from '../../services/supabase'
import useResponsive from '../../hooks/useResponsive'
import toast from 'react-hot-toast'

const EventModal = ({ show, onHide, onSuccess, event = null }) => {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    data: '',
    horario: '',
    local: '',
    frontstage_on: false,
    areagold_on: false,
    lounge_on: false,
    pista_on: false,
    camarote_on: false,
    lote_frontsta: '',
    lote_areagold: '',
    lote_lounge: '',
    lote_pista: '',
    lote_camarote: '',
    valor_frontst: '',
    valor_areago: '',
    valor_lounge: '',
    valor_pista: '',
    valor_camarote: '',
    informacoes: '',
    regras_setor: 'FrontStage:                                   Área Gold:                       Pista:                    Camarote:                 '
  })

  // Update form data when event prop changes
  useEffect(() => {
    if (event) {
      setFormData({
        nome: event.nome || '',
        data: event.data ? event.data.split('T')[0] : '',
        horario: event.horario || '',
        local: event.local || '',
        frontstage_on: event.frontstage_on || false,
        areagold_on: event.areagold_on || false,
        lounge_on: event.lounge_on || false,
        pista_on: event.pista_on || false,
        camarote_on: event.camarote_on || false,
        lote_frontsta: event.lote_frontsta || '',
        lote_areagold: event.lote_areagold || '',
        lote_lounge: event.lote_lounge || '',
        lote_pista: event.lote_pista || '',
        lote_camarote: event.lote_camarote || '',
        valor_frontst: event.valor_frontst || '',
        valor_areago: event.valor_areago || '',
        valor_lounge: event.valor_lounge || '',
        valor_pista: event.valor_pista || '',
        valor_camarote: event.valor_camarote || '',
        informacoes: event.informacoes || '',
        regras_setor: event.regras_setor || ''
      })
    } else {
      // Reset form for new event
      setFormData({
        nome: '',
        data: '',
        horario: '',
        local: '',
        frontstage_on: false,
        areagold_on: false,
        lounge_on: false,
        pista_on: false,
        camarote_on: false,
        lote_frontsta: '',
        lote_areagold: '',
        lote_lounge: '',
        lote_pista: '',
        lote_camarote: '',
        valor_frontst: '',
        valor_areago: '',
        valor_lounge: '',
        valor_pista: '',
        valor_camarote: '',
        informacoes: '',
        regras_setor: 'FrontStage:                                   Área Gold:                       Pista:                    Camarote:                 '
      })
    }
  }, [event])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const eventData = {
        ...formData
      }

      let result
      if (event) {
        // Update existing event
        result = await supabase
          .from('events')
          .update(eventData)
          .eq('id', event.id)
      } else {
        // Create new event
        result = await supabase
          .from('events')
          .insert([eventData])
      }

      if (result.error) throw result.error

      toast.success(event ? 'Evento atualizado com sucesso!' : 'Evento criado com sucesso!')
      onSuccess()
      onHide()
    } catch (error) {
      console.error('Error saving event:', error)
      toast.error('Erro ao salvar evento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide} size={isMobile ? "sm" : "lg"}>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: isMobile ? '1.125rem' : '1.25rem' }}>
          {event ? 'Editar Evento' : 'Novo Evento'}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body style={{ padding: isMobile ? '1rem' : '1.5rem' }}>
          <Row>
            <Col md={isMobile ? 12 : 8}>
              <Form.Group className="mb-3">
                <Form.Label>Nome do Evento *</Form.Label>
                <Form.Control
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                  style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                />
              </Form.Group>
            </Col>
            <Col md={isMobile ? 12 : 4}>
              <Form.Group className="mb-3">
                <Form.Label>Data *</Form.Label>
                <Form.Control
                  type="date"
                  name="data"
                  value={formData.data}
                  onChange={handleChange}
                  required
                  style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={isMobile ? 12 : 6}>
              <Form.Group className="mb-3">
                <Form.Label>Horário</Form.Label>
                <Form.Control
                  type="time"
                  name="horario"
                  value={formData.horario}
                  onChange={handleChange}
                  style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                />
              </Form.Group>
            </Col>
            <Col md={isMobile ? 12 : 6}>
              <Form.Group className="mb-3">
                <Form.Label>Local</Form.Label>
                <Form.Control
                  type="text"
                  name="local"
                  value={formData.local}
                  onChange={handleChange}
                  style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                />
              </Form.Group>
            </Col>
          </Row>

          <h6 className="mb-3">Setores</h6>
          
          <Row>
            <Col md={isMobile ? 12 : 4}>
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  name="frontstage_on"
                  label="Frontstage"
                  checked={formData.frontstage_on}
                  onChange={handleChange}
                />
                {formData.frontstage_on && (
                  <>
                    <Form.Label className="mt-2">Lote</Form.Label>
                    <Form.Control
                      type="text"
                      name="lote_frontsta"
                      value={formData.lote_frontsta}
                      onChange={handleChange}
                      placeholder="Ex: Lote 1, Promocional, etc."
                    />
                    <Form.Label className="mt-2">Valor</Form.Label>
                    <Form.Control
                      type="text"
                      name="valor_frontst"
                      value={formData.valor_frontst}
                      onChange={handleChange}
                      placeholder="R$ 100,00"
                    />
                  </>
                )}
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  name="areagold_on"
                  label="Área Gold"
                  checked={formData.areagold_on}
                  onChange={handleChange}
                />
                {formData.areagold_on && (
                  <>
                    <Form.Label className="mt-2">Lote</Form.Label>
                    <Form.Control
                      type="text"
                      name="lote_areagold"
                      value={formData.lote_areagold}
                      onChange={handleChange}
                      placeholder="Ex: Lote 1, Promocional, etc."
                      style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                    />
                    <Form.Label className="mt-2">Valor</Form.Label>
                    <Form.Control
                      type="text"
                      name="valor_areago"
                      value={formData.valor_areago}
                      onChange={handleChange}
                      style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                    />
                  </>
                )}
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  name="lounge_on"
                  label="Lounge"
                  checked={formData.lounge_on}
                  onChange={handleChange}
                />
                {formData.lounge_on && (
                  <>
                    <Form.Label className="mt-2">Lote</Form.Label>
                    <Form.Control
                      type="text"
                      name="lote_lounge"
                      value={formData.lote_lounge}
                      onChange={handleChange}
                      placeholder="Ex: Lote 1, Promocional, etc."
                      style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                    />
                    <Form.Label className="mt-2">Valor</Form.Label>
                    <Form.Control
                      type="text"
                      name="valor_lounge"
                      value={formData.valor_lounge}
                      onChange={handleChange}
                      style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                    />
                  </>
                )}
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={isMobile ? 12 : 6}>
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  name="pista_on"
                  label="Pista"
                  checked={formData.pista_on}
                  onChange={handleChange}
                />
                {formData.pista_on && (
                  <>
                    <Form.Label className="mt-2">Lote</Form.Label>
                    <Form.Control
                      type="text"
                      name="lote_pista"
                      value={formData.lote_pista}
                      onChange={handleChange}
                      placeholder="Ex: Lote 1, Promocional, etc."
                      style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                    />
                    <Form.Label className="mt-2">Valor</Form.Label>
                    <Form.Control
                      type="text"
                      name="valor_pista"
                      value={formData.valor_pista}
                      onChange={handleChange}
                      placeholder="R$ 100,00"
                      style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                    />
                  </>
                )}
              </Form.Group>
            </Col>

            <Col md={isMobile ? 12 : 6}>
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  name="camarote_on"
                  label="Camarote"
                  checked={formData.camarote_on}
                  onChange={handleChange}
                />
                {formData.camarote_on && (
                  <>
                    <Form.Label className="mt-2">Lote</Form.Label>
                    <Form.Control
                      type="text"
                      name="lote_camarote"
                      value={formData.lote_camarote}
                      onChange={handleChange}
                      placeholder="Ex: Lote 1, Promocional, etc."
                      style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                    />
                    <Form.Label className="mt-2">Valor</Form.Label>
                    <Form.Control
                      type="text"
                      name="valor_camarote"
                      value={formData.valor_camarote}
                      onChange={handleChange}
                      placeholder="R$ 100,00"
                      style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                    />
                  </>
                )}
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Informações Adicionais</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="informacoes"
              value={formData.informacoes}
              onChange={handleChange}
              style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Regras de Setor</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="regras_setor"
              value={formData.regras_setor}
              onChange={handleChange}
              placeholder="Digite as regras específicas para cada setor do evento..."
              style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ 
          padding: isMobile ? '0.75rem' : '1rem',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '0.5rem' : '0'
        }}>
          <Button 
            variant="secondary" 
            onClick={onHide}
            style={{ 
              width: isMobile ? '100%' : 'auto',
              fontSize: isMobile ? '0.9rem' : '1rem'
            }}
          >
            Cancelar
          </Button>
          <button 
            type="submit" 
            disabled={loading}
            className="btn"
            style={{
              backgroundColor: '#8b5cf6',
              borderColor: '#8b5cf6',
              color: 'white',
              border: '1px solid #8b5cf6',
              padding: isMobile ? '0.625rem 1rem' : '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              width: isMobile ? '100%' : 'auto',
              fontSize: isMobile ? '0.9rem' : '1rem'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#7c3aed'
                e.target.style.borderColor = '#7c3aed'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#8b5cf6'
                e.target.style.borderColor = '#8b5cf6'
              }
            }}
          >
            {loading ? 'Salvando...' : (event ? 'Atualizar' : 'Criar Evento')}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

export default EventModal
