import { supabase } from '../lib/supabase.js'
import { v4 as uuidv4 } from 'uuid'

export class StorageService {
  private readonly BUCKET_NAME = 'logos'
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  private readonly ALLOWED_MIME_TYPES = [
    'image/png',
    'image/jpeg', 
    'image/jpg',
    'image/svg+xml',
    // Adicionado para suportar logos em WEBP
    'image/webp'
  ]

  /**
   * Valida se o arquivo atende aos critérios de formato e tamanho
   */
  validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    // Verificar tamanho do arquivo
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `Arquivo muito grande. Tamanho máximo permitido: ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`
      }
    }

    // Verificar tipo MIME
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return {
        valid: false,
        error: 'Formato de arquivo não suportado. Formatos aceitos: PNG, JPG, JPEG, SVG, WEBP'
      }
    }

    return { valid: true }
  }

  /**
   * Faz upload do arquivo para o Supabase Storage
   */
  async uploadLogo(file: Express.Multer.File): Promise<{ url: string; path: string }> {
    // Validar arquivo
    const validation = this.validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Gerar nome único para o arquivo
    const fileExtension = this.getFileExtension(file.originalname)
    const fileName = `${uuidv4()}${fileExtension}`
    const filePath = `monitors/${fileName}`

    // Fazer upload para o Supabase Storage
    const { error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      })

    if (error) {
      throw new Error(`Erro ao fazer upload do arquivo: ${error.message}`)
    }

    // Obter URL pública do arquivo
    const { data: urlData } = supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(filePath)

    return {
      url: urlData.publicUrl,
      path: filePath
    }
  }

  /**
   * Remove um arquivo do storage
   */
  async deleteLogo(filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .remove([filePath])

    if (error) {
      throw new Error(`Erro ao deletar arquivo: ${error.message}`)
    }
  }

  /**
   * Garante que o bucket de logos exista e esteja público.
   * Evita erros 500 em ambientes onde o bucket ainda não foi criado.
   */
  async ensureBucketExists(): Promise<void> {
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()
      if (listError) {
        console.warn('Não foi possível listar buckets do Supabase Storage:', listError.message)
        return
      }

      const exists = (buckets || []).some(b => b.name === this.BUCKET_NAME)
      if (!exists) {
        const { error: createError } = await supabase.storage.createBucket(this.BUCKET_NAME, {
          public: true,
          // Limite de tamanho coerente com validação local
          fileSizeLimit: `${this.MAX_FILE_SIZE}`,
        })
        if (createError) {
          console.warn(`Falha ao criar bucket ${this.BUCKET_NAME}:`, createError.message)
        } else {
          console.log(`✅ Bucket '${this.BUCKET_NAME}' criado no Supabase Storage`)
        }
      }
    } catch (e) {
      console.warn('Não foi possível garantir a existência do bucket de logos:', e)
    }
  }

  // ===== Helpers =====
  private getFileExtension(filename: string): string {
    const dotIndex = filename.lastIndexOf('.')
    return dotIndex !== -1 ? filename.slice(dotIndex) : ''
  }
}

// Mantém export existente
export const storageService = new StorageService()