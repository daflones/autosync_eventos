import axios from 'axios'
import { supabase, uploadImage, fileToBase64, validateFile } from './supabase'
import toast from 'react-hot-toast'

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL

export const sendMessageWithImage = async (messageData, files = []) => {
  try {
    // Se não há arquivos, enviar apenas mensagem de texto
    if (!files || files.length === 0) {
      const payload = {
        customer_id: messageData.customer_id,
        remotejid: messageData.remotejid,
        name: messageData.name,
        message: messageData.message,
        ticket_id: messageData.ticket_id
      }
      
      const response = await axios.post(N8N_WEBHOOK_URL, payload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // Atualizar status no banco
      await supabase
        .from('messages')
        .update({ 
          sent_status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', messageData.message_id)
      
      // Marcar ticket como mensagem enviada
      await supabase
        .from('tickets')
        .update({ 
          message_sent: true,
          message_sent_at: new Date().toISOString(),
          delivery_status: 'delivered'
        })
        .eq('id', messageData.ticket_id)
      
      return response.data
    }
    
    // Se há arquivos, processar e enviar sequencialmente
    const imageUrls = []
    const imageFilenames = []
    const imageSizes = []
    let responses = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // 1. Validar arquivo
      validateFile(file)
      
      // 2. Upload para Supabase Storage
      const { data: uploadData, error: uploadError } = await uploadImage(file, `${messageData.message_id}_${i}`)
      if (uploadError) throw uploadError
      
      // 3. Converter para base64
      const base64 = await fileToBase64(file)
      
      // 4. Preparar payload para esta imagem
      const payload = {
        customer_id: messageData.customer_id,
        remotejid: messageData.remotejid,
        name: messageData.name,
        message: i === 0 ? messageData.message : '', // Apenas primeira imagem tem mensagem
        ticket_id: messageData.ticket_id,
        image_base64: base64,
        image_filename: file.name
      }
      
      // 5. Enviar esta imagem para N8N
      const response = await axios.post(N8N_WEBHOOK_URL, payload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      responses.push(response.data)
      
      // 6. Coletar dados para salvar no banco
      imageUrls.push(uploadData.path)
      imageFilenames.push(file.name)
      imageSizes.push(file.size)
      
      // 7. Aguardar um pouco entre envios para evitar spam
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 segundo entre envios
      }
    }
    
    // 8. Salvar URLs consolidadas no banco
    await supabase
      .from('messages')
      .update({ 
        image_url: imageUrls.join(','),
        image_filename: imageFilenames.join(','),
        image_size: imageSizes.reduce((sum, size) => sum + size, 0),
        sent_status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', messageData.message_id)
    
    // 9. Marcar ticket específico como mensagem enviada e atualizar delivery_status
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
    
    return responses
    
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
