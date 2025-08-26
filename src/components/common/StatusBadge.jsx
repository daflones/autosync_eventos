import React from 'react'
import { Badge } from 'react-bootstrap'

const StatusBadge = ({ status, type }) => {
  const getVariant = () => {
    const variants = {
      payment: {
        paid: 'success',
        pending: 'warning',
        failed: 'danger',
        refunded: 'secondary'
      },
      delivery: {
        sent: 'success',
        delivered: 'success',
        pending: 'warning',
        failed: 'danger'
      },
      customer: {
        lead: 'info',
        customer: 'success',
        inactive: 'secondary'
      },
      message: {
        sent: 'success',
        pending: 'warning',
        failed: 'danger'
      }
    }
    return variants[type]?.[status] || 'secondary'
  }

  const getText = () => {
    const texts = {
      payment: {
        paid: 'Pago',
        pending: 'Pendente',
        failed: 'Falhou',
        refunded: 'Reembolsado'
      },
      delivery: {
        sent: 'Enviado',
        delivered: 'Entregue',
        pending: 'Pendente',
        failed: 'Falhou'
      },
      customer: {
        lead: 'Lead',
        customer: 'Cliente',
        inactive: 'Inativo'
      },
      message: {
        sent: 'Enviado',
        pending: 'Pendente',
        failed: 'Falhou'
      }
    }
    return texts[type]?.[status] || status
  }

  return (
    <Badge bg={getVariant()} className="status-badge">
      {getText()}
    </Badge>
  )
}

export default StatusBadge
