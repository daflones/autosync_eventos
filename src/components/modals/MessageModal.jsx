import React, { useState, useEffect } from 'react'
import { Modal, Form, Button, Alert, Row, Col } from 'react-bootstrap'
import { Upload, X, Send } from 'lucide-react'
import { createMessageRecord, sendMessageWithImage } from '../../services/messageService'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const MessageModal = ({ show, onHide, customer, ticket, onSuccess }) => {
  // Generate default message with customer name
  const getDefaultMessage = () => {
    // First check if ticket has a custom message
    if (ticket?.mensagem_cliente) {
      return ticket.mensagem_cliente
    }
    // Fallback to default message with customer name
    if (customer?.name) {
      return `🎉 Aeee! ${customer.name}! Aqui está seu ingresso com QR Code para o evento! Lembra de levar um documento com foto (RG, CNH ou passaporte) com o mesmo CPF que você cadastrou, beleza? Agora é só curtir! Vai ser show demais! 🎵✨`
    }
    return ''
  }

  const [message, setMessage] = useState('')

  // Update message when customer or ticket changes
  useEffect(() => {
    setMessage(getDefaultMessage())
  }, [customer, ticket])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [showFullImage, setShowFullImage] = useState(false)

  const handleFileSelect = (files) => {
    try {
      if (!files || files.length === 0) return
      
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg']
      const maxSize = 5 * 1024 * 1024 // 5MB
      const maxFiles = 5 // Maximum 5 images
      
      // Convert FileList to Array
      const fileArray = Array.from(files)
      
      // Check if adding these files would exceed the limit
      if (selectedFiles.length + fileArray.length > maxFiles) {
        throw new Error(`Máximo ${maxFiles} imagens permitidas`)
      }
      
      const newFiles = []
      const newPreviews = []
      
      for (const file of fileArray) {
        // Validate each file
        if (!validTypes.includes(file.type)) {
          throw new Error(`Formato não suportado: ${file.name}. Use PNG, JPG ou JPEG`)
        }
        
        if (file.size > maxSize) {
          throw new Error(`Arquivo muito grande: ${file.name}. Máximo 5MB`)
        }
        
        // Check for duplicates
        const isDuplicate = selectedFiles.some(existingFile => 
          existingFile.name === file.name && existingFile.size === file.size
        )
        
        if (!isDuplicate) {
          newFiles.push(file)
          newPreviews.push(URL.createObjectURL(file))
        }
      }
      
      setSelectedFiles(prev => [...prev, ...newFiles])
      setPreviews(prev => [...prev, ...newPreviews])
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleInputChange = (e) => {
    const files = e.target.files
    handleFileSelect(files)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    handleFileSelect(files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const removeFile = (index) => {
    // Revoke the URL for the preview being removed
    if (previews[index]) {
      URL.revokeObjectURL(previews[index])
    }
    
    // Remove the file and preview at the specified index
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
    setError('')
  }

  const removeAllFiles = () => {
    // Revoke all preview URLs
    previews.forEach(preview => URL.revokeObjectURL(preview))
    
    setSelectedFiles([])
    setPreviews([])
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
      // Update ticket with new message if it was changed
      if (message !== getDefaultMessage()) {
        const { supabase } = await import('../../services/supabase')
        await supabase
          .from('tickets')
          .update({ mensagem_cliente: message })
          .eq('id', ticket.id)
      }

      // Criar registro de mensagem
      const messageRecord = await createMessageRecord(customer, ticket, message)
      
      // Enviar mensagem (com ou sem imagens)
      await sendMessageWithImage({
        message_id: messageRecord.id,
        customer_id: customer.id,
        phone: customer.phone,
        name: customer.name,
        message: message,
        ticket_id: ticket.id
      }, selectedFiles)
      
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
    removeAllFiles()
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
          <Form.Label>Anexar Imagens (Opcional)</Form.Label>
          
          <div
            className={`upload-area ${dragOver ? 'dragover' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById('file-input').click()}
            style={{
              border: '2px dashed #d1d5db',
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: dragOver ? '#f3f4f6' : '#fafafa',
              transition: 'all 0.2s ease'
            }}
          >
            <Upload size={32} className="text-muted mb-2" />
            <p className="mb-1">Clique ou arraste imagens aqui</p>
            <small className="text-muted">
              PNG, JPG ou JPEG até 5MB cada • Máximo 5 imagens • 
              {selectedFiles.length > 0 && ` ${selectedFiles.length}/5 selecionadas`}
            </small>
            <input
              id="file-input"
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleInputChange}
              style={{ display: 'none' }}
              disabled={uploading}
              multiple
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <small className="text-muted">
                  {selectedFiles.length} imagem{selectedFiles.length > 1 ? 'ns' : ''} selecionada{selectedFiles.length > 1 ? 's' : ''}
                </small>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={removeAllFiles}
                  disabled={uploading}
                >
                  Remover Todas
                </Button>
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
                gap: '1rem',
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '0.5rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#fafafa'
              }}>
                {selectedFiles.map((file, index) => (
                  <div key={index} className="position-relative">
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      backgroundColor: 'white'
                    }}>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#374151',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {file.name}
                          </div>
                          <div style={{
                            fontSize: '0.65rem',
                            color: '#6b7280'
                          }}>
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={uploading}
                          style={{
                            padding: '0.25rem',
                            fontSize: '0.75rem',
                            lineHeight: 1
                          }}
                        >
                          <X size={12} />
                        </Button>
                      </div>
                      
                      {previews[index] && (
                        <div>
                          <img
                            src={previews[index]}
                            alt={`Preview ${index + 1}`}
                            style={{
                              width: '100%',
                              height: '80px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: '1px solid #e5e7eb'
                            }}
                            onClick={() => {
                              setShowFullImage(previews[index])
                            }}
                            title="Clique para expandir"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
          show={!!showFullImage} 
          onHide={() => setShowFullImage(false)} 
          size="lg"
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>Visualizar Imagem</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ textAlign: 'center', padding: '2rem' }}>
            <img
              src={showFullImage}
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
