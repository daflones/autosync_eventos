import React from 'react'
import { Navbar, Nav, Dropdown } from 'react-bootstrap'
import { User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const Header = () => {
  const { user, signOut } = useAuth()

  return (
    <Navbar bg="white" className="border-bottom px-3">
      <Navbar.Brand className="d-md-none">
        Painel Eventos
      </Navbar.Brand>
      
      <Nav className="ms-auto">
        <Dropdown align="end">
          <Dropdown.Toggle variant="outline-secondary" id="user-dropdown">
            <User size={20} className="me-2" />
            {user?.user_metadata?.full_name || user?.email}
          </Dropdown.Toggle>

          <Dropdown.Menu>
            <Dropdown.Item onClick={signOut}>
              Sair
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </Nav>
    </Navbar>
  )
}

export default Header
