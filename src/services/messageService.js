import axios from 'axios'
import { supabase, uploadImage, fileToBase64, validateFile } from './supabase'
import toast from 'react-hot-toast'

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL

export const sendMessageWithImage = async (messageData, file = null) => {
  try {
    let payload = {
      customer_id: messageData.customer_id,
      phone: `${messageData.phone}@s.whatsapp.net`,
      name: messageData.name,
      message: messageData.message,
      ticket_id: messageData.ticket_id
    }
    
    // Se há arquivo, processar imagem
    if (file) {
      // 1. Validar arquivo
      validateFile(file)
      
      // 2. Upload para Supabase Storage
      const { data: uploadData, error: uploadError } = await uploadImage(file, messageData.message_id)
      if (uploadError) throw uploadError
      
      // 3. Converter para base64
      const base64 = await fileToBase64(file)
      
      // 4. Adicionar ao payload
      payload.image_base64 = base64
      payload.image_filename = file.name
      
      // 5. Salvar URL no banco
      await supabase
        .from('messages')
        .update({ 
          image_url: uploadData.path,
          image_filename: file.name,
          image_size: file.size 
        })
        .eq('id', messageData.message_id)
    }
    
    // 6. Enviar para N8N
    const response = await axios.post(N8N_WEBHOOK_URL, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    // 7. Atualizar status no banco
    await supabase
      .from('messages')
      .update({ 
        sent_status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', messageData.message_id)
    
    // 8. Marcar ticket específico como mensagem enviada e atualizar delivery_status
    console.log('Atualizando ticket ID:', messageData.ticket_id)
    const { error: ticketUpdateError } = await supabase
      .from('tickets')
      .update({ 
        message_sent: true,
        message_sent_at: new Date().toISOString(),
        delivery_status: 'delivered'
      })
      .eq('id', messageData.ticket_id)
    
    if (ticketUpdateError) {
      console.error('Erro ao atualizar ticket:', ticketUpdateError)
      throw ticketUpdateError
    }
    
    return response.data
    
  } catch (error) {
    // Atualizar status de erro
    await supabase
      .from('messages')
      .update({ sent_status: 'failed' })
      .eq('id', messageData.message_id)
    
    throw error
  }
}

export const createMessageRecord = async (customerData, ticketData, messageContent) => {
  const { data: messageRecord, error } = await supabase
    .from('messages')
    .insert({
      customer_id: customerData.id,
      ticket_id: ticketData.id,
      message_content: messageContent,
      sent_status: 'pending'
    })
    .select()
    .single()

  if (error) throw error
  return messageRecord
}
