import React from 'react'
import { Spinner } from 'react-bootstrap'

const LoadingSpinner = ({ size = 'sm', text = 'Carregando...' }) => {
  return (
    <div className="d-flex align-items-center">
      <Spinner animation="border" size={size} className="me-2" />
      {text && <span>{text}</span>}
    </div>
  )
}

export default LoadingSpinner
