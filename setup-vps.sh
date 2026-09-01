#!/bin/bash

# 🚀 Script de Configuração Inicial para VPS - Uptime Monitor
# Execute este script na VPS para preparar o ambiente para deploy automático
# após a unificação da estrutura (monorepo com Docker único na porta 8081).

set -e

echo "🚀 Configurando VPS para Deploy Automático..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se está rodando como root ou com sudo
if [[ $EUID -eq 0 ]]; then
    print_warning "Rodando como root. Recomendado usar usuário normal com sudo."
fi

# 1. Atualizar sistema
print_status "Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependências básicas
print_status "Instalando dependências básicas..."
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# 3. Instalar Docker se não estiver instalado
if ! command -v docker &> /dev/null; then
    print_status "Instalando Docker..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io

    # Adicionar usuário ao grupo docker
    sudo usermod -aG docker $USER
    print_success "Docker instalado com sucesso!"
else
    print_success "Docker já está instalado."
fi

# 4. Instalar Docker Compose se não estiver instalado
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_status "Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose instalado com sucesso!"
else
    print_success "Docker Compose já está instalado."
fi

# 5. Instalar Node.js se não estiver instalado
if ! command -v node &> /dev/null; then
    print_status "Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    print_success "Node.js instalado com sucesso!"
else
    print_success "Node.js já está instalado."
fi

# 6. Configurar SSH para GitHub Actions
print_status "Configurando SSH para GitHub Actions..."

# Criar diretório .ssh se não existir
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Verificar se já existe chave SSH
if [ ! -f ~/.ssh/id_rsa ]; then
    print_status "Gerando nova chave SSH..."
    ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/id_rsa -N ""
    print_success "Chave SSH gerada!"
else
    print_success "Chave SSH já existe."
fi

# Adicionar chave pública ao authorized_keys
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 7. Configurar Git (se necessário)
print_status "Configurando Git..."
if [ -z "$(git config --global user.name)" ]; then
    read -p "Digite seu nome para o Git: " git_name
    git config --global user.name "$git_name"
fi

if [ -z "$(git config --global user.email)" ]; then
    read -p "Digite seu email para o Git: " git_email
    git config --global user.email "$git_email"
fi

# 8. Criar diretório do projeto se não existir
read -p "Digite o caminho onde o projeto será clonado (ex: /home/usuario/uptime-monitor): " project_path

if [ ! -d "$project_path" ]; then
    print_status "Criando diretório do projeto..."
    mkdir -p "$project_path"
    print_success "Diretório criado: $project_path"
fi

# 9. Clonar repositório se não existir
if [ ! -d "$project_path/.git" ]; then
    read -p "Digite a URL do repositório Git (ex: https://github.com/usuario/repo.git): " repo_url
    print_status "Clonando repositório..."
    git clone "$repo_url" "$project_path"
    print_success "Repositório clonado!"
fi

# 10. Configurar firewall básico
print_status "Configurando firewall..."
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
print_success "Firewall configurado!"

# Detectar IP público para conveniencia
ip_publico=$(curl -s ifconfig.me 2>/dev/null || echo "(não detectado)")

# 11. Exibir informações importantes
echo ""
echo "🎉 Configuração concluída com sucesso!"
echo ""
echo "=================================================="
echo "  Próximos passos — configurar GitHub Secrets"
echo "=================================================="
echo ""
echo "1. Copie a chave privada SSH abaixo e adicione no GitHub como"
echo "   secret SSH_PRIVATE_KEY (Settings → Secrets and variables → Actions):"
echo ""
echo "----- BEGIN SSH PRIVATE KEY -----"
cat ~/.ssh/id_rsa
echo "----- END SSH PRIVATE KEY -----"
echo ""
echo "2. Adicione também os secrets:"
echo "   SSH_HOST       = $ip_publico"
echo "   SSH_USERNAME   = $(whoami)"
echo "   SSH_PORT       = 22"
echo "   PROJECT_PATH   = $project_path"
echo ""
echo "3. Suba o subdomínio nginx para a porta 8081 do app (após o primeiro deploy):"
echo "   sudo bash $project_path/nginx_update.txt"
echo ""
echo "4. Crie o .env no servidor (não vai para o git):"
echo "   cp $project_path/.env.example $project_path/.env"
echo "   nano $project_path/.env   # preencher SUPABASE_*, JWT_SECRET, SMTP_*"
echo ""
echo "5. Suba o container (app unificado serve API + SPA na porta 8081):"
echo "   cd $project_path"
echo "   docker compose up -d --build"
echo ""
echo "A aplicação ficará disponível em http://localhost:8081 (app) e exposta"
echo "publicamente via nginx no subdomínio configurado (ex: monitor.exemplo.com.br)."
echo ""
