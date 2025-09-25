// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface SendRecord {
  id: string;
  customer_id: string;
  customer_name: string;
  remotejid: string;
  message_content: string;
  campaign_id: string;
  disparador_campaigns: {
    image_base64?: string;
  };
}

interface WebhookPayload {
  customer_id: string;
  remotejid: string;
  name: string;
  message: string;
  image_base64: string | null;
  has_image: boolean;
  send_id: string;
  campaign_id: string;
}

console.info('🚀 Campaign processor started');

// Função para validar e corrigir remotejid
function validateAndFixRemotejid(remotejid: string): string {
  if (!remotejid || remotejid === 'null' || remotejid === '') {
    return remotejid;
  }

  // Se já contém @, é um remotejid válido
  if (remotejid.includes('@')) {
    // Apenas números @s.whatsapp.net devem ter o código 55
    if (remotejid.includes('@s.whatsapp.net')) {
      const numberPart = remotejid.split('@')[0];
      
      // Se não começa com 55, adicionar (apenas para WhatsApp normal)
      if (!numberPart.startsWith('55')) {
        return `55${numberPart}@s.whatsapp.net`;
      }
    }
    // @lid não deve ter 55 adicionado, retornar como está
    return remotejid;
  }

  // Se é apenas número, formatar como remotejid
  const cleanNumber = remotejid.replace(/[^0-9]/g, '');
  
  if (cleanNumber.length === 11) {
    // Número brasileiro sem código do país
    return `55${cleanNumber}@s.whatsapp.net`;
  } else if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
    // Número brasileiro com código do país
    return `${cleanNumber}@s.whatsapp.net`;
  } else if (cleanNumber.length === 15) {
    // Número internacional - não adicionar 55
    return `${cleanNumber}@lid`;
  }

  // Retornar como está se não conseguir processar
  return remotejid;
}

