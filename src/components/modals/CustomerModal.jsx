import React, { useState, useEffect } from 'react'
import { Modal, Button, Form, Row, Col } from 'react-bootstrap'
import { supabase } from '../../services/supabase'
import toast from 'react-hot-toast'

const CustomerModal = ({ show, onHide, onSuccess, customer = null }) => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cpf: '',
    age: '',
    status: 'customer'
  })

  // Update form data when customer prop changes
  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        cpf: customer.cpf || '',
        age: customer.age || '',
        status: customer.status || 'customer'
      })
    } else {
      // Reset form for new customer
      setFormData({
        name: '',
        phone: '',
        cpf: '',
        age: '',
        status: 'customer'
      })
    }
  }, [customer])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
    return value
  }

  const formatCPF = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return value
  }

  const handlePhoneChange = (e) => {
    const formatted = formatPhone(e.target.value)
    setFormData(prev => ({ ...prev, phone: formatted }))
  }

  const handleCPFChange = (e) => {
    const formatted = formatCPF(e.target.value)
    setFormData(prev => ({ ...prev, cpf: formatted }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const customerData = {
        ...formData,
        age: formData.age || null
      }

      let result
      if (customer) {
        // Update existing customer
        result = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customer.id)
      } else {
        // Create new customer
        result = await supabase
          .from('customers')
          .insert([customerData])
      }

      if (result.error) throw result.error

      toast.success(customer ? 'Cliente atualizado com sucesso!' : 'Cliente criado com sucesso!')
      onSuccess()
      onHide()
    } catch (error) {
      console.error('Error saving customer:', error)
      toast.error('Erro ao salvar cliente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{customer ? 'Editar Cliente' : 'Novo Cliente'}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Row>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label>Nome Completo *</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Data de Nascimento</Form.Label>
                <Form.Control
                  type="date"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Telefone *</Form.Label>
                <Form.Control
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  placeholder="(11) 99999-9999"
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>CPF</Form.Label>
                <Form.Control
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleCPFChange}
                  placeholder="000.000.000-00"
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={12}>
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="customer">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="lead">Lead</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
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
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer'
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
            {loading ? 'Salvando...' : (customer ? 'Atualizar' : 'Criar Cliente')}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

export default CustomerModal
