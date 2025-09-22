import React, { useState, useEffect } from 'react'
import { Modal, Button, Form, Row, Col } from 'react-bootstrap'
import { supabase } from '../../services/supabase'
import toast from 'react-hot-toast'

const OrderModal = ({ show, onHide, onSuccess, order = null }) => {
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState([])
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [formData, setFormData] = useState({
    customer_id: '',
    event_id: '',
    setor: '',
    lote: '',
    quantity: 1,
    total_amount: '',
    payment_method: 'pix',
    payment_status: 'pending',
    delivery_status: 'pending'
  })

  // Update form data when order prop changes
  useEffect(() => {
    if (order) {
      setFormData({
        customer_id: order.customer_id || '',
        event_id: order.event_id || '',
        setor: order.setor || '',
        lote: order.lote || '',
        quantity: order.quantity || 1,
        total_amount: order.total_amount || '',
        payment_method: order.payment_method || 'pix',
        payment_status: order.payment_status || 'pending',
        delivery_status: order.delivery_status || 'pending'
      })
    } else {
      // Reset form for new order
      setFormData({
        customer_id: '',
        event_id: '',
        setor: '',
        lote: '',
        quantity: 1,
        total_amount: '',
        payment_method: 'pix',
        payment_status: 'pending',
        delivery_status: 'pending'
      })
    }
  }, [order])

  useEffect(() => {
    if (show) {
      loadCustomers()
      loadEvents()
    }
  }, [show])

  useEffect(() => {
    if (formData.event_id) {
      const event = events.find(e => e.id === formData.event_id)
      console.log('Evento selecionado:', event)
      setSelectedEvent(event)
      
      // Reset setor e lote apenas quando evento muda em um novo pedido
      // Para edição, manter os valores atuais
      if (!order && events.length > 0) {
        setFormData(prev => ({
          ...prev,
          setor: '',
          lote: ''
        }))
      }
    }
  }, [formData.event_id, events, order])

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, status')
        .order('name')

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error('Erro ao carregar clientes')
    }
  }

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('nome')

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error loading events:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    // Se mudou o setor, resetar o lote
    if (name === 'setor') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        lote: '' // Reset lote quando setor muda
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const getAvailableSectors = () => {
    if (!selectedEvent) {
      console.log('Nenhum evento selecionado')
      return []
    }
    
    console.log('Verificando setores para evento:', selectedEvent)
    const sectors = []
    
    if (selectedEvent.frontstage_on) {
      sectors.push({ value: 'frontstage', label: 'Frontstage' })
    }
    if (selectedEvent.areagold_on) {
      sectors.push({ value: 'areagold', label: 'AreaGold' })  
    }
    if (selectedEvent.lounge_on) {
      sectors.push({ value: 'lounge', label: 'Lounge' })
    }
    
    console.log('Setores disponíveis:', sectors)
    return sectors
  }

  const getMaxLote = () => {
    if (!selectedEvent || !formData.setor) return 1
    
    switch (formData.setor) {
      case 'frontstage': return selectedEvent.lote_frontsta || 1
      case 'areagold': return selectedEvent.lote_areagold || 1
      case 'lounge': return selectedEvent.lote_lounge || 1
      default: return 1
    }
  }

  const getSectorPrice = () => {
    if (!selectedEvent || !formData.setor) return ''
    
    switch (formData.setor) {
      case 'frontstage': return selectedEvent.valor_frontst || ''
      case 'areagold': return selectedEvent.valor_areago || ''
      case 'lounge': return selectedEvent.valor_lounge || ''
      default: return ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const orderData = {
        ...formData,
        quantity: parseInt(formData.quantity),
        lote: formData.lote, // Manter como string para aceitar texto
        total_amount: typeof formData.total_amount === 'string' 
          ? parseFloat(formData.total_amount.replace(/[^\d,]/g, '').replace(',', '.'))
          : parseFloat(formData.total_amount || 0),
        ticket_type: formData.setor, // Usar setor como tipo de ingresso
        // Garantir que setor seja um dos valores válidos
        setor: formData.setor && ['frontstage', 'areagold', 'lounge'].includes(formData.setor) 
          ? formData.setor 
          : null
      }

      console.log('Dados sendo enviados:', orderData)

      let result
      if (order) {
        // Update existing order
        result = await supabase
          .from('tickets')
          .update(orderData)
          .eq('id', order.id)
      } else {
        // Create new order
        result = await supabase
          .from('tickets')
          .insert([orderData])
      }

      if (result.error) throw result.error

      toast.success(order ? 'Pedido atualizado com sucesso!' : 'Pedido criado com sucesso!')
      onSuccess()
      onHide()
    } catch (error) {
      console.error('Error saving order:', error)
      toast.error('Erro ao salvar pedido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{order ? 'Editar Pedido' : 'Novo Pedido'}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Cliente *</Form.Label>
                <Form.Select
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Evento *</Form.Label>
                <Form.Select
                  name="event_id"
                  value={formData.event_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Selecione um evento</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.nome} - {new Date(event.data).toLocaleDateString('pt-BR')}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Setor *</Form.Label>
                <Form.Control
                  type="text"
                  name="setor"
                  value={formData.setor}
                  onChange={handleChange}
                  placeholder="Ex: areagold, frontstage, lounge"
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Lote *</Form.Label>
                <Form.Control
                  type="text"
                  name="lote"
                  value={formData.lote}
                  onChange={handleChange}
                  placeholder="Ex: Lote 1, Promocional, VIP"
                  required
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Quantidade *</Form.Label>
                <Form.Control
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  required
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Valor Total *</Form.Label>
                <Form.Control
                  type="text"
                  name="total_amount"
                  value={formData.total_amount}
                  onChange={handleChange}
                  placeholder="R$ 100,00"
                  required
                />
                {getSectorPrice() && (
                  <Form.Text className="text-muted">
                    Preço sugerido: {getSectorPrice()}
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Forma de Pagamento</Form.Label>
                <Form.Select
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleChange}
                >
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                  <option value="cash">Dinheiro</option>
                  <option value="bank_transfer">Transferência</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Status do Pagamento</Form.Label>
                <Form.Select
                  name="payment_status"
                  value={formData.payment_status}
                  onChange={handleChange}
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="failed">Falhou</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="expired">Expirado</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Status da Entrega</Form.Label>
                <Form.Select
                  name="delivery_status"
                  value={formData.delivery_status}
                  onChange={handleChange}
                >
                  <option value="pending">Pendente</option>
                  <option value="delivered">Entregue</option>
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
            {loading ? 'Salvando...' : (order ? 'Atualizar' : 'Criar Pedido')}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

export default OrderModal