Deno.serve(async (req: Request) => {
  try {
    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookUrl = Deno.env.get('WEBHOOK_URL')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Buscando campanhas ativas...');

    // Buscar campanhas com status 'dispatching'
    const { data: activeCampaigns, error: campaignsError } = await supabase
      .from('disparador_campaigns')
      .select('id, name')
      .eq('status', 'dispatching');

    if (campaignsError) {
      throw new Error(`Erro ao buscar campanhas: ${campaignsError.message}`);
    }

    if (!activeCampaigns || activeCampaigns.length === 0) {
      console.log('📭 Nenhuma campanha ativa encontrada');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma campanha ativa encontrada',
          processed: 0 
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    let totalProcessed = 0;

    // Processar cada campanha ativa
    for (const campaign of activeCampaigns) {
      console.log(`📋 Processando campanha: ${campaign.name} (${campaign.id})`);

      // Buscar próximo envio pendente
      const { data: nextSends, error: sendsError } = await supabase
        .from('disparador_sends')
        .select(`
          id,
          customer_id,
          customer_name,
          remotejid,
          message_content,
          campaign_id,
          disparador_campaigns!inner(image_base64)
        `)
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

      if (sendsError) {
        console.error(`❌ Erro ao buscar envios para campanha ${campaign.id}:`, sendsError);
        continue;
      }

      let nextSend: SendRecord | null = null;

      if (nextSends && nextSends.length > 0) {
        nextSend = nextSends[0] as SendRecord;
        console.log(`📤 Processando envio pendente: ${nextSend.customer_name}`);
      } else {
        // Se não há pendentes, verificar falhas para retry
        const { data: failedSends, error: failedError } = await supabase
          .from('disparador_sends')
          .select(`
            id,
            customer_id,
            customer_name,
            remotejid,
            message_content,
            campaign_id,
            disparador_campaigns!inner(image_base64)
          `)
          .eq('campaign_id', campaign.id)
          .eq('status', 'failed')
          .order('sent_at', { ascending: true })
          .limit(1);

        if (!failedError && failedSends && failedSends.length > 0) {
          nextSend = failedSends[0] as SendRecord;
          console.log(`🔄 Reprocessando cliente com falha: ${nextSend.customer_name}`);
          
          // Atualizar status para pending
          await supabase
            .from('disparador_sends')
            .update({ 
              status: 'pending',
              error_message: null
            })
            .eq('id', nextSend.id);
        }
      }

      if (!nextSend) {
        console.log(`📭 Nenhum envio para processar na campanha ${campaign.id}`);
        
        // Verificar se campanha deve ser finalizada
        await checkCampaignCompletion(supabase, campaign.id);
        continue;
      }

      // Processar o envio
      try {
        const validRemotejid = validateAndFixRemotejid(nextSend.remotejid);
        const hasImage = !!(nextSend.disparador_campaigns.image_base64);
        
        const payload: WebhookPayload = {
          customer_id: nextSend.customer_id,
          remotejid: validRemotejid,
          name: nextSend.customer_name,
          message: nextSend.message_content,
          image_base64: nextSend.disparador_campaigns.image_base64 || null,
          has_image: hasImage,
          send_id: nextSend.id,
          campaign_id: nextSend.campaign_id
        };

        console.log(`🚀 Enviando webhook: ${payload.name}`);
        console.log(`🖼️ Has image: ${hasImage}`);

        // Enviar webhook
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          console.log(`✅ Webhook enviado com sucesso: ${response.status}`);
          
          // Atualizar status para sent
          await supabase
            .from('disparador_sends')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', nextSend.id);

          // Registrar no histórico
          await supabase
            .from('disparador_customer_history')
            .insert({
              customer_id: nextSend.customer_id,
              campaign_id: nextSend.campaign_id,
              sent_at: new Date().toISOString(),
              message_content: nextSend.message_content,
              status: 'sent',
              next_eligible_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            });

          totalProcessed++;
        } else {
          throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }

      } catch (error) {
        console.error(`❌ Erro ao processar envio:`, error);
        
        // Marcar como falha
        await supabase
          .from('disparador_sends')
          .update({ 
            status: 'failed',
            sent_at: new Date().toISOString(),
            error_message: error.message
          })
          .eq('id', nextSend.id);

        // Registrar falha no histórico
        await supabase
          .from('disparador_customer_history')
          .insert({
            customer_id: nextSend.customer_id,
            campaign_id: nextSend.campaign_id,
            sent_at: new Date().toISOString(),
            message_content: nextSend.message_content,
            status: 'failed',
            error_message: error.message,
            next_eligible_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });
      }

      // Atualizar estatísticas da campanha
      await updateCampaignStats(supabase, nextSend.campaign_id);
    }

    console.log(`🎯 Processamento concluído. Total processado: ${totalProcessed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processamento concluído`,
        campaigns_processed: activeCampaigns.length,
        sends_processed: totalProcessed
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro no processamento:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Função para verificar se campanha deve ser finalizada
async function checkCampaignCompletion(supabase: any, campaignId: string) {
  try {
    // Verificar envios pendentes e com falha
    const { data: pendingSends } = await supabase
      .from('disparador_sends')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    const { data: failedSends } = await supabase
      .from('disparador_sends')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('status', 'failed');

    // Verificar taxa de sucesso
    const { data: allSends } = await supabase
      .from('disparador_sends')
      .select('status')
      .eq('campaign_id', campaignId);

    const totalSends = allSends?.length || 0;
    const sentSends = allSends?.filter((s: any) => s.status === 'sent').length || 0;
    const successRate = totalSends > 0 ? Math.round((sentSends / totalSends) * 100) : 0;

    const hasPending = pendingSends && pendingSends.length > 0;
    const hasFailed = failedSends && failedSends.length > 0;

    console.log(`📊 Taxa de sucesso: ${successRate}% (${sentSends}/${totalSends})`);

    // Finalizar se não há pendentes/falhas OU se atingiu 100% de sucesso
    const shouldFinish = (!hasPending && !hasFailed) || (successRate === 100 && totalSends > 0);

    if (shouldFinish) {
      if (successRate === 100) {
        console.log(`🎯 Campanha finalizada - 100% de sucesso: ${campaignId}`);
      } else {
        console.log(`🏁 Campanha finalizada (sem pendentes nem falhas): ${campaignId}`);
      }

      // Atualizar status para dispatched
      await supabase
        .from('disparador_campaigns')
        .update({ status: 'dispatched' })
        .eq('id', campaignId);
    }
  } catch (error) {
    console.error('Erro ao verificar finalização da campanha:', error);
  }
}

// Função para atualizar estatísticas da campanha
async function updateCampaignStats(supabase: any, campaignId: string) {
  try {
    const { data: stats } = await supabase
      .from('disparador_sends')
      .select('status')
      .eq('campaign_id', campaignId);

    const sentCount = stats?.length || 0;
    const successCount = stats?.filter((s: any) => s.status === 'sent').length || 0;
    const failedCount = stats?.filter((s: any) => s.status === 'failed').length || 0;

    await supabase
      .from('disparador_campaigns')
      .update({
        sent_count: sentCount,
        success_count: successCount,
        failed_count: failedCount
      })
      .eq('id', campaignId);

  } catch (error) {
    console.error('Erro ao atualizar estatísticas:', error);
  }
}
