import axios from 'axios'
import { supabase } from './supabase'
import toast from 'react-hot-toast'

const WEBHOOK_URL = 'https://n8n.nanosync.com.br/webhook/disparador_eventos'

// Função para validar e corrigir remotejid
const validateAndFixRemotejid = (remotejid) => {
  if (!remotejid || remotejid === 'null' || remotejid === '') {
    return remotejid
  }

  // Se já contém @, é um remotejid válido
  if (remotejid.includes('@')) {
    // Apenas números @s.whatsapp.net devem ter o código 55
    if (remotejid.includes('@s.whatsapp.net')) {
      const numberPart = remotejid.split('@')[0]
      
      // Se não começa com 55, adicionar (apenas para WhatsApp normal)
      if (!numberPart.startsWith('55')) {
        return `55${numberPart}@s.whatsapp.net`
      }
    }
    // @lid não deve ter 55 adicionado, retornar como está
    return remotejid
  }

  // Se é apenas número, formatar como remotejid
  const cleanNumber = remotejid.replace(/[^0-9]/g, '')
  
  if (cleanNumber.length === 11) {
    // Número brasileiro sem código do país
    return `55${cleanNumber}@s.whatsapp.net`
  } else if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
    // Número brasileiro com código do país
    return `${cleanNumber}@s.whatsapp.net`
  } else if (cleanNumber.length === 15) {
    // Número internacional - não adicionar 55
    return `${cleanNumber}@lid`
  }

  // Retornar como está se não conseguir processar
  return remotejid
}

