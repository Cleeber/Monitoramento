import { supabase } from '../lib/supabase.js'
import { v4 as uuidv4 } from 'uuid'

export class StorageService {
  private readonly BUCKET_NAME = 'logos'
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  private readonly ALLOWED_MIME_TYPES = [
    'image/png',
    'image/jpeg', 
    'image/jpg',
    'image/svg+xml'
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
        error: 'Formato de arquivo não suportado. Formatos aceitos: PNG, JPG, JPEG, SVG'
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
    const { data, error } = await supabase.storage
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
   * Extrai a extensão do arquivo
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.')
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : ''
  }

  /**
   * Extrai o caminho do arquivo a partir da URL
   */
  extractFilePathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')
      const bucketIndex = pathParts.findIndex(part => part === this.BUCKET_NAME)
      
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/')
      }
      
      return null
    } catch {
      return null
    }
  }
}

export const storageService = new StorageService()