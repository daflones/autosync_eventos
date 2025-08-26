# Sistema de Gestão de Ingressos para Eventos

Sistema de gerenciamento de eventos e ingressos desenvolvido com React e Supabase.

## 🚀 Funcionalidades

- **Dashboard** com métricas em tempo real
- **Gerenciamento de eventos** completo (CRUD)
- **Gerenciamento de clientes** com dados detalhados
- **Sistema de ingressos/pedidos** por setores e lotes
- **Envio de mensagens** via WhatsApp com N8N
- **Upload de imagens** para ingressos
- **Relatórios e filtros** avançados

## 🛠️ Tecnologias

- **Frontend:** React 18 + Vite
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **UI:** Bootstrap 5 + React Bootstrap
- **Roteamento:** React Router v6
- **Notificações:** React Hot Toast
- **Ícones:** Lucide React
- **Mensagens:** N8N Webhook Integration

## 📦 Instalação e Deploy

### Desenvolvimento Local
```bash
# Clone o repositório
git clone https://github.com/daflones/autosync_eventos.git
cd autosync_eventos

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env

# Execute o projeto
npm run dev
```

### Deploy com Nixpacks (EasyPanel)
```bash
# Comandos para Nixpacks
Install: npm install
Build: npm run build
Start: npm run start
```

## ⚙️ Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure:

```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_N8N_WEBHOOK_URL=your_n8n_webhook_url_here
```

## 🗄️ Estrutura do Banco de Dados

- **events**: Eventos com setores (frontstage, areagold, lounge)
- **customers**: Clientes com dados completos
- **tickets**: Ingressos vinculados a eventos e clientes
- **messages**: Histórico de mensagens enviadas

## 🚀 Scripts Disponíveis

- `npm run dev`: Executa em modo desenvolvimento
- `npm run build`: Gera build de produção
- `npm run start`: Executa build em produção
- `npm run preview`: Preview do build local
- `npm run lint`: Verifica código com ESLint

## 📱 Funcionalidades Principais

### Dashboard
- Resumo de ingressos por status
- Métricas de vendas
- Gráficos de performance

### Eventos
- Criação com múltiplos setores
- Configuração de lotes e preços
- Status e datas

### Clientes
- Cadastro completo com CPF e data de nascimento
- Histórico de compras
- Total gasto (apenas ingressos pagos)

### Ingressos
- Criação por setor e lote
- Status de pagamento e entrega
- Envio de mensagens personalizadas

### Mensagens
- Templates automáticos com nome do cliente
- Upload de imagens (QR codes)
- Integração com WhatsApp via N8N

## 📋 Pré-requisitos

- Node.js 16+
- Conta no Supabase
- N8N configurado (opcional para teste)

## ⚙️ Configuração

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env` e configure:

```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_N8N_WEBHOOK_URL=your_n8n_webhook_url_here
```

### 3. Configurar Supabase

#### Criar tabelas no banco de dados:

```sql
-- Tabela events
CREATE TABLE events (
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  full_name VARCHAR,
  role VARCHAR DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela customers
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL,
  phone VARCHAR NOT NULL,
  cpf VARCHAR UNIQUE,
  age INTEGER,
  email VARCHAR,
  status VARCHAR DEFAULT 'lead' CHECK (status IN ('lead', 'customer', 'inactive')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela tickets
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  ticket_type VARCHAR NOT NULL,
  quantity INTEGER NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  delivery_status VARCHAR DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
  payment_method VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela messages
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  ticket_id UUID REFERENCES tickets(id),
  message_content TEXT NOT NULL,
  image_url VARCHAR,
  image_filename VARCHAR,
  image_size INTEGER,
  sent_status VARCHAR DEFAULT 'pending' CHECK (sent_status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Configurar Storage para imagens:

1. Crie um bucket chamado `message-images`
2. Configure as políticas de acesso:

```sql
-- Política para upload de imagens
CREATE POLICY "Allow authenticated users to upload images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'message-images' AND 
  auth.role() = 'authenticated'
);

-- Política para leitura pública de imagens
CREATE POLICY "Allow public read access to images" ON storage.objects
FOR SELECT USING (bucket_id = 'message-images');
```

### 4. Executar o projeto
```bash
npm run dev
```

## 🎯 Funcionalidades

### Dashboard
- Métricas de vendas em tempo real
- Gráficos de performance
- Lista de ações pendentes
- Cards com totais de ingressos, pagamentos e entregas

### Gestão de Pedidos
- Visualização completa de todos os pedidos
- Filtros por status de pagamento e entrega
- Busca por cliente, telefone ou email
- Envio de mensagens com anexos

### Gestão de Clientes
- Cadastro completo de clientes
- Histórico de pedidos por cliente
- Filtros por status (Lead, Cliente, Inativo)
- Detalhes completos em modal

### Sistema de Mensageria
- Envio de mensagens de texto
- Upload de imagens (PNG, JPG, JPEG até 5MB)
- Integração com N8N webhook
- Histórico completo de mensagens
- Validação de arquivos
- Preview de imagens

## 📱 Integração N8N

O sistema envia dados para o webhook N8N no seguinte formato:

```json
{
  "customer_id": "uuid",
  "phone": "5511999999999",
  "name": "Nome Cliente",
  "message": "Texto da mensagem",
  "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "image_filename": "imagem.jpg",
  "ticket_id": "uuid"
}
```

## 🎨 Interface

- Design responsivo com Bootstrap 5
- Sidebar de navegação
- Status badges coloridos
- Upload de imagens com drag & drop
- Modais para ações específicas
- Feedback visual para todas as operações

## 🔐 Autenticação

- Login/Cadastro com Supabase Auth
- Proteção de rotas
- Controle de sessão
- Logout seguro

## 📊 Status e Badges

### Pagamento
- 🟢 **Pago**: Verde
- 🟡 **Pendente**: Amarelo  
- 🔴 **Falhou**: Vermelho
- ⚪ **Reembolsado**: Cinza

### Entrega
- 🟢 **Enviado/Entregue**: Verde
- 🟡 **Pendente**: Amarelo
- 🔴 **Falhou**: Vermelho

### Cliente
- 🔵 **Lead**: Azul
- 🟢 **Cliente**: Verde
- ⚪ **Inativo**: Cinza

## 🚀 Deploy

1. Build do projeto:
```bash
npm run build
```

2. Configure as variáveis de ambiente no seu provedor de hospedagem

3. Faça o deploy da pasta `dist`

## 📝 Próximos Passos

- [ ] Dashboard analytics avançado
- [ ] Relatórios em PDF
- [ ] Integração com gateway de pagamento
- [ ] Notificações push
- [ ] API para terceiros
- [ ] App mobile

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.
