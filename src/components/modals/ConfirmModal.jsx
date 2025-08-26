import React from 'react'
import { Modal, Button } from 'react-bootstrap'

const ConfirmModal = ({ show, onHide, onConfirm, title, message, confirmText = "Confirmar", cancelText = "Cancelar" }) => {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{message}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          {cancelText}
        </Button>
        <button
          onClick={onConfirm}
          style={{
            backgroundColor: '#ef4444',
            borderColor: '#ef4444',
            color: 'white',
            border: '1px solid #ef4444',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#dc2626'
            e.target.style.borderColor = '#dc2626'
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#ef4444'
            e.target.style.borderColor = '#ef4444'
          }}
        >
          {confirmText}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default ConfirmModal