export const disparadorService = {
  // Criar nova campanha
  async createCampaign(campaignData) {
    try {
      const { data, error } = await supabase
        .from('disparador_campaigns')
        .insert([campaignData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating campaign:', error)
      throw error
    }
  },

  // Criar nova campanha com clientes já atrelados
  async createCampaignWithCustomers(campaignData, selectedCustomers) {
    try {
      // 1. Criar a campanha
      const { data: campaign, error: campaignError } = await supabase
        .from('disparador_campaigns')
        .insert([{
          ...campaignData,
          total_customers: selectedCustomers.length
        }])
        .select()
        .single()

      if (campaignError) throw campaignError

      // 2. Criar registros de clientes da campanha
      if (selectedCustomers.length > 0) {
        const campaignCustomers = selectedCustomers.map(customer => ({
          campaign_id: campaign.id,
          customer_id: customer.customer_id,
          customer_name: customer.customer_name,
          remotejid: customer.remotejid,
          message_content: campaignData.message_base.replace('{nome}', customer.customer_name),
          status: 'scheduled' // Agendado para disparo
        }))

        const { error: customersError } = await supabase
          .from('disparador_sends')
          .insert(campaignCustomers)

        if (customersError) throw customersError
      }

      console.log(`✅ Campanha criada com ${selectedCustomers.length} clientes atrelados`)
      return campaign
    } catch (error) {
      console.error('Error creating campaign with customers:', error)
      throw error
    }
  },

  // Obter clientes elegíveis para uma campanha
  async getEligibleCustomers(campaignId, limit = 30) {
    try {
      const { data, error } = await supabase
        .rpc('get_next_eligible_customers', {
          campaign_uuid: campaignId,
          limit_count: limit
        })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting eligible customers:', error)
      throw error
    }
  },

  // Verificar limite diário
  async checkDailyLimit(campaignId) {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: campaign } = await supabase
        .from('disparador_campaigns')
        .select('daily_limit')
        .eq('id', campaignId)
        .single()

      const { data: dailyLimit } = await supabase
        .from('disparador_daily_limits')
        .select('sent_count')
        .eq('campaign_id', campaignId)
        .eq('date', today)
        .single()

      const sentToday = dailyLimit?.sent_count || 0
      const limit = campaign?.daily_limit || 30

      return {
        canSend: sentToday < limit,
        sentToday,
        limit,
        remaining: limit - sentToday
      }
    } catch (error) {
      console.error('Error checking daily limit:', error)
      return { canSend: false, sentToday: 0, limit: 30, remaining: 0 }
    }
  },

  // Enviar mensagem para um cliente específico
  async sendMessageToCustomer(campaignId, customer, messageContent) {
    try {
      // 1. Verificar limite diário
      const limitCheck = await this.checkDailyLimit(campaignId)
      if (!limitCheck.canSend) {
        throw new Error(`Limite diário atingido (${limitCheck.limit} mensagens)`)
      }

      // 2. Criar registro de envio
      const { data: sendRecord, error: sendError } = await supabase
        .from('disparador_sends')
        .insert([{
          campaign_id: campaignId,
          customer_id: customer.customer_id,
          remotejid: customer.remotejid,
          customer_name: customer.customer_name,
          message_content: messageContent,
          status: 'pending'
        }])
        .select()
        .single()

      if (sendError) throw sendError

      // 3. Preparar payload para N8N
      const { data: campaign } = await supabase
        .from('disparador_campaigns')
        .select('image_base64')
        .eq('id', campaignId)
        .single()

      // Função para gerar remotejid baseado no phone se necessário
      const generateRemoteJid = (phone, existingRemoteJid) => {
        // Se já tem remotejid válido, usar ele
        if (existingRemoteJid && existingRemoteJid !== '' && existingRemoteJid !== 'null') {
          return existingRemoteJid
        }
        
        // Se não tem phone, retornar null
        if (!phone || phone === '') {
          return null
        }
        
        // Extrair apenas números do telefone
        const numericPhone = phone.replace(/[^0-9]/g, '')
        
        // Determinar formato baseado no tamanho
        if (numericPhone.length === 11) {
          return `${numericPhone}@s.whatsapp.net`
        } else if (numericPhone.length === 15) {
          return `${numericPhone}@lid`
        }
        
        // Se não é 11 nem 15 dígitos, tentar usar como está
        return existingRemoteJid || null
      }

      // Buscar dados completos do cliente incluindo phone
      const { data: customerData } = await supabase
        .from('customers')
        .select('phone, remotejid')
        .eq('id', customer.customer_id)
        .single()

      // Gerar remotejid correto
      const finalRemoteJid = generateRemoteJid(customerData?.phone, customer.remotejid)

      const payload = {
        customer_id: customer.customer_id,
        remotejid: finalRemoteJid,
        name: customer.customer_name,
        message: messageContent,
        image_base64: campaign.image_base64 || null,
        send_id: sendRecord.id
      }

      // 4. Enviar para N8N
      console.log('Enviando para webhook:', WEBHOOK_URL, payload)
      const response = await axios.post(WEBHOOK_URL, payload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      console.log('Resposta do webhook:', response.status, response.data)

      // 5. Atualizar status do envio
      await supabase
        .from('disparador_sends')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', sendRecord.id)

      // 6. Atualizar histórico do cliente
      await supabase
        .from('disparador_customer_history')
        .insert([{
          customer_id: customer.customer_id,
          campaign_id: campaignId,
          sent_at: new Date().toISOString(),
          message_content: messageContent,
          status: 'sent'
        }])

      // 7. Atualizar limite diário
      await this.updateDailyLimit(campaignId)

      // 8. Atualizar estatísticas da campanha
      await this.updateCampaignStats(campaignId)

      return { success: true, sendRecord, response: response.data }

    } catch (error) {
      console.error('Error sending message:', error)
      
      // Atualizar status como falhou se o registro foi criado
      if (sendRecord?.id) {
        await supabase
          .from('disparador_sends')
          .update({ 
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: error.message
          })
          .eq('id', sendRecord.id)
        
        // Atualizar estatísticas da campanha após falha
        await this.updateCampaignStats(sendRecord.campaign_id)
      }

      throw error
    }
  },

  // Processar campanha (enviar para múltiplos clientes)
  async processCampaign(campaignId, maxSends = null) {
    try {
      // 1. Verificar se campanha está ativa
      const { data: campaign } = await supabase
        .from('disparador_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (!campaign || campaign.status !== 'active') {
        throw new Error('Campanha não está ativa')
      }

      // 2. Verificar limite diário
      const limitCheck = await this.checkDailyLimit(campaignId)
      if (!limitCheck.canSend) {
        return {
          success: false,
          message: `Limite diário atingido (${limitCheck.limit} mensagens)`
        }
      }

      // 3. Obter clientes elegíveis
      const sendLimit = maxSends || limitCheck.remaining
      const eligibleCustomers = await this.getEligibleCustomers(campaignId, sendLimit)

      if (eligibleCustomers.length === 0) {
        return {
          success: false,
          message: 'Nenhum cliente elegível encontrado'
        }
      }

      // 4. Processar envios
      const results = {
        total: eligibleCustomers.length,
        success: 0,
        failed: 0,
        errors: []
      }

      for (const customer of eligibleCustomers) {
        try {
          // Personalizar mensagem
          const personalizedMessage = campaign.message_template.replace(
            /{nome}/g, 
            customer.customer_name
          )

          await this.sendMessageToCustomer(campaignId, customer, personalizedMessage)
          results.success++

          // Aguardar entre envios para evitar spam
          await new Promise(resolve => setTimeout(resolve, 2000))

        } catch (error) {
          results.failed++
          results.errors.push({
            customer: customer.customer_name,
            error: error.message
          })
        }
      }

      return {
        success: true,
        results
      }

    } catch (error) {
      console.error('Error processing campaign:', error)
      throw error
    }
  },

  // Atualizar limite diário
  async updateDailyLimit(campaignId) {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: campaign } = await supabase
        .from('disparador_campaigns')
        .select('daily_limit')
        .eq('id', campaignId)
        .single()

      await supabase
        .from('disparador_daily_limits')
        .upsert({
          campaign_id: campaignId,
          date: today,
          daily_limit: campaign.daily_limit,
          sent_count: supabase.raw('sent_count + 1')
        }, {
          onConflict: 'campaign_id,date'
        })

    } catch (error) {
      console.error('Error updating daily limit:', error)
    }
  },

  // Atualizar estatísticas da campanha
  async updateCampaignStats(campaignId) {
    try {
      const { data: stats } = await supabase
        .from('disparador_sends')
        .select('status')
        .eq('campaign_id', campaignId)

      const sentCount = stats?.length || 0
      const successCount = stats?.filter(s => s.status === 'sent').length || 0
      const failedCount = stats?.filter(s => s.status === 'failed').length || 0

      await supabase
        .from('disparador_campaigns')
        .update({
          sent_count: sentCount,
          success_count: successCount,
          failed_count: failedCount
        })
        .eq('id', campaignId)

    } catch (error) {
      console.error('Error updating campaign stats:', error)
    }
  },

  // Pausar campanha
  async pauseCampaign(campaignId) {
    try {
      const { error } = await supabase
        .from('disparador_campaigns')
        .update({ status: 'paused' })
        .eq('id', campaignId)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error pausing campaign:', error)
      throw error
    }
  },

  // Reativar campanha
  async resumeCampaign(campaignId) {
    try {
      const { error } = await supabase
        .from('disparador_campaigns')
        .update({ status: 'active' })
        .eq('id', campaignId)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error resuming campaign:', error)
      throw error
    }
  },

  // Obter estatísticas detalhadas
  async getCampaignDetails(campaignId) {
    try {
      const { data: campaign } = await supabase
        .from('v_campaign_stats')
        .select('*')
        .eq('id', campaignId)
        .single()

      const { data: sends } = await supabase
        .from('disparador_sends')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })

      const { data: history } = await supabase
        .from('disparador_customer_history')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false })

      return {
        campaign,
        sends: sends || [],
        history: history || []
      }
    } catch (error) {
      console.error('Error getting campaign details:', error)
      throw error
    }
  },

  // Verificar se existe campanha ativa (usando apenas campos existentes)
  async checkActiveCampaign() {
    try {
      // Primeiro verificar se a coluna status existe
      const { data, error } = await supabase
        .from('disparador_campaigns')
        .select('id, name')
        .limit(1)

      if (error) {
        console.error('Error checking campaigns:', error)
        return null
      }
      
      // Se não há campanhas, retorna null
      return data && data.length > 0 ? null : null
    } catch (error) {
      console.error('Error checking active campaign:', error)
      return null
    }
  },

  // Iniciar disparo agendado
  async startScheduledDispatch(campaignId, customersData, campaign) {
    try {
      console.log('Iniciando disparo agendado para:', customersData.length, 'clientes')

      // Verificar se já existe campanha ativa
      const activeCampaign = await this.checkActiveCampaign()
      if (activeCampaign) {
        throw new Error(`Já existe uma campanha ativa: ${activeCampaign.name}`)
      }

      // Calcular tempo estimado (clientes * 10 minutos)
      const totalMinutes = customersData.length * 10
      const endTime = new Date(Date.now() + totalMinutes * 60 * 1000)

      // Atualizar status da campanha (usar apenas campos que existem)
      await supabase
        .from('disparador_campaigns')
        .update({ 
          status: 'active'
        })
        .eq('id', campaignId)

      // Criar registros de envio agendados (primeiro imediato, resto com intervalo)
      const sendRecords = customersData.map((customer, index) => ({
        campaign_id: campaignId,
        customer_id: customer.customer_id,
        remotejid: customer.remotejid,
        customer_name: customer.customer_name,
        message_content: customer.message,
        status: 'sent' // Usar status que existe na constraint
      }))

      const { error: sendError } = await supabase
        .from('disparador_sends')
        .insert(sendRecords)

      if (sendError) throw sendError

      // Processar o primeiro envio imediatamente
      setTimeout(async () => {
        try {
          await this.processNextScheduledSend()
        } catch (error) {
          console.error('Erro ao processar primeiro envio:', error)
        }
      }, 1000) // 1 segundo de delay

      return { 
        success: true, 
        scheduled_count: customersData.length,
        estimated_end: endTime.toISOString()
      }

    } catch (error) {
      console.error('Error starting scheduled dispatch:', error)
      throw error
    }
  },

  // Pausar campanha ativa
  async pauseCampaign(campaignId) {
    try {
      // Atualizar status da campanha para 'paused'
      await supabase
        .from('disparador_campaigns')
        .update({ 
          status: 'paused',
          paused_at: new Date().toISOString()
        })
        .eq('id', campaignId)

      // Manter envios como 'scheduled' para poder retomar depois
      // Não cancelar os envios agendados

      return { success: true }
    } catch (error) {
      console.error('Error pausing campaign:', error)
      throw error
    }
  },

  // Retomar campanha pausada
  async resumeCampaign(campaignId) {
    try {
      // Verificar se já existe outra campanha ativa
      const activeCampaign = await this.checkActiveCampaign()
      if (activeCampaign && activeCampaign.id !== campaignId) {
        throw new Error(`Já existe uma campanha ativa: ${activeCampaign.name}`)
      }

      // Atualizar status da campanha para 'active'
      await supabase
        .from('disparador_campaigns')
        .update({ 
          status: 'active',
          paused_at: null
        })
        .eq('id', campaignId)

      return { success: true }
    } catch (error) {
      console.error('Error resuming campaign:', error)
      throw error
    }
  },

  // Processar próximo envio agendado (usando estrutura atual)
  async processNextScheduledSend() {
    try {
      // Buscar próximo envio pendente de campanha ativa
      const { data: nextSend, error } = await supabase
        .from('disparador_sends')
        .select(`
          *, 
          disparador_campaigns!inner(
            name, 
            message_base, 
            image_base64,
            status
          )
        `)
        .eq('status', 'pending')
        .eq('disparador_campaigns.status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (error || !nextSend) {
        console.log('Nenhum envio pendente encontrado')
        return null
      }

      console.log('Processando envio pendente:', nextSend.customer_name)

      // Enviar webhook individual com remotejid validado
      const validRemotejid = validateAndFixRemotejid(nextSend.remotejid)
      console.log(`📱 RemoteJID: ${nextSend.remotejid} → ${validRemotejid}`)
      
      const hasImage = !!(nextSend.disparador_campaigns.image_base64)
      
      const payload = {
        customer_id: nextSend.customer_id,
        remotejid: validRemotejid,
        name: nextSend.customer_name,
        message: nextSend.message_content,
        image_base64: nextSend.disparador_campaigns.image_base64 || null,
        has_image: hasImage,
        send_id: nextSend.id
      }

      console.log('🚀 Enviando webhook individual:', payload.name)
      console.log('🖼️ Has image:', hasImage)
      const response = await axios.post(WEBHOOK_URL, payload, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      })

      console.log('Webhook enviado com sucesso:', response.status)

      // Atualizar status do envio
      await supabase
        .from('disparador_sends')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', nextSend.id)

      // Atualizar histórico do cliente
      await supabase
        .from('disparador_customer_history')
        .insert({
          customer_id: nextSend.customer_id,
          campaign_id: nextSend.campaign_id,
          sent_at: new Date().toISOString(),
          message_content: nextSend.message_content,
          status: 'sent',
          next_eligible_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })

      // Atualizar contador da campanha manualmente
      await supabase
        .from('disparador_campaigns')
        .update({ 
          sent_count: supabase.raw('sent_count + 1')
        })
        .eq('id', nextSend.campaign_id)

      // Verificar se campanha foi finalizada
      await this.checkCampaignCompletion(nextSend.campaign_id)

      return { success: true, sent: payload }

    } catch (error) {
      console.error('Error processing scheduled send:', error)
      
      // Marcar envio como falhou se possível
      if (error.nextSend?.id) {
        await supabase
          .from('disparador_sends')
          .update({ 
            status: 'failed',
            sent_at: new Date().toISOString()
          })
          .eq('id', error.nextSend.id)
        
        // Atualizar estatísticas da campanha após falha
        const campaignId = error.nextSend.campaign_id
        if (campaignId) {
          await this.updateCampaignStats(campaignId)
        }
      }
      
      throw error
    }
  },

  // Verificar se campanha foi completada
  async checkCampaignCompletion(campaignId) {
    try {
      const { data: pendingSends } = await supabase
        .from('disparador_sends')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')

      if (!pendingSends || pendingSends.length === 0) {
        // Campanha finalizada
        await supabase
          .from('disparador_campaigns')
          .update({ 
            status: 'completed'
          })
          .eq('id', campaignId)
      }
    } catch (error) {
      console.error('Error checking campaign completion:', error)
    }
  },

  // Enviar todos os dados de uma vez para o webhook (método antigo)
  async sendIndividualWebhooks(campaignId, customersData, campaign) {
    try {
      console.log('Iniciando disparo para:', customersData.length, 'clientes')

      // Marcar campanha como ativa
      await supabase
        .from('disparador_campaigns')
        .update({ status: 'active' })
        .eq('id', campaignId)

      // Preparar payload com todos os clientes
      const payload = {
        campaign_id: campaignId,
        campaign_name: campaign.name,
        message_base: campaign.message_base,
        image_base64: campaign.image_base64 || false,
        customers: customersData.map(customer => {
          const validRemotejid = validateAndFixRemotejid(customer.remotejid)
          console.log(`Cliente ${customer.customer_name}: ${customer.remotejid} → ${validRemotejid}`)
          
          return {
            customer_id: customer.customer_id,
            remotejid: validRemotejid,
            name: customer.customer_name,
            message: customer.message
          }
        })
      }

      console.log('Enviando payload completo com', payload.customers.length, 'clientes')

      // Enviar webhook com todos os dados
      const response = await axios.post(WEBHOOK_URL, payload, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      })

      console.log('✅ Webhook enviado com sucesso:', response.status)

      // Atualizar histórico dos clientes
      const historyRecords = customersData.map(customer => ({
        customer_id: customer.customer_id,
        campaign_id: campaignId,
        sent_at: new Date().toISOString(),
        message_content: customer.message,
        status: 'sent',
        next_eligible_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }))

      await supabase
        .from('disparador_customer_history')
        .insert(historyRecords)

      // Marcar campanha como dispatched
      await supabase
        .from('disparador_campaigns')
        .update({ status: 'dispatched' })
        .eq('id', campaignId)

      console.log('🎉 Disparo finalizado para todos os clientes!')

      return { success: true, sent_count: customersData.length }

    } catch (error) {
      console.error('Error sending webhook:', error)
      throw error
    }
  },

  // Iniciar disparo pausado com registros já existentes
  async startTimedDispatchWithExistingRecords(campaignId, campaign) {
    try {
      console.log('🕐 Iniciando disparo pausado para campanha:', campaignId)

      // Atualizar status da campanha para 'dispatching'
      try {
        await supabase
          .from('disparador_campaigns')
          .update({ status: 'dispatching' })
          .eq('id', campaignId)
        console.log('✅ Status da campanha atualizado para: dispatching')
      } catch (statusError) {
        console.log('Status da campanha não foi atualizado (coluna pode não existir):', statusError.message)
      }

      // Iniciar o timer para processar envios
      await this.startDispatchTimer(campaignId)

      // Contar registros pendentes
      const { data: pendingRecords } = await supabase
        .from('disparador_sends')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')

      const pendingCount = pendingRecords?.length || 0
      const estimatedEnd = new Date(Date.now() + (pendingCount * 10 * 60 * 1000))
      
      return { 
        success: true, 
        scheduled_count: pendingCount,
        estimated_end: estimatedEnd.toISOString(),
        interval_minutes: 10
      }

    } catch (error) {
      console.error('Error starting timed dispatch with existing records:', error)
      throw error
    }
  },

  // Novo método: Disparo pausado com intervalo de 10 minutos
  async startTimedDispatch(campaignId, customersData, campaign) {
    try {
      console.log('🕐 Iniciando disparo pausado para:', customersData.length, 'clientes (intervalo: 10 min)')

      // Atualizar status da campanha para 'dispatching'
      try {
        await supabase
          .from('disparador_campaigns')
          .update({ status: 'dispatching' })
          .eq('id', campaignId)
        console.log('✅ Status da campanha atualizado para: dispatching')
      } catch (statusError) {
        console.log('Status da campanha não foi atualizado (coluna pode não existir):', statusError.message)
      }

      // Criar registros de envio com status 'pending' e remotejid validado
      const sendRecords = customersData.map((customer, index) => {
        const validRemotejid = validateAndFixRemotejid(customer.remotejid)
        console.log(`Cliente ${customer.customer_name}: ${customer.remotejid} → ${validRemotejid}`)
        
        return {
          campaign_id: campaignId,
          customer_id: customer.customer_id,
          remotejid: validRemotejid,
          customer_name: customer.customer_name,
          message_content: customer.message,
          status: 'pending'
        }
      })

      console.log('Inserindo registros de envio:', sendRecords.length)
      const { data: insertData, error: insertError } = await supabase
        .from('disparador_sends')
        .insert(sendRecords)
        
      if (insertError) {
        console.error('Erro ao inserir registros de envio:', insertError)
        throw insertError
      }
      
      console.log('Registros inseridos com sucesso:', insertData?.length || sendRecords.length)

      // Iniciar o timer para processar envios
      await this.startDispatchTimer(campaignId)

      const estimatedEnd = new Date(Date.now() + (customersData.length * 10 * 60 * 1000))
      
      return { 
        success: true, 
        scheduled_count: customersData.length,
        estimated_end: estimatedEnd.toISOString(),
        interval_minutes: 10
      }

    } catch (error) {
      console.error('Error starting timed dispatch:', error)
      throw error
    }
  },

  // Timer para disparo pausado
  dispatchTimer: null,
  
  // Chave para localStorage
  STORAGE_KEY: 'disparador_active_campaigns',
  
  async startDispatchTimer(campaignId) {
    console.log('🔄 === MODO EDGE FUNCTION ATIVO ===')
    console.log('📋 Campanha ID:', campaignId)
    console.log('🌐 Edge Function processará os envios automaticamente')
    console.log('⏰ Intervalo: 10 minutos (configurado no cron)')
    
    // Não criar timer no frontend - Edge Function fará o trabalho
    // Apenas salvar referência para controle de status
    this.activeCampaignId = campaignId
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify([campaignId]))
    
    console.log('✅ Configuração concluída - Edge Function assumirá o controle')
    console.log('📊 Campanha ativa registrada:', this.activeCampaignId)
  },

  stopDispatchTimer() {
    if (this.dispatchTimer) {
      clearInterval(this.dispatchTimer)
      this.dispatchTimer = null
      console.log('⏹️ Timer de disparo parado')
    }
    
    // Limpar campanha ativa do localStorage
    localStorage.removeItem(this.STORAGE_KEY)
    this.activeCampaignId = null
    console.log('🧹 Campanha ativa removida do localStorage')
  },

  // Edge Function processará os envios - função removida do frontend
  async processNextTimedSend(campaignId) {
    console.log('🔄 === TESTE MANUAL DE ENVIO ===')
    console.log('📋 Campanha ID:', campaignId)
    console.log('🌐 Chamando Edge Function para processar...')
    
    try {
      // Chamar a Edge Function diretamente para teste
      const response = await fetch('https://yczwxthqfladdufmcprm.supabase.co/functions/v1/process-campaign-sends', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljend4dGhxZmxhZGR1Zm1jcHJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjE1MTY3MywiZXhwIjoyMDcxNzI3NjczfQ.PCKLhFl1LwkYC0BV8k5YLJcbk0nQvlZBzX80zmw4bsY',
          'Content-Type': 'application/json'
        }
      })
      
      const result = await response.json()
      console.log('✅ Edge Function executada:', result)
      return result
      
    } catch (error) {
      console.error('❌ Erro ao chamar Edge Function:', error)
      throw error
    }
  },

  // Verificar se campanha pausada foi completada
  async checkTimedCampaignCompletion(campaignId) {
    try {
      // Verificar se há envios pendentes
      const { data: pendingSends } = await supabase
        .from('disparador_sends')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')

      // Verificar se há envios com falha para retry
      const { data: failedSends } = await supabase
        .from('disparador_sends')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('status', 'failed')

      const hasPending = pendingSends && pendingSends.length > 0
      const hasFailed = failedSends && failedSends.length > 0

      // Verificar se atingiu 100% de sucesso
      const { data: allSends } = await supabase
        .from('disparador_sends')
        .select('status')
        .eq('campaign_id', campaignId)

      const totalSends = allSends?.length || 0
      const sentSends = allSends?.filter(s => s.status === 'sent').length || 0
      const successRate = totalSends > 0 ? Math.round((sentSends / totalSends) * 100) : 0

      console.log(`📊 Taxa de sucesso atual: ${successRate}% (${sentSends}/${totalSends})`)

      // Finalizar se não há pendentes/falhas OU se atingiu 100% de sucesso
      const shouldFinish = (!hasPending && !hasFailed) || (successRate === 100 && totalSends > 0)

      if (shouldFinish) {
        if (successRate === 100) {
          console.log('🎯 Campanha finalizada - 100% de sucesso atingido:', campaignId)
        } else {
          console.log('🏁 Campanha finalizada (sem pendentes nem falhas):', campaignId)
        }
        
        // Parar timer
        this.stopDispatchTimer()
        
        // Atualizar status da campanha para 'dispatched'
        try {
          await supabase
            .from('disparador_campaigns')
            .update({ status: 'dispatched' })
            .eq('id', campaignId)
          console.log('✅ Status da campanha atualizado para: dispatched')
        } catch (statusError) {
          console.log('Status da campanha não foi atualizado (coluna pode não existir):', statusError.message)
        }
      } else {
        console.log(`🔄 Campanha ainda ativa - Pendentes: ${pendingSends?.length || 0}, Falhas para retry: ${failedSends?.length || 0}, Sucesso: ${successRate}%`)
      }
    } catch (error) {
      console.error('Error checking timed campaign completion:', error)
    }
  },

  // Pausar disparo pausado
  async pauseTimedDispatch(campaignId) {
    try {
      // Parar timer
      this.stopDispatchTimer()
      
      // Atualizar status da campanha para 'paused'
      try {
        await supabase
          .from('disparador_campaigns')
          .update({ status: 'paused' })
          .eq('id', campaignId)
        console.log('✅ Status da campanha atualizado para: paused')
      } catch (statusError) {
        console.log('Status da campanha não foi atualizado (coluna pode não existir):', statusError.message)
      }
      
      console.log('⏸️ Disparo pausado para campanha:', campaignId)
      
      return { success: true, message: 'Disparo pausado com sucesso' }
    } catch (error) {
      console.error('Error pausing timed dispatch:', error)
      throw error
    }
  },
  // Retomar disparo pausado
  async resumeTimedDispatch(campaignId) {
    try {
      // Atualizar status da campanha para 'dispatching'
      try {
        await supabase
          .from('disparador_campaigns')
          .update({ status: 'dispatching' })
          .eq('id', campaignId)
        console.log('✅ Status da campanha atualizado para: dispatching')
      } catch (statusError) {
        console.log('Status da campanha não foi atualizado (coluna pode não existir):', statusError.message)
      }
      
      // Reiniciar timer
      await this.startDispatchTimer(campaignId)
      
      console.log('▶️ Disparo retomado para campanha:', campaignId)
      return { success: true }
    } catch (error) {
      console.error('Error resuming timed dispatch:', error)
      throw error
    }
  },

  // Cancelar disparo pausado
  async cancelTimedDispatch(campaignId) {
    try {
      // Parar timer
      this.stopDispatchTimer()
      
      // Cancelar envios pendentes
      await supabase
        .from('disparador_sends')
        .update({ 
          status: 'failed',
          sent_at: new Date().toISOString()
        })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')

      // Atualizar estatísticas da campanha após cancelamento
      await this.updateCampaignStats(campaignId)

      console.log('❌ Disparo cancelado para campanha:', campaignId)
      return { success: true }
    } catch (error) {
      console.error('Error cancelling timed dispatch:', error)
      throw error
    }
  },

  // Corrigir status incorretos na tabela disparador_sends
  async fixIncorrectStatus(campaignId) {
    try {
      console.log('🔧 === CORRIGINDO STATUS INCORRETOS ===')
      
      // Buscar todos os registros da campanha
      const { data: sends } = await supabase
        .from('disparador_sends')
        .select('id, status, sent_at, error_message')
        .eq('campaign_id', campaignId)
      
      console.log(`📋 Total de registros encontrados: ${sends?.length || 0}`)
      
      let corrected = 0
      
      for (const send of sends || []) {
        // Se está marcado como 'failed' mas não tem sent_at nem error_message válido
        // deveria estar como 'pending'
        if (send.status === 'failed' && !send.sent_at && !send.error_message) {
          await supabase
            .from('disparador_sends')
            .update({ 
              status: 'pending',
              error_message: null,
              sent_at: null
            })
            .eq('id', send.id)
          
          corrected++
          console.log(`✅ Corrigido registro ${send.id}: failed → pending`)
        }
      }
      
      console.log(`🎯 Total de registros corrigidos: ${corrected}`)
      return { corrected }
      
    } catch (error) {
      console.error('❌ Erro ao corrigir status:', error)
      throw error
    }
  },

  // Obter status do disparo pausado
  async getTimedDispatchStatus(campaignId) {
    try {
      const { data: campaign } = await supabase
        .from('disparador_campaigns')
        .select('id, name, status, failed_count, success_count, sent_count')
        .eq('id', campaignId)
        .single()

      const { data: sends } = await supabase
        .from('disparador_sends')
        .select('status')
        .eq('campaign_id', campaignId)

      const total = sends?.length || 0
      const sent = sends?.filter(s => s.status === 'sent').length || 0
      const pending = sends?.filter(s => s.status === 'pending').length || 0
      const failed = sends?.filter(s => s.status === 'failed').length || 0
      
      console.log('📊 === STATUS DO DISPARO PAUSADO ===')
      console.log(`📤 Total de registros: ${total}`)
      console.log(`✅ Enviadas (status='sent'): ${sent}`)
      console.log(`⏳ Pendentes (status='pending'): ${pending}`)
      console.log(`❌ Falhas (status='failed'): ${failed}`)
      console.log(`📈 Percentual: ${total > 0 ? Math.round((sent / total) * 100) : 0}%`)
      console.log('📋 Todos os status encontrados:', sends?.map(s => s.status))
      
      // DEBUG: Verificar se há registros com status incorreto
      const statusCounts = sends?.reduce((acc, send) => {
        acc[send.status] = (acc[send.status] || 0) + 1
        return acc
      }, {})
      console.log('📊 Contagem por status:', statusCounts)

      return {
        campaign: {
          ...campaign,
          status: campaign.status // ✅ Usa status real da campanha
        },
        progress: {
          total,
          sent,
          pending,
          failed, // ✅ Conta diretamente da tabela disparador_sends
          percentage: total > 0 ? Math.round((sent / total) * 100) : 0
        }
      }
    } catch (error) {
      console.error('Error getting timed dispatch status:', error)
      throw error
    }
  }
}

export default disparadorService
