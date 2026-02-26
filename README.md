# 🎯 Sistema de Filas IMTSB - Backend

Sistema Inteligente de Gerenciamento de Filas e Atendimento desenvolvido para o Instituto Médio Técnico São Benedito.

## 👥 Equipe

- **Yvano Moniz** - Backend Developer
- **Jefferson André** - Database Administrator  
- **Reginalda Almeida** - Frontend Developer

## 🚀 Tecnologias

- **Python 3.13**
- **Flask 3.0** - Framework web
- **MySQL 8.0** - Banco de dados
- **JWT** - Autenticação
- **Marshmallow** - Validação
- **Swagger** - Documentação

## 📦 Instalação

### 1. Clonar repositório

```bash
git clone [url-do-repositorio]
cd sistema-de-filas-backend
```

### 2. Criar ambiente virtual

```bash
python -m venv venv
venv\\Scripts\\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

### 3. Instalar dependências

```bash
pip install -r requirements.txt
```

### 4. Configurar variáveis de ambiente

```bash
copy .env.example .env
# Editar .env com suas configurações
```

### 5. Inicializar banco de dados

```bash
flask db upgrade
python -c "from app.utils.seeders import popular_banco; popular_banco()"
```

### 6. Executar servidor

```bash
python run.py
```

Servidor rodando em: `http://localhost:5000`

## 📚 Documentação

- **Swagger UI:** http://localhost:5000/docs
- **Health Check:** http://localhost:5000/api/auth/health

## 🧪 Testes

```bash
# Executar todos os testes
pytest

# Com coverage
pytest --cov=app --cov-report=html
```

## 📊 Funcionalidades

### ✅ Implementadas

- Autenticação JWT
- Emissão de senhas (Normal e Prioritária)
- Gestão de filas
- Atendimento completo (Chamar, Iniciar, Finalizar)
- Estatísticas em tempo real
- Rate limiting (proteção anti-spam)
- Validações robustas
- Logs estruturados
- Cache de performance
- Health check

### 🔄 Em desenvolvimento

- Priorização automática de senhas
- Notificações SMS/Email
- Relatórios avançados
- WebSocket para tempo real

## 🔐 Credenciais Padrão

**Admin:**
- Email: `admin@imtsb.ao`
- Senha: `admin123`

⚠️ **IMPORTANTE:** Alterar credenciais em produção!

## 📁 Estrutura do Projeto

```
sistema-de-filas-backend/
├── app/
│   ├── controllers/      # Rotas da API
│   ├── models/           # Models do banco
│   ├── services/         # Lógica de negócio
│   ├── schemas/          # Validações
│   └── utils/            # Utilitários
├── tests/                # Testes automatizados
├── logs/                 # Logs do sistema
├── migrations/           # Migrações do banco
├── run.py               # Ponto de entrada
└── requirements.txt     # Dependências
```

## 📈 Performance

- **Estatísticas:** < 3ms (com cache)
- **Buscar fila:** < 1ms
- **Emitir senha:** < 100ms

## 🤝 Contribuindo

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto foi desenvolvido como Trabalho de Conclusão de Curso (TCC) do IMTSB.

## 📞 Suporte

Para dúvidas ou suporte, entre em contato com a equipe de desenvolvimento.

---

**Desenvolvido com ❤️ pela equipe do TCC 2026 - IMTSB**