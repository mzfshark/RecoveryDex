#!/bin/bash

# RecoverySwap Documentation Deploy Script
# Este script automatiza o processo de deploy da documentação

set -e

echo "🚀 RecoverySwap Documentation Deploy"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script a partir da pasta raiz do projeto"
    exit 1
fi

# Install dependencies
echo "📦 Instalando dependências..."
npm install

# Install docs dependencies  
echo "📚 Instalando dependências da documentação..."
cd docs && npm install && cd ..

# Build documentation
echo "🔨 Construindo documentação..."
npm run docs:build

# Check if build was successful
if [ ! -d "docs/.vitepress/dist" ]; then
    echo "❌ Erro: Build da documentação falhou"
    exit 1
fi

echo "✅ Build concluído com sucesso!"
echo "📁 Arquivos gerados em: docs/.vitepress/dist"

# Deploy options
echo ""
echo "🚀 Opções de Deploy:"
echo "1. Deploy manual via Vercel CLI"
echo "2. Deploy via Git (push para ativar GitHub Actions)"
echo "3. Upload manual dos arquivos"

read -p "Escolha uma opção (1-3) ou pressione Enter para pular: " choice

case $choice in
    1)
        echo "Executando deploy via Vercel CLI..."
        cd docs
        if command -v vercel &> /dev/null; then
            vercel --prod
        else
            echo "❌ Vercel CLI não encontrado. Instale com: npm i -g vercel"
        fi
        cd ..
        ;;
    2)
        echo "🔄 Para deploy automático, faça:"
        echo "   git add ."
        echo "   git commit -m 'Update documentation'"
        echo "   git push origin dev"
        ;;
    3)
        echo "📁 Arquivos para upload manual estão em: docs/.vitepress/dist"
        echo "   Upload estes arquivos para seu servidor web"
        ;;
    *)
        echo "ℹ️  Deploy manual necessário"
        ;;
esac

echo ""
echo "✨ Script concluído!"
echo "📖 Para mais informações, veja: docs/DEPLOY.md"