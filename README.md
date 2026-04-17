# Sistema de Filas — IMTSB
**Instituto Médio Técnico São Benedito — Luanda, Angola**
Trabalho de Fim de Curso

---

## Descrição

Sistema web de gestão de filas de atendimento para o IMTSB.
Permite emitir senhas, acompanhar chamadas em tempo real e
gerir o atendimento por serviço e balcão.

**Três papéis:**
- **Visitante** — emite senha, acompanha chamada, avalia atendimento
- **Atendente** — chama próxima senha, atende, emite recibo
- **Administrador** — KPIs, gráficos, histórico, gestão de atendentes

---

## Tecnologias

| Camada    | Tecnologia                          |
|-----------|-------------------------------------|
| Backend   | Python 3 · Flask 3 · SQLAlchemy     |
| Base dados| MySQL 8                             |
| Auth      | Flask-JWT-Extended                  |
| Frontend  | HTML5 · CSS3 · JavaScript (ES6)    |

---

## Requisitos

- Python 3.10+
- MySQL 8.0+
- pip

---

## Instalação

```bash
# 1. Clonar o repositório
git clone https://github.com/monizyvano/sistema-de-filas-backend.git
cd sistema-de-filas-backend

# 2. Criar e activar ambiente virtual
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# 3. Instalar dependências
pip install -r requirements.txt

# 4. Configurar base de dados
# Criar BD no MySQL:
# CREATE DATABASE sistema_filas_imtsb CHARACTER SET utf8mb4;

# 5. Configurar variáveis de ambiente
# Criar ficheiro .env na raiz:
# FLASK_APP=run.py
# FLASK_ENV=development
# DATABASE_URL=mysql+pymysql://root:senha@localhost/sistema_filas_imtsb
# JWT_SECRET_KEY=chave-secreta-aqui

# 6. Aplicar migrações
flask db upgrade

# 7. Correr seeders (dados iniciais)
flask seed

# 8. Iniciar servidor
flask run
```

O sistema estará disponível em **http://localhost:5000**

---

## Contas de Acesso

| Papel        | Email                  | Senha      |
|--------------|------------------------|------------|
| Admin        | admin@imtsb.ao         | admin123   |
| Atendente 1  | joao@imtsb.ao          | Trab12345  |
| Atendente 2  | worker1@teste.com      | (ver BD)   |
| Visitante    | Entrar sem conta       | —          |

---

## Estrutura do Projecto

sistema-de-filas-backend/
├── app/
│   ├── controllers/        # Lógica de negócio
│   │   └── compat/         # Camada de compatibilidade frontend
│   ├── models/             # Modelos SQLAlchemy
│   ├── routes/             # Blueprints Flask
│   │   └── compat/         # Rotas compatíveis com o frontend
│   └── services/           # Serviços (FilaService, etc.)
├── static/
│   ├── css/                # Estilos
│   ├── js/                 # JavaScript (api-client, store, dashboards)
│   └── image/              # Imagens
├── templates/              # HTML (index, dashboards, formulários)
├── migrations/             # Migrações Alembic
├── requirements.txt
└── README.md


---

## Endpoints principais da API

| Método | Endpoint                    | Descrição                  |
|--------|-----------------------------|----------------------------|
| POST   | /api/auth/login             | Autenticação               |
| GET    | /api/auth/health            | Estado do servidor         |
| POST   | /api/tickets                | Emitir senha               |
| POST   | /api/tickets/call-next      | Chamar próxima senha       |
| POST   | /api/tickets/conclude       | Concluir atendimento       |
| POST   | /api/tickets/rate           | Avaliar atendimento        |
| GET    | /api/realtime/snapshot      | Snapshot em tempo real     |
| GET    | /api/stats                  | Estatísticas do dia        |
| GET    | /api/workers                | Lista de atendentes        |

---

## Serviços disponíveis

| Balcão | Serviço               |
|--------|-----------------------|
| 1      | Secretaria Académica  |
| 2      | Tesouraria            |
| 3      | Apoio ao Cliente      |

Senhas prioritárias (P001+) para pedidos de declaração.

---

*Desenvolvido como Trabalho de Fim de Curso — IMTSB, Angola, 2026*
