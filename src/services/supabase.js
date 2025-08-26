import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Image upload helper
export const uploadImage = async (file, messageId) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${messageId}.${fileExt}`
  const filePath = `messages/${fileName}`
  
  const { data, error } = await supabase.storage
    .from('message-images')
    .upload(filePath, file)
    
  return { data, error, filePath }
}

// File to base64 conversion
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = error => reject(error)
  })
}

// File validation
export const validateFile = (file) => {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg']
  const maxSize = 5 * 1024 * 1024 // 5MB
  
  if (!validTypes.includes(file.type)) {
    throw new Error('Formato não suportado. Use PNG, JPG ou JPEG')
  }
  
  if (file.size > maxSize) {
    throw new Error('Arquivo muito grande. Máximo 5MB')
  }
  
  return true
}
