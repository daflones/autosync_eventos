import React, { useState, useEffect } from 'react'
import { Plus, Send, Users, MessageSquare, Calendar, Filter, Eye, Play, Pause, Trash2, Upload, Edit, RefreshCw } from 'lucide-react'
import { supabase, fileToBase64, uploadImage } from '../services/supabase'
import { disparadorService } from '../services/disparadorService'
import LoadingSpinner from '../components/common/LoadingSpinner'
import useResponsive from '../hooks/useResponsive'
import toast from 'react-hot-toast'

const Disparador = () => {
  const { isMobile, isTablet } = useResponsive()
  const [campaigns, setCampaigns] = useState([])
  const [eligibleCustomers, setEligibleCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [availableCustomers, setAvailableCustomers] = useState([])
  const [selectedCustomers, setSelectedCustomers] = useState([])
  const [showCustomerSelection, setShowCustomerSelection] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [activeCampaign, setActiveCampaign] = useState(null)
  const [timedDispatchStatus, setTimedDispatchStatus] = useState(null)
  const [showTimedDispatchPanel, setShowTimedDispatchPanel] = useState(false)

  // Função para traduzir status para português
  const translateStatus = (status) => {
    const translations = {
      'draft': 'Rascunho',
      'dispatching': 'Disparando',
      'paused': 'Pausado',
      'dispatched': 'Finalizado',
      'active': 'Disparando',
      'completed': 'Finalizado',
      'cancelled': 'Cancelado'
    }
    return translations[status] || status?.toUpperCase() || 'Desconhecido'
  }

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    message_base: '',
    tone: 'profissional',
    daily_limit: 30,
    image_file: null,
    image_preview: null
  })
  
  const [campaignCustomers, setCampaignCustomers] = useState([])
  const [selectedCampaignCustomers, setSelectedCampaignCustomers] = useState([])
  const [campaignStats, setCampaignStats] = useState({})

  const toneOptions = [
    { value: 'profissional', label: 'Profissional', description: 'Linguagem profissional e respeitosa' },
    { value: 'formal', label: 'Formal', description: 'Linguagem formal e respeitosa' },
    { value: 'casual', label: 'Casual', description: 'Linguagem descontraída e informal' },
    { value: 'amigavel', label: 'Amigável', description: 'Tom caloroso e próximo' }
  ]

  useEffect(() => {
    loadData()
    
    // Processamento automático removido - agora usa setTimeout no service
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadCampaigns(),
        loadEligibleCustomers(),
        loadCampaignStats(),
        checkActiveCampaign()
      ])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const checkActiveCampaign = async () => {
    try {
      const active = await disparadorService.checkActiveCampaign()
      setActiveCampaign(active)
    } catch (error) {
      console.error('Error checking active campaign:', error)
    }
  }

  const loadCampaigns = async () => {
    const { data, error } = await supabase
      .from('disparador_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    setCampaigns(data || [])
  }

  const loadEligibleCustomers = async () => {
    try {
      console.log('🔍 Carregando clientes elegíveis para dashboard...')
      
      // 1. Buscar todos os clientes
      const { data: allCustomers, error: customersError } = await supabase
        .from('customers')
        .select('id, name, remotejid')
        .not('remotejid', 'is', null)
        .neq('remotejid', '')
      
      if (customersError) {
        console.error('❌ Erro ao carregar clientes:', customersError)
        setEligibleCustomers([])
        return
      }
      
      // 2. Buscar clientes que já estão em campanhas (qualquer status)
      const { data: customersInCampaigns, error: campaignsError } = await supabase
        .from('disparador_sends')
        .select('remotejid')
        .not('remotejid', 'is', null)
        .neq('remotejid', '')
      
      if (campaignsError) {
        console.error('❌ Erro ao buscar clientes em campanhas:', campaignsError)
        setEligibleCustomers([])
        return
      }
      
      // 3. Filtrar clientes elegíveis (excluir os que já estão em campanhas)
      const busyRemoteJids = new Set(customersInCampaigns?.map(c => c.remotejid) || [])
      const eligibleCustomers = allCustomers?.filter(customer => 
        !busyRemoteJids.has(customer.remotejid)
      ) || []
      
      console.log('📊 Dashboard - Total clientes:', allCustomers?.length || 0)
      console.log('📊 Dashboard - RemoteJIDs em campanhas:', busyRemoteJids.size)
      console.log('✅ Dashboard - Clientes elegíveis:', eligibleCustomers.length)
      
      setEligibleCustomers(eligibleCustomers)
      
    } catch (error) {
      console.error('💥 Erro ao carregar clientes elegíveis:', error)
      setEligibleCustomers([])
    }
  }

  // Função para marcar campanha como concluída
  const markCampaignAsCompleted = async (campaignId) => {
    try {
      console.log(`🎯 Marcando campanha ${campaignId} como concluída...`)
      
      const { error: updateError } = await supabase
        .from('disparador_campaigns')
        .update({ status: 'completed' })
        .eq('id', campaignId)
      
      if (updateError) {
        console.error('❌ Erro ao atualizar status da campanha:', updateError)
        return false
      } else {
        console.log('✅ Status da campanha atualizado para: completed')
        return true
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar status da campanha:', error)
      return false
    }
  }

  const loadCampaignStats = async () => {
    try {
      // Buscar estatísticas de todas as campanhas
      const { data: campaigns, error: campaignsError } = await supabase
        .from('disparador_campaigns')
        .select('id')
      
      if (campaignsError) throw campaignsError
      
      const statsMap = {}
      
      // Para cada campanha, calcular estatísticas dos envios (mesma lógica do controle de disparo)
      for (const campaign of campaigns || []) {
        // Buscar dados completos da campanha incluindo status
        const { data: campaignData, error: campaignError } = await supabase
          .from('disparador_campaigns')
          .select('id, status')
          .eq('id', campaign.id)
          .single()
        
        if (campaignError || !campaignData) continue
        
        // Para campanhas finalizadas/canceladas, apenas calcular estatísticas sem verificar 30 envios
        const shouldCheckCompletion = !['completed', 'cancelled', 'dispatched'].includes(campaignData.status)
        
        const { data: sends, error: sendsError } = await supabase
          .from('disparador_sends')
          .select('status, sent_at')
          .eq('campaign_id', campaign.id)
        
        if (!sendsError && sends) {
          const totalSends = sends.length
          const sentCount = sends.filter(s => s.status === 'sent').length
          const pendingCount = sends.filter(s => s.status === 'pending').length
          const failedCount = sends.filter(s => s.status === 'failed').length
          
          // Calcular envios de hoje
          const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
          const sentToday = sends.filter(s => 
            s.status === 'sent' && 
            s.sent_at && 
            s.sent_at.startsWith(today)
          ).length
          
          console.log(`📊 Campanha ${campaign.id}:`, {
            total: totalSends,
            sent: sentCount,
            pending: pendingCount,
            failed: failedCount,
            sentToday: sentToday,
            today: today
          })
          
          // Verificar se atingiu o limite de 30 envios (apenas para campanhas ativas)
          const isCompleted = sentCount >= 30
          
          statsMap[campaign.id] = {
            id: campaign.id,
            sent_count: sentCount,
            pending_count: pendingCount,
            failed_count: failedCount,
            sent_today: sentToday,
            total_sends: totalSends,
            is_completed: isCompleted,
            campaign_status: campaignData.status
          }
          
          // Se atingiu 30 envios E a campanha ainda está ativa, marcar como concluída
          if (isCompleted && shouldCheckCompletion) {
            await markCampaignAsCompleted(campaign.id)
          }
        }
      }
      
      setCampaignStats(statsMap)
      
    } catch (error) {
      console.error('Error loading campaign stats:', error)
    }
  }

  const handleCreateCampaign = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      let imageBase64 = null
      let imageUrl = null

      // Upload da imagem se houver
      if (newCampaign.image_file) {
        const base64 = await fileToBase64(newCampaign.image_file)
        imageBase64 = base64
        
        // Upload para storage também
        const fileName = `campaign_${Date.now()}_${newCampaign.image_file.name}`
        const { data: uploadData, error: uploadError } = await uploadImage(newCampaign.image_file, fileName)
        if (uploadError) throw uploadError
        imageUrl = uploadData.path
      }

      const campaignData = {
        name: newCampaign.name,
        message_base: newCampaign.message_base,
        tone: newCampaign.tone,
        daily_limit: 30, // Fixo em 30
        image_base64: imageBase64,
        image_url: imageUrl,
        status: 'draft',
        total_customers: 0,
        sent_count: 0
      }

      if (editingCampaign) {
        // Atualizar campanha existente
        const { error } = await supabase
          .from('disparador_campaigns')
          .update(campaignData)
          .eq('id', editingCampaign.id)
        
        if (error) throw error
        toast.success('Campanha atualizada com sucesso!')
      } else {
        // Criar nova campanha com clientes selecionados
        const result = await disparadorService.createCampaignWithCustomers(campaignData, selectedCampaignCustomers)
        toast.success('Campanha criada com sucesso!')
      }
      
      setShowCreateModal(false)
      setEditingCampaign(null)
      setNewCampaign({
        name: '',
        message_base: '',
        tone: 'profissional',
        daily_limit: 30,
        image_file: null,
        image_preview: null
      })
      setSelectedCampaignCustomers([])
      setCampaignCustomers([])
      
      // Fechar modal primeiro, depois recarregar dados
      setShowCreateModal(false)
      setEditingCampaign(null)
      
      // Recarregar dados após um pequeno delay
      setTimeout(() => {
        loadData()
      }, 100)
    } catch (error) {
      console.error('Error saving campaign:', error)
      toast.error(editingCampaign ? 'Erro ao atualizar campanha' : 'Erro ao criar campanha')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = async () => {
    setEditingCampaign(null)
    setNewCampaign({
      name: '',
      message_base: '',
      tone: 'profissional',
      daily_limit: 30,
      image_file: null,
      image_preview: null
    })
    
    // DEBUG COMPLETO - Carregar clientes elegíveis
    try {
      console.log('🔍 === INICIANDO DEBUG COMPLETO ===')
      console.log('🔍 Carregando clientes elegíveis para nova campanha...')
      
      // DEBUG: Verificar conexão com Supabase
      console.log('🔗 Testando conexão com Supabase...')
      try {
        const { data: connectionTest, error: connectionError } = await supabase
          .from('customers')
          .select('count', { count: 'exact', head: true })
        
        console.log('📊 Resultado teste de conexão:', {
          error: connectionError,
          count: connectionTest
        })
      } catch (connError) {
        console.error('❌ Erro de conexão:', connError)
      }
      
      // DEBUG: Verificar estrutura da tabela customers
      console.log('🏗️ Verificando estrutura da tabela customers...')
      try {
        const { data: sampleCustomers, error: sampleError } = await supabase
          .from('customers')
          .select('*')
          .limit(3)
        
        console.log('📋 Amostra da tabela customers:', {
          error: sampleError,
          count: sampleCustomers?.length || 0,
          sample: sampleCustomers
        })
        
        if (sampleCustomers && sampleCustomers.length > 0) {
          console.log('🔍 Campos disponíveis:', Object.keys(sampleCustomers[0]))
          console.log('📝 Exemplo de cliente:', sampleCustomers[0])
        }
      } catch (structError) {
        console.error('❌ Erro ao verificar estrutura:', structError)
      }
      
      // Buscar clientes que já estão em campanhas (qualquer status)
      console.log('🔍 Buscando clientes já em campanhas...')
      const { data: customersInCampaigns, error: campaignsError } = await supabase
        .from('disparador_sends')
        .select('remotejid')
        .not('remotejid', 'is', null)
        .neq('remotejid', '')
      
      const busyRemoteJids = new Set(customersInCampaigns?.map(c => c.remotejid) || [])
      console.log('🚫 RemoteJIDs já em campanhas:', busyRemoteJids.size)
      
      // Usar função RPC e aplicar filtro de remotejid
      let eligibleCustomers = null
      console.log('🎯 Tentando função RPC get_next_eligible_customers')
      try {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_next_eligible_customers', {
            campaign_uuid: null,
            limit_count: 200 // Aumentar limite para compensar filtro
          })
        
        console.log('📊 Resultado RPC:', {
          error: rpcError,
          data: rpcData,
          length: rpcData?.length || 0
        })
        
        if (!rpcError && rpcData) {
          // Filtrar clientes cujo remotejid já está em campanhas
          eligibleCustomers = rpcData.filter(customer => 
            !busyRemoteJids.has(customer.remotejid)
          )
          console.log('✅ Função RPC funcionou:', rpcData.length, '→ Após filtro remotejid:', eligibleCustomers.length)
          console.log('📝 Amostra após filtro:', eligibleCustomers.slice(0, 3))
        } else {
          console.log('⚠️ Função RPC falhou:', rpcError?.message)
        }
      } catch (rpcError) {
        console.log('⚠️ Função RPC não existe ou erro:', rpcError.message)
      }
      
      // Se RPC não funcionou, tentar query direta na view
      if (!eligibleCustomers) {
        console.log('🎯 TENTATIVA 2: View v_eligible_customers')
        try {
          const { data: viewData, error: viewError } = await supabase
            .from('v_eligible_customers')
            .select('id, name, remotejid')
            .eq('is_eligible', true)
            .not('remotejid', 'is', null)
            .neq('remotejid', '')
            .limit(100)
          
          console.log('📊 Resultado View:', {
            error: viewError,
            data: viewData,
            length: viewData?.length || 0
          })
          
          if (!viewError && viewData) {
            // Filtrar clientes inelegíveis do resultado da view
            const filteredViewData = viewData.filter(customer => 
              !ineligibleIds.includes(customer.id)
            )
            
            eligibleCustomers = filteredViewData.map(customer => ({
              customer_id: customer.id,
              customer_name: customer.name,
              remotejid: customer.remotejid
            }))
            console.log('✅ View funcionou:', viewData.length, '→ Após filtros:', eligibleCustomers.length)
            console.log('📝 Amostra View:', eligibleCustomers.slice(0, 3))
          } else {
            console.log('⚠️ View falhou:', viewError?.message)
          }
        } catch (viewError) {
          console.log('⚠️ View não existe ou erro:', viewError.message)
        }
      }
      
      // Se view não funcionou, query direta na tabela customers
      if (!eligibleCustomers) {
        console.log('🎯 TENTATIVA 3: Query direta na tabela customers')
        
        // DEBUG: Primeiro verificar quantos clientes existem no total
        try {
          const { data: totalCustomers, error: totalError } = await supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
          
          console.log('📊 Total de clientes na tabela:', {
            error: totalError,
            count: totalCustomers
          })
        } catch (totalError) {
          console.log('⚠️ Erro ao contar clientes:', totalError)
        }
        
        // DEBUG: Verificar clientes com remotejid
        try {
          const { data: withRemotejid, error: remotejidError } = await supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .not('remotejid', 'is', null)
            .neq('remotejid', '')
            .neq('remotejid', 'null')
          
          console.log('📊 Clientes com remotejid válido:', {
            error: remotejidError,
            count: withRemotejid
          })
        } catch (remotejidError) {
          console.log('⚠️ Erro ao verificar remotejid:', remotejidError)
        }
        
        // Tentar query principal - aplicando filtros de elegibilidade
        try {
          console.log('🎯 TENTATIVA 3: Query direta com filtros de elegibilidade')
          
          // Query principal excluindo clientes inelegíveis
          let query = supabase
            .from('customers')
            .select('id, name, remotejid, phone')
            .not('remotejid', 'is', null)
            .neq('remotejid', '')
            .neq('remotejid', 'null')
          
          // Aplicar exclusões se houver clientes inelegíveis
          if (ineligibleIds.length > 0) {
            query = query.not('id', 'in', `(${ineligibleIds.join(',')})`)
          }
          
          const { data: customersData, error: customersError } = await query.limit(100)
          
          console.log('📊 Resultado Query Direta:', {
            error: customersError,
            data: customersData,
            length: customersData?.length || 0
          })
          
          if (!customersError && customersData) {
            eligibleCustomers = customersData.map(customer => ({
              customer_id: customer.id,
              customer_name: customer.name,
              remotejid: customer.remotejid || `${customer.phone}@s.whatsapp.net`
            }))
            console.log('✅ Query direta funcionou:', eligibleCustomers.length)
            console.log('📝 Amostra Query Direta:', eligibleCustomers.slice(0, 3))
          } else {
            console.log('❌ Query direta falhou:', customersError?.message)
            
            // DEBUG: Tentar query mais simples
            console.log('🔄 Tentando query ainda mais simples...')
            const { data: simpleData, error: simpleError } = await supabase
              .from('customers')
              .select('id, name, phone')
              .limit(10)
            
            console.log('📊 Query simples:', {
              error: simpleError,
              data: simpleData,
              length: simpleData?.length || 0
            })
            
            toast.error(`Erro ao carregar clientes: ${customersError?.message}`)
            return
          }
        } catch (customersError) {
          console.log('❌ Erro na query direta:', customersError.message)
          toast.error(`Erro ao carregar clientes: ${customersError.message}`)
          return
        }
      }
      
      console.log('🎯 === RESULTADO FINAL ===')
      console.log('✅ Clientes elegíveis encontrados:', eligibleCustomers?.length || 0)
      console.log('📝 Amostra de clientes elegíveis:', eligibleCustomers?.slice(0, 3))
      console.log('🔍 Estrutura do primeiro cliente:', eligibleCustomers?.[0])
      
      if (!eligibleCustomers || eligibleCustomers.length === 0) {
        console.log('⚠️ === NENHUM CLIENTE ENCONTRADO ===')
        toast('⚠️ Nenhum cliente encontrado. Verifique se há clientes cadastrados com remotejid preenchido.', { 
          icon: '⚠️',
          duration: 4000 
        })
        setCampaignCustomers([])
        setSelectedCampaignCustomers([])
        setShowCreateModal(true)
        return
      }
      
      console.log('🔄 Definindo estados do React...')
      
      // Limitar a lista para apenas 30 clientes para melhor performance
      const limitedCustomers = eligibleCustomers.slice(0, 30)
      setCampaignCustomers(limitedCustomers)
      
      // Selecionar automaticamente todos os 30 clientes mostrados
      setSelectedCampaignCustomers(limitedCustomers)
      
      console.log('🎯 Estados definidos:')
      console.log('📋 campaignCustomers:', limitedCustomers.length)
      console.log('✅ selectedCampaignCustomers:', limitedCustomers.length)
      
    } catch (error) {
      console.error('💥 Erro geral ao carregar clientes:', error)
      toast.error(`Erro ao carregar clientes: ${error.message}`)
    }
    
    console.log('🚪 Abrindo modal de criação...')
    setShowCreateModal(true)
    
    // Toast de feedback após abrir o modal
    setTimeout(() => {
      if (campaignCustomers.length > 0) {
        if (campaignCustomers.length < 30) {
          toast.info(`${campaignCustomers.length} clientes encontrados (todos selecionados)`)
        } else {
          toast.success(`Clientes elegíveis carregados (mostrando 30 primeiros, todos selecionados)`)
        }
      }
    }, 100)
    
    // DEBUG: Verificar estados após um pequeno delay
    setTimeout(() => {
      console.log('🔍 === VERIFICAÇÃO FINAL DOS ESTADOS ===')
      console.log('📋 campaignCustomers.length:', campaignCustomers.length)
      console.log('✅ selectedCampaignCustomers.length:', selectedCampaignCustomers.length)
      console.log('🚪 showCreateModal:', true)
      console.log('📝 Amostra campaignCustomers:', campaignCustomers.slice(0, 3))
      console.log('🎯 Lista limitada a 30 clientes para melhor performance')
    }, 500)
  }

  const handleStartCampaign = async (campaignId) => {
    try {
      // Verificar se já existe uma campanha com status 'dispatching' (apenas uma permitida)
      const { data: activeCampaigns } = await supabase
        .from('disparador_campaigns')
        .select('id, name')
        .eq('status', 'dispatching')

      if (activeCampaigns && activeCampaigns.length > 0) {
        const activeCampaign = activeCampaigns[0]
        if (activeCampaign.id !== campaignId) {
          toast.error(`Já existe uma campanha disparando: "${activeCampaign.name}". Apenas uma campanha pode estar em execução por vez.`)
          return
        }
      }

      // Verificar se já existem registros pendentes para esta campanha específica
      const { data: pendingSends } = await supabase
        .from('disparador_sends')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')

      if (pendingSends && pendingSends.length > 0) {
        // Já existe disparo pausado em andamento - mostrar painel de controle
        toast.success(`Campanha já possui ${pendingSends.length} envios pendentes. Abrindo painel de controle...`)
        setSelectedCampaign({ id: campaignId })
        setShowTimedDispatchPanel(true)
        loadTimedDispatchStatus(campaignId)
        return
      }

      // Buscar clientes já atrelados à campanha (status 'scheduled')
      const { data: campaignCustomers, error: customersError } = await supabase
        .from('disparador_sends')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'scheduled')

      if (customersError) throw customersError

      if (!campaignCustomers || campaignCustomers.length === 0) {
        toast.error('Nenhum cliente encontrado para esta campanha')
        return
      }

      // Buscar dados da campanha
      const { data: campaign, error: campaignError } = await supabase
        .from('disparador_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (campaignError) throw campaignError

      // Preparar dados dos clientes para disparo
      const customersData = campaignCustomers.map(record => ({
        customer_id: record.customer_id,
        customer_name: record.customer_name,
        remotejid: record.remotejid,
        message: record.message_content
      }))

      console.log('Iniciando disparo pausado para:', customersData.length, 'clientes da campanha')

      try {
        // Atualizar status dos registros para 'pending'
        await supabase
          .from('disparador_sends')
          .update({ status: 'pending' })
          .eq('campaign_id', campaignId)
          .eq('status', 'scheduled')

        // Disparo pausado (10 minutos entre cada envio)
        toast(`🕐 Iniciando disparo pausado para ${customersData.length} clientes (intervalo: 10 min)...`)
        
        const result = await disparadorService.startTimedDispatchWithExistingRecords(campaignId, campaign)
        
        toast.success(`✅ Disparo pausado iniciado! ${customersData.length} mensagens agendadas.`)
        console.log(`✅ Disparo pausado configurado para ${customersData.length} clientes`)
        
        // Mostrar painel de controle do disparo pausado
        setShowTimedDispatchPanel(true)
        setSelectedCampaign({ id: campaignId })
        loadTimedDispatchStatus(campaignId)
        
        // Recarregar dados para atualizar o dashboard
        loadData()
        
      } catch (error) {
        console.error('❌ Erro ao iniciar disparo:', error)
        toast.error(error.message || 'Erro ao iniciar disparo')
      }
    } catch (error) {
      console.error('Error loading campaign customers:', error)
      toast.error('Erro ao carregar clientes da campanha')
    }
  }

  const handlePauseCampaign = async (campaignId) => {
    try {
      // Verificar se já atingiu 30 envios
      const stats = campaignStats[campaignId]
      if (stats?.sent_count >= 30) {
        toast.error('Campanha já foi concluída com 30 envios!')
        return
      }
      
      await disparadorService.pauseTimedDispatch(campaignId)
      toast.success('Campanha pausada! Você pode retomá-la a qualquer momento.')
      loadData()
    } catch (error) {
      console.error('Error pausing campaign:', error)
      toast.error('Erro ao pausar campanha')
    }
  }

  // Função para fechar modal ao clicar fora
  const handleModalBackdropClick = (e, closeFunction) => {
    if (e.target === e.currentTarget) {
      closeFunction()
    }
  }

  // Função para converter phone em remotejid
  const convertPhoneToRemotejid = (phone) => {
    if (!phone || phone === 'null' || phone === '') {
      return null;
    }

    // Se já é um remotejid, retornar como está
    if (phone.includes('@')) {
      return phone;
    }

    // Limpar número (remover caracteres não numéricos)
    const cleanNumber = phone.replace(/\D/g, '');
    
    if (cleanNumber.length === 11) {
      // 11 dígitos: adicionar 55 (se não houver) + @s.whatsapp.net
      return `55${cleanNumber}@s.whatsapp.net`;
    } else if (cleanNumber.length === 13) {
      // 13 dígitos: usar @lid
      return `${cleanNumber}@lid`;
    } else if (cleanNumber.length === 14) {
      // 14 dígitos: usar @lid
      return `${cleanNumber}@lid`;
    } else if (cleanNumber.length === 15) {
      // 15 dígitos: usar @lid
      return `${cleanNumber}@lid`;
    }

    // Se não atender as condições, retornar null
    return null;
  }

  // Função para atualizar remotejid de todos os clientes baseado no phone
  const handleUpdateRemoteJids = async () => {
    try {
      setLoading(true)
      console.log('🔄 Iniciando conversão de Phone para RemoteJID...')

      // Buscar todos os clientes que têm phone
      const { data: customers, error: fetchError } = await supabase
        .from('customers')
        .select('id, name, phone, remotejid')
        .not('phone', 'is', null)
        .neq('phone', '')

      if (fetchError) {
        throw fetchError
      }

      console.log(`📋 Encontrados ${customers.length} clientes com phone para processar`)

      let updatedCount = 0
      let skippedCount = 0
      let errorCount = 0

      // Processar cada cliente
      for (const customer of customers) {
        const newRemotejid = convertPhoneToRemotejid(customer.phone)

        if (newRemotejid) {
          // Atualizar remotejid baseado no phone
          const { error: updateError } = await supabase
            .from('customers')
            .update({ remotejid: newRemotejid })
            .eq('id', customer.id)

          if (updateError) {
            console.error(`❌ Erro ao atualizar cliente ${customer.name}:`, updateError)
            errorCount++
          } else {
            console.log(`✅ ${customer.name}: ${customer.phone} → ${newRemotejid}`)
            updatedCount++
          }
        } else {
          console.log(`⚠️ ${customer.name}: Phone inválido (${customer.phone}) - pulado`)
          skippedCount++
        }
      }

      const message = `✅ Conversão concluída! ${updatedCount} atualizados, ${skippedCount} pulados, ${errorCount} erros`
      toast.success(message)
      console.log(`🎯 ${message}`)

    } catch (error) {
      console.error('❌ Erro ao converter Phone para RemoteJID:', error)
      toast.error('Erro ao converter números de telefone')
    } finally {
      setLoading(false)
    }
  }

  const handleResumeCampaign = async (campaignId) => {
    try {
      // Verificar se já atingiu 30 envios
      const stats = campaignStats[campaignId]
      if (stats?.sent_count >= 30) {
        toast.error('Campanha já foi concluída com 30 envios!')
        return
      }
      
      // Verificar se já existe uma campanha com status 'dispatching' (apenas uma permitida)
      const { data: activeCampaigns } = await supabase
        .from('disparador_campaigns')
        .select('id, name')
        .eq('status', 'dispatching')

      if (activeCampaigns && activeCampaigns.length > 0) {
        const activeCampaign = activeCampaigns[0]
        if (activeCampaign.id !== campaignId) {
          toast.error(`Já existe uma campanha disparando: "${activeCampaign.name}". Apenas uma campanha pode estar em execução por vez.`)
          return
        }
      }

      await disparadorService.resumeTimedDispatch(campaignId)
      toast.success('Campanha retomada! Disparos continuarão.')
      loadData()
    } catch (error) {
      console.error('Error resuming campaign:', error)
      toast.error(error.message || 'Erro ao retomar campanha')
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file && file.size <= 5 * 1024 * 1024) { // 5MB limit
      setNewCampaign({
        ...newCampaign,
        image_file: file,
        image_preview: URL.createObjectURL(file)
      })
    } else {
      toast.error('Imagem deve ter no máximo 5MB')
    }
  }

  const handleViewCampaign = async (campaign) => {
    try {
      // Carregar dados completos da campanha (incluindo imagem)
      const { data: fullCampaign, error } = await supabase
        .from('disparador_campaigns')
        .select('*')
        .eq('id', campaign.id)
        .single()
      
      if (error) throw error
      
      // Carregar clientes da campanha
      const { data: campaignCustomers, error: customersError } = await supabase
        .from('disparador_sends')
        .select('customer_id, customer_name, remotejid, status, sent_at, error_message')
        .eq('campaign_id', campaign.id)
        .order('customer_name', { ascending: true })
      
      if (customersError) {
        console.error('Erro ao carregar clientes da campanha:', customersError)
      }
      
      setSelectedCampaign({
        ...fullCampaign,
        customers: campaignCustomers || []
      })
      
      // Mostrar painel de controle apenas para campanhas com status 'dispatching'
      if (campaign.status === 'dispatching') {
        console.log('📊 Campanha disparando - abrindo painel de controle')
        setShowTimedDispatchPanel(true)
        loadTimedDispatchStatus(campaign.id)
      } else {
        // Para outros status, mostrar modal de visualização normal
        console.log('👁️ Campanha não está disparando - abrindo modal de visualização')
        setShowViewModal(true)
      }
    } catch (error) {
      console.error('Erro ao carregar dados da campanha:', error)
      toast.error('Erro ao carregar dados da campanha')
    }
  }

  const handleEditCampaign = async (campaign) => {
    try {
      // Verificar se campanha tem disparo ativo
      const { data: pendingSends } = await supabase
        .from('disparador_sends')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
      
      if (pendingSends && pendingSends.length > 0) {
        toast('⚠️ Não é possível editar campanha com disparo ativo. Pause o disparo primeiro.', { 
          icon: '⚠️',
          duration: 4000 
        })
        return
      }
      
      // Carregar dados completos da campanha (incluindo imagem)
      const { data: fullCampaign, error } = await supabase
        .from('disparador_campaigns')
        .select('*')
        .eq('id', campaign.id)
        .single()
      
      if (error) throw error
      
      // Permitir edição de nome, mensagem base e imagem
      setEditingCampaign(fullCampaign)
      setNewCampaign({
        name: fullCampaign.name,
        message_base: fullCampaign.message_base,
        tone: fullCampaign.tone,
        daily_limit: fullCampaign.daily_limit,
        image_file: null,
        image_preview: fullCampaign.image_base64 ? `data:image/jpeg;base64,${fullCampaign.image_base64}` : null
      })
      setShowCreateModal(true)
        
    } catch (error) {
      console.error('Erro ao verificar status da campanha:', error)
      toast.error('Erro ao verificar status da campanha')
    }
  }

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Tem certeza que deseja deletar esta campanha? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      setLoading(true)
      
      // Deletar registros relacionados primeiro
      await supabase.from('disparador_sends').delete().eq('campaign_id', campaignId)
      await supabase.from('disparador_customer_history').delete().eq('campaign_id', campaignId)
      await supabase.from('disparador_daily_limits').delete().eq('campaign_id', campaignId)
      
      // Deletar a campanha
      const { error } = await supabase
        .from('disparador_campaigns')
        .delete()
        .eq('id', campaignId)

      if (error) throw error

      toast.success('Campanha deletada com sucesso!')
      loadData()
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast.error('Erro ao deletar campanha')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDisparo = async () => {
    try {
      if (selectedCustomers.length === 0) {
        toast.error('Selecione pelo menos um cliente')
        return
      }

      setLoading(true)
      console.log('Iniciando disparo pausado para:', selectedCustomers.length, 'clientes')

      // Buscar dados da campanha
      const { data: campaign, error: campaignError } = await supabase
        .from('disparador_campaigns')
        .select('*')
        .eq('id', selectedCampaign.id)
        .single()

      if (campaignError) throw campaignError

      // Preparar dados de todos os clientes para envio pausado
      const customersData = selectedCustomers.map(customer => {
        const messageContent = campaign.message_base.replace('{nome}', customer.customer_name)
        return {
          customer_id: customer.customer_id,
          customer_name: customer.customer_name,
          remotejid: customer.remotejid,
          message: messageContent
        }
      })

      console.log('Enviando disparo pausado para:', customersData.length, 'clientes')

      try {
        // Disparo pausado (10 minutos entre cada envio)
        toast(`🕐 Iniciando disparo pausado para ${customersData.length} clientes (intervalo: 10 min)...`)
        
        const result = await disparadorService.startTimedDispatch(selectedCampaign.id, customersData, campaign)
        
        toast.success(`✅ Disparo pausado iniciado! ${result.scheduled_count} mensagens agendadas.`)
        console.log(`✅ Disparo pausado configurado para ${result.scheduled_count} clientes`)
        
        // Mostrar painel de controle do disparo pausado
        setShowTimedDispatchPanel(true)
        loadTimedDispatchStatus(selectedCampaign.id)
        
      } catch (error) {
        console.error('❌ Erro ao iniciar disparo:', error)
        toast.error(error.message || 'Erro ao iniciar disparo')
      }

      setShowCustomerSelection(false)
      setSelectedCustomers([])
      setAvailableCustomers([])
      loadData()
    } catch (error) {
      console.error('Error processing campaign:', error)
      toast.error('Erro ao processar disparo')
    } finally {
      setLoading(false)
    }
  }


  const loadTimedDispatchStatus = async (campaignId) => {
    try {
      const status = await disparadorService.getTimedDispatchStatus(campaignId)
      
      // Carregar clientes da campanha ativa
      const { data: campaignCustomers, error: customersError } = await supabase
        .from('disparador_sends')
        .select('customer_id, customer_name, remotejid, status, sent_at, error_message')
        .eq('campaign_id', campaignId)
        .order('customer_name', { ascending: true })
      
      if (customersError) {
        console.error('Erro ao carregar clientes da campanha ativa:', customersError)
      }
      
      setTimedDispatchStatus({
        ...status,
        customers: campaignCustomers || []
      })
      
      // Debug: Verificar se o timer está ativo
      console.log('🔍 === DEBUG TIMER STATUS ===')
      console.log('📋 Campanha ID:', campaignId)
      console.log('⏰ Timer ativo:', !!disparadorService.dispatchTimer)
      console.log('📊 Campanha ativa no service:', disparadorService.activeCampaignId)
      console.log('💾 LocalStorage:', JSON.parse(localStorage.getItem('disparador_active_campaigns') || '[]'))
      console.log('📈 Status da campanha:', status?.campaign?.status)
      console.log('🔄 Progresso:', status?.progress)
      console.log('👥 Clientes carregados:', campaignCustomers?.length || 0)
      
    } catch (error) {
      console.error('Error loading timed dispatch status:', error)
    }
  }

  const handlePauseTimedDispatch = async (campaignId) => {
    try {
      await disparadorService.pauseTimedDispatch(campaignId)
      toast.success('Disparo pausado')
      loadTimedDispatchStatus(campaignId)
      loadData()
    } catch (error) {
      console.error('Error pausing timed dispatch:', error)
      toast.error('Erro ao pausar disparo')
    }
  }

  const handleResumeTimedDispatch = async (campaignId) => {
    try {
      // Verificar se já existe uma campanha com status 'dispatching' (apenas uma permitida)
      const { data: activeCampaigns } = await supabase
        .from('disparador_campaigns')
        .select('id, name')
        .eq('status', 'dispatching')

      if (activeCampaigns && activeCampaigns.length > 0) {
        const activeCampaign = activeCampaigns[0]
        if (activeCampaign.id !== campaignId) {
          toast.error(`Já existe uma campanha disparando: "${activeCampaign.name}". Apenas uma campanha pode estar em execução por vez.`)
          return
        }
      }

      await disparadorService.resumeTimedDispatch(campaignId)
      toast.success('Disparo retomado')
      loadTimedDispatchStatus(campaignId)
      loadData()
    } catch (error) {
      console.error('Error resuming timed dispatch:', error)
      toast.error('Erro ao retomar disparo')
    }
  }

  const handleCancelTimedDispatch = async (campaignId) => {
    try {
      await disparadorService.cancelTimedDispatch(campaignId)
      toast.success('Disparo cancelado')
      setShowTimedDispatchPanel(false)
      setTimedDispatchStatus(null)
      loadData()
    } catch (error) {
      console.error('Error cancelling timed dispatch:', error)
      toast.error('Erro ao cancelar disparo')
    }
  }

  const toggleCustomerSelection = (customer) => {
    setSelectedCustomers(prev => {
      const isSelected = prev.find(c => c.customer_id === customer.customer_id)
      if (isSelected) {
        return prev.filter(c => c.customer_id !== customer.customer_id)
      } else {
        if (prev.length >= 30) {
          toast('⚠️ Máximo de 30 clientes por disparo', { 
            icon: '⚠️',
            duration: 3000 
          })
          return prev
        }
        return [...prev, customer]
      }
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' }
      case 'dispatching': return { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' }
      case 'active': return { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' }
      case 'paused': return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' }
      case 'dispatched': return { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' }
      case 'completed': return { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' }
      case 'cancelled': return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }
      default: return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' }
    }
  }

  const getToneColor = (tone) => {
    switch (tone) {
      case 'profissional': return '#6366f1'
      case 'formal': return '#6366f1'
      case 'casual': return '#10b981'
      case 'amigavel': return '#f59e0b'
      case 'promocional': return '#ef4444'
      case 'urgente': return '#8b5cf6'
      default: return '#6b7280'
    }
  }

  if (loading) {
    return (
      <div style={{ 
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        padding: '1rem'
      }}>
        <LoadingSpinner text="Carregando disparador..." />
      </div>
    )
  }

  return (
    <div style={{ 
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      padding: '1rem'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '1rem' : '0',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div>
          <h1 style={{ 
            fontSize: isMobile ? '1.5rem' : '2rem', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '0.5rem'
          }}>
            🚀 Disparador de Mensagens
          </h1>
          <p style={{ 
            color: '#64748b', 
            fontSize: '1rem',
            margin: 0
          }}>
            Envie mensagens em massa para seus clientes de forma inteligente
          </p>
        </div>
        
        <button 
          onClick={handleCreateNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: isMobile ? '0.75rem 1.5rem' : '0.875rem 1.75rem',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: isMobile ? '0.9rem' : '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
            boxShadow: '0 4px 6px rgba(139, 92, 246, 0.25)'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#7c3aed'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#8b5cf6'}
        >
          <Plus size={isMobile ? 18 : 20} />
          Nova Campanha
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#f0f9ff',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={24} color="#0ea5e9" />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b' }}>
                {eligibleCustomers.length}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Clientes Elegíveis
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#f0fdf4',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageSquare size={24} color="#22c55e" />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b' }}>
                {campaigns.filter(c => c.status === 'dispatching').length}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Campanhas Ativas
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#fef3c7',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Send size={24} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b' }}>
                {Object.values(campaignStats).reduce((sum, stat) => sum + (stat.sent_today || 0), 0)}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Enviadas Hoje
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: isMobile ? '1.5rem' : '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #f1f5f9'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            color: '#1e293b',
            margin: 0
          }}>
            Campanhas ({campaigns.length})
          </h2>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={handleUpdateRemoteJids}
              disabled={loading}
              style={{
                display: 'none', // Ocultar botão Converter Phone → RemoteJID
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: loading ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw size={16} />
              {loading ? 'Convertendo...' : 'Converter Phone → RemoteJID'}
            </button>
            
            <button 
              onClick={handleCreateNew}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} />
              Nova Campanha
            </button>
          </div>
        </div>


        {campaigns.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            color: '#6b7280'
          }}>
            <MessageSquare size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Nenhuma campanha criada
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              Crie sua primeira campanha de disparos para começar
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={handleUpdateRemoteJids}
              disabled={loading}
              style={{
                display: 'none', // Ocultar botão Converter Phone → RemoteJID
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: loading ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw size={16} />
              {loading ? 'Convertendo...' : 'Converter Phone → RemoteJID'}
            </button>
            
            <button 
              onClick={handleCreateNew}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} />
              Nova Campanha
            </button>
          </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {campaigns.map((campaign) => {
              const statusColors = getStatusColor(campaign.status)
              const stats = campaignStats[campaign.id] || {}
              
              return (
                <div
                  key={campaign.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    backgroundColor: '#fafbfc',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? '1rem' : '0'
                  }}>
                    {/* Campaign Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.5rem'
                      }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: statusColors.bg,
                          color: statusColors.text,
                          border: `1px solid ${statusColors.border}`
                        }}>
                          {translateStatus(campaign.status)}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '6px',
                          backgroundColor: getToneColor(campaign.tone) + '20',
                          color: getToneColor(campaign.tone),
                          border: `1px solid ${getToneColor(campaign.tone)}40`
                        }}>
                          {toneOptions.find(t => t.value === campaign.tone)?.label}
                        </span>
                        {campaign.status === 'active' && (
                          <div style={{
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#10b981',
                            borderRadius: '50%',
                            animation: 'pulse 2s infinite'
                          }}></div>
                        )}
                      </div>

                      <p style={{
                        color: '#64748b',
                        fontSize: '0.875rem',
                        margin: '0 0 1rem 0',
                        lineHeight: '1.5'
                      }}>
                        {(campaign.message_base || campaign.message_template || '').substring(0, 150)}
                        {(campaign.message_base || campaign.message_template || '').length > 150 && '...'}
                      </p>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
                        gap: '1rem',
                        fontSize: '0.875rem'
                      }}>
                        <div>
                          <span style={{ color: '#64748b' }}>Pendentes:</span>
                          <div style={{ fontWeight: '600', color: '#d97706' }}>
                            {stats.pending_count || 0}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Enviadas:</span>
                          <div style={{ fontWeight: '600', color: '#0369a1' }}>
                            {stats.sent_count || 0}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Falhas:</span>
                          <div style={{ fontWeight: '600', color: '#dc2626' }}>
                            {stats.failed_count || 0}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {campaign.status === 'draft' && (
                        <button
                          onClick={() => handleStartCampaign(campaign.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            backgroundColor: '#10b981',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          title="Iniciar Disparo Pausado (10 min)"
                        >
                          <Send size={16} color="white" />
                        </button>
                      )}

                      {campaign.status === 'paused' && !campaignStats[campaign.id]?.is_completed && campaignStats[campaign.id]?.campaign_status !== 'completed' && (
                        <button
                          onClick={() => handleResumeCampaign(campaign.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            backgroundColor: '#10b981',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          title="Retomar Disparo"
                        >
                          <Play size={16} color="white" />
                        </button>
                      )}

                      {campaign.status === 'dispatching' && !campaignStats[campaign.id]?.is_completed && campaignStats[campaign.id]?.campaign_status !== 'completed' && (
                        <button
                          onClick={() => handlePauseCampaign(campaign.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            backgroundColor: '#f59e0b',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          title="Pausar Disparo"
                        >
                          <Pause size={16} color="white" />
                        </button>
                      )}


                      <button
                        onClick={() => handleViewCampaign(campaign)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '36px',
                          height: '36px',
                          backgroundColor: 'transparent',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        title="Ver Detalhes"
                      >
                        <Eye size={16} color="#6b7280" />
                      </button>

                      <button
                        onClick={() => handleEditCampaign(campaign)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '36px',
                          height: '36px',
                          backgroundColor: 'transparent',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        title="Editar Campanha"
                      >
                        <Edit size={16} color="#6b7280" />
                      </button>

                      <button
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '36px',
                          height: '36px',
                          backgroundColor: 'transparent',
                          border: '1px solid #ef4444',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        title="Deletar Campanha"
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={(e) => handleModalBackdropClick(e, () => {
            setShowCreateModal(false)
            setEditingCampaign(null)
            setNewCampaign({
              name: '',
              message_base: '',
              tone: 'profissional',
              daily_limit: 30,
              image_file: null,
              image_preview: null
            })
          })}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '1.5rem'
            }}>
              {editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}
            </h2>

            <form onSubmit={handleCreateCampaign}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Nome da Campanha *
                </label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Promoção Black Friday 2024"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Tom da Mensagem *
                </label>
                <select
                  value={newCampaign.tone}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, tone: e.target.value }))}
                  disabled={editingCampaign}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none',
                    backgroundColor: editingCampaign ? '#f9fafb' : 'white',
                    cursor: editingCampaign ? 'not-allowed' : 'pointer'
                  }}
                >
                  {toneOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Mensagem Base *
                </label>
                <textarea
                  value={newCampaign.message_base}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, message_base: e.target.value }))}
                  placeholder="Olá {nome}! Temos uma novidade especial para você..."
                  required
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
                <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  Use {'{nome}'} para personalizar com o nome do cliente
                </small>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Imagem da Campanha (Opcional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('Imagem deve ter no máximo 5MB')
                        e.target.value = ''
                        return
                      }
                      setNewCampaign(prev => ({ 
                        ...prev, 
                        image_file: file,
                        image_preview: URL.createObjectURL(file)
                      }))
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                />
                <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  Formatos aceitos: JPG, PNG, GIF (máximo 5MB)
                </small>
                {newCampaign.image_file && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f0f9ff', borderRadius: '6px' }}>
                    <small style={{ color: '#0369a1' }}>
                      ✓ Imagem selecionada: {newCampaign.image_file.name}
                    </small>
                  </div>
                )}
                
                {/* Pré-visualização da imagem */}
                {(newCampaign.image_preview || (editingCampaign && editingCampaign.image_base64)) && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', display: 'block' }}>
                      Pré-visualização da Imagem
                    </label>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', maxWidth: '300px' }}>
                      <img 
                        src={newCampaign.image_preview || `data:image/jpeg;base64,${editingCampaign.image_base64}`}
                        alt="Pré-visualização da imagem"
                        style={{ width: '100%', height: 'auto', maxHeight: '200px', objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Limite Diário
                </label>
                <input
                  type="number"
                  value={30}
                  disabled
                  min="1"
                  max="100"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                />
                <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  Máximo de mensagens por dia (1-100)
                </small>
              </div>

              {editingCampaign && (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#fef3c7', 
                  borderRadius: '8px', 
                  border: '1px solid #f59e0b',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
                    <strong style={{ color: '#92400e', fontSize: '0.875rem' }}>Modo de Edição</strong>
                  </div>
                  <p style={{ color: '#92400e', fontSize: '0.75rem', margin: 0 }}>
                    Apenas o nome, mensagem base e imagem podem ser editados. Tom, limite diário e clientes não podem ser alterados.
                  </p>
                </div>
              )}

              {!editingCampaign && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Clientes da Campanha ({selectedCampaignCustomers.length}/30)
                  </label>
                  
                  <div style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '0.5rem'
                  }}>
                    {campaignCustomers.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                        Carregando clientes disponíveis...
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {campaignCustomers.map((customer) => (
                          <label
                            key={customer.customer_id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              backgroundColor: selectedCampaignCustomers.find(c => c.customer_id === customer.customer_id) ? '#f0f9ff' : 'transparent',
                              cursor: 'pointer'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCampaignCustomers.find(c => c.customer_id === customer.customer_id) ? true : false}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  if (selectedCampaignCustomers.length >= 30) {
                                    toast('⚠️ Máximo de 30 clientes por campanha', { 
                                      icon: '⚠️',
                                      duration: 3000 
                                    })
                                    return
                                  }
                                  setSelectedCampaignCustomers(prev => [...prev, customer])
                                } else {
                                  setSelectedCampaignCustomers(prev => prev.filter(c => c.customer_id !== customer.customer_id))
                                }
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>
                                {customer.customer_name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {customer.remotejid}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const firstThirty = campaignCustomers.slice(0, 30)
                        setSelectedCampaignCustomers(firstThirty)
                      }}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Selecionar Primeiros 30
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCampaignCustomers([])}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Limpar Seleção
                    </button>
                  </div>
                  
                  <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    Selecione até 30 clientes para esta campanha. Estes clientes ficarão exclusivos desta campanha.
                  </small>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingCampaign(null)
                    setNewCampaign({
                      name: '',
                      message_base: '',
                      tone: 'profissional',
                      daily_limit: 30,
                      image_file: null,
                      image_preview: null
                    })
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'transparent',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? (editingCampaign ? 'Atualizando...' : 'Criando...') : (editingCampaign ? 'Atualizar Campanha' : 'Criar Campanha')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Clientes */}
      {showCustomerSelection && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={(e) => handleModalBackdropClick(e, () => setShowCustomerSelection(false))}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#1e293b'
              }}>
                Selecionar Clientes para Disparo
              </h2>
              <button
                onClick={() => setShowCustomerSelection(false)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{
              backgroundColor: '#f8fafc',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <p style={{ margin: 0, color: '#64748b' }}>
                <strong>{selectedCustomers.length}</strong> de <strong>{availableCustomers.length}</strong> clientes selecionados
                (máximo 30 por disparo)
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <button
                onClick={() => setSelectedCustomers(availableCustomers.slice(0, 30))}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Selecionar Todos (30)
              </button>
              <button
                onClick={() => setSelectedCustomers([])}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Limpar Seleção
              </button>
            </div>

            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}>
              {availableCustomers.map((customer, index) => {
                const isSelected = selectedCustomers.find(c => c.customer_id === customer.customer_id)
                return (
                  <div
                    key={customer.customer_id}
                    onClick={() => toggleCustomerSelection(customer)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1rem',
                      borderBottom: index < availableCustomers.length - 1 ? '1px solid #e5e7eb' : 'none',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#f3f0ff' : 'white'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => {}}
                      style={{
                        marginRight: '0.75rem',
                        width: '16px',
                        height: '16px'
                      }}
                    />
                    <div>
                      <div style={{
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        {customer.customer_name}
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#64748b'
                      }}>
                        {customer.remotejid}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              marginTop: '1.5rem'
            }}>
              <button
                onClick={() => setShowCustomerSelection(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDisparo}
                disabled={selectedCustomers.length === 0}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: selectedCustomers.length > 0 ? '#10b981' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedCustomers.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                Confirmar Disparo ({selectedCustomers.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Campaign Modal */}
      {showViewModal && selectedCampaign && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={(e) => handleModalBackdropClick(e, () => setShowViewModal(false))}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0
              }}>
                Detalhes da Campanha
              </h2>
              <button
                onClick={() => setShowViewModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', display: 'block' }}>
                  Nome da Campanha
                </label>
                <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  {selectedCampaign.name}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', display: 'block' }}>
                  Mensagem Base
                </label>
                <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', minHeight: '100px' }}>
                  {selectedCampaign.message_base || 'Nenhuma mensagem definida'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', display: 'block' }}>
                    Tom
                  </label>
                  <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    {toneOptions.find(t => t.value === selectedCampaign.tone)?.label || selectedCampaign.tone}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', display: 'block' }}>
                    Status
                  </label>
                  <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: getStatusColor(selectedCampaign.status).bg,
                      color: getStatusColor(selectedCampaign.status).text,
                      border: `1px solid ${getStatusColor(selectedCampaign.status).border}`
                    }}>
                      {translateStatus(selectedCampaign.status)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedCampaign.image_base64 && (
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', display: 'block' }}>
                    Imagem da Campanha
                  </label>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                    <img 
                      src={`data:image/jpeg;base64,${selectedCampaign.image_base64}`}
                      alt="Imagem da campanha"
                      style={{ width: '100%', height: 'auto', maxHeight: '300px', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '1rem', display: 'block' }}>
                  Estatísticas da Campanha
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0369a1' }}>
                      {campaignStats[selectedCampaign.id]?.sent_count || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Enviadas</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#d97706' }}>
                      {campaignStats[selectedCampaign.id]?.pending_count || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Pendentes</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
                      {campaignStats[selectedCampaign.id]?.failed_count || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Falhas</div>
                  </div>
                </div>
              </div>

              {/* Lista de Clientes da Campanha */}
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '1rem', display: 'block' }}>
                  Clientes da Campanha ({selectedCampaign.customers?.length || 0})
                </label>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  backgroundColor: '#f9fafb'
                }}>
                  {selectedCampaign.customers && selectedCampaign.customers.length > 0 ? (
                    selectedCampaign.customers.map((customer, index) => (
                      <div key={customer.customer_id} style={{
                        padding: '0.75rem 1rem',
                        borderBottom: index < selectedCampaign.customers.length - 1 ? '1px solid #e5e7eb' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.875rem' }}>
                            {customer.customer_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {customer.remotejid}
                          </div>
                          {customer.sent_at && (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              Enviado: {new Date(customer.sent_at).toLocaleString('pt-BR')}
                            </div>
                          )}
                          {customer.error_message && (
                            <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>
                              Erro: {customer.error_message}
                            </div>
                          )}
                        </div>
                        <div>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: customer.status === 'sent' ? '#dcfce7' : 
                                           customer.status === 'pending' ? '#fef3c7' : 
                                           customer.status === 'failed' ? '#fee2e2' : '#f3f4f6',
                            color: customer.status === 'sent' ? '#166534' : 
                                   customer.status === 'pending' ? '#92400e' : 
                                   customer.status === 'failed' ? '#991b1b' : '#374151'
                          }}>
                            {customer.status === 'sent' ? 'Enviado' :
                             customer.status === 'pending' ? 'Pendente' :
                             customer.status === 'failed' ? 'Falha' :
                             customer.status === 'scheduled' ? 'Agendado' : customer.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ 
                      padding: '2rem', 
                      textAlign: 'center', 
                      color: '#6b7280',
                      fontSize: '0.875rem'
                    }}>
                      Nenhum cliente encontrado para esta campanha
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button
                onClick={() => setShowViewModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false)
                  handleEditCampaign(selectedCampaign)
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Editar Campanha
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Painel de Controle do Disparo Pausado */}
      {showTimedDispatchPanel && timedDispatchStatus && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={(e) => handleModalBackdropClick(e, () => setShowTimedDispatchPanel(false))}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                🕐 Controle do Disparo Pausado
              </h2>
              <button
                onClick={() => setShowTimedDispatchPanel(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                Progresso do Disparo
              </h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {timedDispatchStatus.progress.sent} de {timedDispatchStatus.progress.total} enviadas
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                    {timedDispatchStatus.progress.percentage}%
                  </span>
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '8px', 
                  backgroundColor: '#e5e7eb', 
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${timedDispatchStatus.progress.percentage}%`,
                    height: '100%',
                    backgroundColor: '#8b5cf6',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Informações da Campanha */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.75rem' }}>
                  📋 Detalhes da Campanha
                </h4>
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Nome: </span>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{selectedCampaign?.name}</span>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Mensagem: </span>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{selectedCampaign?.message_base}</span>
                </div>
                
                {/* Pré-visualização da Imagem */}
                {selectedCampaign?.image_base64 && (
                  <div style={{ marginTop: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
                      🖼️ Imagem da Campanha:
                    </span>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', maxWidth: '200px' }}>
                      <img 
                        src={`data:image/jpeg;base64,${selectedCampaign.image_base64}`}
                        alt="Imagem da campanha"
                        style={{ width: '100%', height: 'auto', maxHeight: '150px', objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0369a1' }}>
                    {timedDispatchStatus.progress.sent}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: '500' }}>
                    Enviadas
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#d97706' }}>
                    {timedDispatchStatus.progress.pending}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: '500' }}>
                    Pendentes
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
                    {timedDispatchStatus.progress.failed}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '500' }}>
                    Falhas
                  </div>
                </div>
              </div>

              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#f9fafb', 
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  <strong>Status:</strong> {translateStatus(timedDispatchStatus.campaign.status)}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  <strong>Intervalo:</strong> 10 minutos entre cada envio
                </div>
              </div>
            </div>

            {/* Lista de Clientes da Campanha Ativa */}
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '1rem', display: 'block' }}>
                Clientes da Campanha ({timedDispatchStatus.customers?.length || 0})
              </label>
              <div style={{ 
                maxHeight: '200px', 
                overflowY: 'auto', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px',
                backgroundColor: '#f9fafb'
              }}>
                {timedDispatchStatus.customers && timedDispatchStatus.customers.length > 0 ? (
                  timedDispatchStatus.customers.map((customer, index) => (
                    <div key={customer.customer_id} style={{
                      padding: '0.75rem 1rem',
                      borderBottom: index < timedDispatchStatus.customers.length - 1 ? '1px solid #e5e7eb' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.875rem' }}>
                          {customer.customer_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {customer.remotejid}
                        </div>
                        {customer.sent_at && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            Enviado: {new Date(customer.sent_at).toLocaleString('pt-BR')}
                          </div>
                        )}
                        {customer.error_message && (
                          <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>
                            Erro: {customer.error_message}
                          </div>
                        )}
                      </div>
                      <div>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: customer.status === 'sent' ? '#dcfce7' : 
                                         customer.status === 'pending' ? '#fef3c7' : 
                                         customer.status === 'failed' ? '#fee2e2' : '#f3f4f6',
                          color: customer.status === 'sent' ? '#166534' : 
                                 customer.status === 'pending' ? '#92400e' : 
                                 customer.status === 'failed' ? '#991b1b' : '#374151'
                        }}>
                          {customer.status === 'sent' ? 'Enviado' :
                           customer.status === 'pending' ? 'Pendente' :
                           customer.status === 'failed' ? 'Falha' :
                           customer.status === 'scheduled' ? 'Agendado' : customer.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ 
                    padding: '2rem', 
                    textAlign: 'center', 
                    color: '#6b7280',
                    fontSize: '0.875rem'
                  }}>
                    Nenhum cliente encontrado para esta campanha
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
              {timedDispatchStatus.campaign.status === 'dispatching' && timedDispatchStatus.progress.sent < 30 && (
                <button
                  onClick={() => handlePauseTimedDispatch(timedDispatchStatus.campaign.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  <Pause size={16} />
                  Pausar Disparo
                </button>
              )}
              
              {timedDispatchStatus.campaign.status === 'paused' && timedDispatchStatus.progress.sent < 30 && (
                <button
                  onClick={() => handleResumeTimedDispatch(timedDispatchStatus.campaign.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  <Play size={16} />
                  Retomar Disparo
                </button>
              )}
              
              {timedDispatchStatus.progress.sent >= 30 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  ✅ Campanha Concluída (30 envios)
                </div>
              )}
              
              <button
                onClick={() => loadTimedDispatchStatus(timedDispatchStatus.campaign.id)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                🔄 Atualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Disparador
