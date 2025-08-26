import React, { useState, useEffect } from 'react'
import { Modal, Form, Button, Alert, Row, Col } from 'react-bootstrap'
import { Upload, X, Send } from 'lucide-react'
import { createMessageRecord, sendMessageWithImage } from '../../services/messageService'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const MessageModal = ({ show, onHide, customer, ticket, onSuccess }) => {
  // Generate default message with customer name
  const getDefaultMessage = () => {
    if (customer?.name) {
      return `🎉 Aeee! ${customer.name}! Aqui está seu ingresso com QR Code para o evento! Lembra de levar um documento com foto (RG, CNH ou passaporte) com o mesmo CPF que você cadastrou, beleza? Agora é só curtir! Vai ser show demais! 🎵✨`
    }
    return ''
  }

  const [message, setMessage] = useState('')

  // Update message when customer changes
  useEffect(() => {
    setMessage(getDefaultMessage())
  }, [customer])
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [showFullImage, setShowFullImage] = useState(false)

  const handleFileSelect = (file) => {
    try {
      if (!file) return
      
      // Validate file
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg']
      const maxSize = 5 * 1024 * 1024 // 5MB
      
      if (!validTypes.includes(file.type)) {
        throw new Error('Formato não suportado. Use PNG, JPG ou JPEG')
      }
      
      if (file.size > maxSize) {
        throw new Error('Arquivo muito grande. Máximo 5MB')
      }

      setSelectedFile(file)
      setPreview(URL.createObjectURL(file))
      setError('')
    } catch (err) {
      setError(err.message)
      setSelectedFile(null)
      setPreview(null)
    }
  }

  const handleInputChange = (e) => {
    const file = e.target.files[0]
    handleFileSelect(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFileSelect(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const removeFile = () => {
    setSelectedFile(null)
    if (preview) {
      URL.revokeObjectURL(preview)
      setPreview(null)
    }
    setError('')
  }

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Mensagem é obrigatória')
      return
    }

    setUploading(true)
    setError('')

    try {
      // Criar registro de mensagem
      const messageRecord = await createMessageRecord(customer, ticket, message)
      
      // Enviar mensagem (com ou sem imagem)
      await sendMessageWithImage({
        message_id: messageRecord.id,
        customer_id: customer.id,
        phone: customer.phone,
        name: customer.name,
        message: message,
        ticket_id: ticket.id
      }, selectedFile)
      
      toast.success('Mensagem enviada com sucesso!')
      if (onSuccess) onSuccess()
      handleClose()
      
    } catch (err) {
      console.error('Error sending message:', err)
      setError('Erro ao enviar mensagem: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setMessage(getDefaultMessage()) // Reset to default message instead of empty
    removeFile()
    setError('')
    setUploading(false)
    onHide()
  }

  const handleCancel = () => {
    handleClose()
    // Garantir que o estado de envio seja limpo no componente pai
    if (onSuccess) {
      onSuccess() // Chama onSuccess para limpar o estado de sendingMessages
    }
  }

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Enviar Mensagem</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        <Row className="mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Cliente</Form.Label>
              <Form.Control
                type="text"
                value={customer?.name || ''}
                readOnly
                className="bg-light"
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Telefone</Form.Label>
              <Form.Control
                type="text"
                value={customer?.phone || ''}
                readOnly
                className="bg-light"
              />
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mb-3">
          <Form.Label>Mensagem</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={uploading}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Anexar Imagem (Opcional)</Form.Label>
          
          {!selectedFile ? (
            <div
              className={`upload-area ${dragOver ? 'dragover' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('file-input').click()}
            >
              <Upload size={32} className="text-muted mb-2" />
              <p className="mb-1">Clique ou arraste uma imagem aqui</p>
              <small className="text-muted">PNG, JPG ou JPEG até 5MB</small>
              <input
                id="file-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleInputChange}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </div>
          ) : (
            <div className="border rounded p-3">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <strong>{selectedFile.name}</strong>
                  <br />
                  <small className="text-muted">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </small>
                </div>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={removeFile}
                  disabled={uploading}
                >
                  <X size={16} />
                </Button>
              </div>
              {preview && (
                <div style={{ marginTop: '0.5rem' }}>
                  <img
                    src={preview}
                    alt="Preview"
                    style={{
                      width: '80px',
                      height: '80px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: '2px solid #e5e7eb'
                    }}
                    onClick={() => setShowFullImage(true)}
                    title="Clique para expandir"
                  />
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Clique na imagem para expandir
                  </div>
                </div>
              )}
            </div>
          )}
        </Form.Group>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={handleCancel} disabled={uploading}>
          Cancelar
        </Button>
        <button 
          type="button"
          onClick={handleSend}
          disabled={uploading}
          className="btn"
          style={{
            backgroundColor: '#8b5cf6',
            borderColor: '#8b5cf6',
            color: 'white',
            border: '1px solid #8b5cf6',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            fontWeight: '500',
            cursor: uploading ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!uploading) {
              e.target.style.backgroundColor = '#7c3aed'
              e.target.style.borderColor = '#7c3aed'
            }
          }}
          onMouseLeave={(e) => {
            if (!uploading) {
              e.target.style.backgroundColor = '#8b5cf6'
              e.target.style.borderColor = '#8b5cf6'
            }
          }}
        >
          {uploading ? 'Enviando...' : 'Enviar Mensagem'}
        </button>
      </Modal.Footer>

      {/* Full Image Modal */}
      {showFullImage && (
        <Modal 
          show={showFullImage} 
          onHide={() => setShowFullImage(false)} 
          size="lg"
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>Visualizar Imagem</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ textAlign: 'center', padding: '2rem' }}>
            <img
              src={preview}
              alt="Imagem completa"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowFullImage(false)}>
              Fechar
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </Modal>
  )
}

export default MessageModal
