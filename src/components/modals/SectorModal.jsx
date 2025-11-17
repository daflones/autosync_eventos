import React, { useEffect, useState } from 'react'
import { Modal, Form, Button, Row, Col } from 'react-bootstrap'
import { supabase } from '../../services/supabase'
import useResponsive from '../../hooks/useResponsive'
import toast from 'react-hot-toast'

const defaultForm = {
  name: '',
  active: true,
  default_price: '',
  default_lot: '',
  rules_notes: ''
}

const SectorModal = ({ show, onHide, onSuccess, sector = null }) => {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState(defaultForm)

  useEffect(() => {
    if (sector) {
      setFormData({
        name: sector.name || '',
        active: sector.active ?? true,
        default_price: sector.default_price || '',
        default_lot: sector.default_lot || '',
        rules_notes: sector.rules?.notes || ''
      })
    } else {
      setFormData(defaultForm)
    }
  }, [sector])

  useEffect(() => {
    if (!show) {
      setFormData(defaultForm)
    }
  }, [show])

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
      const payload = {
        name: formData.name.trim(),
        active: formData.active,
        default_price: formData.default_price?.trim() || null,
        default_lot: formData.default_lot?.trim() || null,
        rules: formData.rules_notes?.trim()
          ? { notes: formData.rules_notes.trim() }
          : {}
      }

      let response
      if (sector?.id) {
        response = await supabase
          .from('sectors')
          .update(payload)
          .eq('id', sector.id)
          .select()
          .single()
      } else {
        response = await supabase
          .from('sectors')
          .insert([payload])
          .select()
          .single()
      }

      if (response.error) throw response.error

      toast.success(sector ? 'Setor atualizado com sucesso!' : 'Setor criado com sucesso!')
      onSuccess?.(response.data)
      onHide?.()
    } catch (error) {
      console.error('Erro ao salvar setor:', error)
      toast.error('Erro ao salvar setor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide} size={isMobile ? 'sm' : 'md'} centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: isMobile ? '1.125rem' : '1.25rem' }}>
          {sector ? 'Editar Setor' : 'Novo Setor'}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body style={{ padding: isMobile ? '1rem' : '1.5rem' }}>
          <Row>
            <Col md={12}>
              <Form.Group className="mb-3">
                <Form.Label>Nome do Setor *</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Ex: Frontstage, Área Gold, Lounge"
                  style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={isMobile ? 12 : 6}>
              <Form.Group className="mb-3">
                <Form.Label>Valor Padrão</Form.Label>
                <Form.Control
                  type="text"
                  name="default_price"
                  value={formData.default_price}
                  onChange={handleChange}
                  placeholder="R$ 0,00"
                  style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                />
              </Form.Group>
            </Col>
            <Col md={isMobile ? 12 : 6}>
              <Form.Group className="mb-3">
                <Form.Label>Lote Padrão</Form.Label>
                <Form.Control
                  type="text"
                  name="default_lot"
                  value={formData.default_lot}
                  onChange={handleChange}
                  placeholder="Ex: Lote 1, Especial"
                  style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Regras / Observações</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              name="rules_notes"
              value={formData.rules_notes}
              onChange={handleChange}
              placeholder="Descreva as regras ou observações do setor"
              style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
            />
          </Form.Group>

          <Form.Group className="mb-3 d-flex align-items-center" controlId="active-toggle">
            <Form.Check
              type="switch"
              name="active"
              label="Setor ativo (disponível para eventos)"
              checked={formData.active}
              onChange={handleChange}
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
            {loading ? 'Salvando...' : (sector ? 'Atualizar' : 'Criar Setor')}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

export default SectorModal
