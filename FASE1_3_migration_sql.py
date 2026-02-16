# ===== FASE 1: MIGRATION SQL =====

"""
Migration para adicionar data_emissao e UNIQUE composto

⚠️  CRÍTICO: Faça backup do banco antes!

BACKUP:
mysqldump -u root -p sistema_filas_imtsb > backup_antes_migration_$(date +%Y%m%d_%H%M%S).sql
"""

# ===== OPÇÃO 1: BANCO TEM DADOS (PRODUÇÃO) =====

SQL_COM_DADOS = """
-- ════════════════════════════════════════════════════════════
-- MIGRATION: Adicionar data_emissao e UNIQUE composto
-- Data: 2026-02-16
-- Autor: Yvano Moniz
-- ════════════════════════════════════════════════════════════

-- Usar o banco correto
USE sistema_filas_imtsb;

-- ════════════════════════════════════════════════════════════
-- PASSO 1: Remover índice UNIQUE da coluna numero
-- ════════════════════════════════════════════════════════════

ALTER TABLE senhas DROP INDEX ix_senhas_numero;

-- Recriar como índice não-unique (para busca rápida)
CREATE INDEX ix_senhas_numero ON senhas(numero);


-- ════════════════════════════════════════════════════════════
-- PASSO 2: Adicionar coluna data_emissao
-- ════════════════════════════════════════════════════════════

ALTER TABLE senhas 
ADD COLUMN data_emissao DATE NOT NULL 
DEFAULT (CURRENT_DATE)
AFTER numero;


-- ════════════════════════════════════════════════════════════
-- PASSO 3: Preencher data_emissao para senhas existentes
--          (usa data de created_at para dados históricos)
-- ════════════════════════════════════════════════════════════

UPDATE senhas 
SET data_emissao = DATE(created_at)
WHERE data_emissao IS NULL OR data_emissao = CURRENT_DATE;


-- ════════════════════════════════════════════════════════════
-- PASSO 4: Criar UNIQUE composto (numero + data_emissao)
-- ════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX uq_numero_data 
ON senhas(numero, data_emissao);


-- ════════════════════════════════════════════════════════════
-- PASSO 5: Criar índice na data_emissao (performance)
-- ════════════════════════════════════════════════════════════

CREATE INDEX ix_senhas_data_emissao 
ON senhas(data_emissao);


-- ════════════════════════════════════════════════════════════
-- VERIFICAÇÃO: Mostrar estrutura atualizada
-- ════════════════════════════════════════════════════════════

DESCRIBE senhas;
SHOW INDEX FROM senhas;


-- ════════════════════════════════════════════════════════════
-- RESULTADO ESPERADO:
-- ════════════════════════════════════════════════════════════
-- 
-- Coluna data_emissao:
--   - Type: date
--   - Null: NO
--   - Default: (current_date())
-- 
-- Índices:
--   - uq_numero_data: UNIQUE(numero, data_emissao)
--   - ix_senhas_numero: INDEX(numero)
--   - ix_senhas_data_emissao: INDEX(data_emissao)
--
-- ════════════════════════════════════════════════════════════
"""


# ===== OPÇÃO 2: BANCO VAZIO (DESENVOLVIMENTO) =====

SQL_SEM_DADOS = """
-- ════════════════════════════════════════════════════════════
-- MIGRATION: Recriar tabela senhas com estrutura correta
-- USAR APENAS SE BANCO ESTÁ VAZIO OU É AMBIENTE DE TESTES
-- ════════════════════════════════════════════════════════════

USE sistema_filas_imtsb;

-- Dropar tabela antiga (⚠️  PERDE DADOS!)
DROP TABLE IF EXISTS senhas;

-- Criar tabela nova com data_emissao desde o início
CREATE TABLE senhas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Identificação da senha
    numero VARCHAR(20) NOT NULL,
    data_emissao DATE NOT NULL DEFAULT (CURRENT_DATE),
    
    -- Status e tipo
    tipo VARCHAR(20) NOT NULL DEFAULT 'normal',
    status VARCHAR(20) NOT NULL DEFAULT 'aguardando',
    
    -- Relacionamentos
    servico_id INT NOT NULL,
    atendente_id INT NULL,
    numero_balcao INT NULL,
    usuario_contato VARCHAR(100) NULL,
    
    -- Timestamps do fluxo de atendimento
    emitida_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    chamada_em DATETIME NULL,
    atendimento_iniciado_em DATETIME NULL,
    atendimento_concluido_em DATETIME NULL,
    
    -- Métricas calculadas
    tempo_espera_minutos INT NULL,
    tempo_atendimento_minutos INT NULL,
    observacoes TEXT NULL,
    
    -- Auditoria
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices individuais (para busca)
    INDEX ix_senhas_numero (numero),
    INDEX ix_senhas_data_emissao (data_emissao),
    INDEX ix_senhas_tipo (tipo),
    INDEX ix_senhas_status (status),
    INDEX ix_senhas_servico_id (servico_id),
    INDEX ix_senhas_emitida_em (emitida_em),
    INDEX ix_senhas_atendente_id (atendente_id),
    
    -- Unique composto (CRÍTICO!)
    UNIQUE KEY uq_numero_data (numero, data_emissao),
    
    -- Foreign keys
    FOREIGN KEY (servico_id) REFERENCES servicos(id),
    FOREIGN KEY (atendente_id) REFERENCES atendentes(id)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Senhas de atendimento com numeração diária';

-- Verificar estrutura
DESCRIBE senhas;
SHOW INDEX FROM senhas;
"""


# ===== OPÇÃO 3: ROLLBACK (SE ALGO DER ERRADO) =====

SQL_ROLLBACK = """
-- ════════════════════════════════════════════════════════════
-- ROLLBACK: Reverter migration
-- USAR APENAS SE MIGRATION DEU PROBLEMA
-- ════════════════════════════════════════════════════════════

USE sistema_filas_imtsb;

-- 1. Remover índice composto
DROP INDEX uq_numero_data ON senhas;

-- 2. Remover índice de data_emissao
DROP INDEX ix_senhas_data_emissao ON senhas;

-- 3. Remover coluna data_emissao
ALTER TABLE senhas DROP COLUMN data_emissao;

-- 4. Recriar índice UNIQUE em numero
DROP INDEX ix_senhas_numero ON senhas;
CREATE UNIQUE INDEX ix_senhas_numero ON senhas(numero);

-- Verificar
DESCRIBE senhas;
SHOW INDEX FROM senhas;
"""


# ===== SALVAR ARQUIVOS SQL =====

def salvar_arquivos_sql():
    """Salva as migrations em arquivos .sql"""
    
    import os
    from datetime import datetime
    
    # Criar pasta migrations se não existir
    os.makedirs('migrations/sql', exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Arquivo 1: Com dados
    with open(f'migrations/sql/{timestamp}_add_data_emissao_COM_DADOS.sql', 'w', encoding='utf-8') as f:
        f.write(SQL_COM_DADOS)
    
    # Arquivo 2: Sem dados
    with open(f'migrations/sql/{timestamp}_add_data_emissao_SEM_DADOS.sql', 'w', encoding='utf-8') as f:
        f.write(SQL_SEM_DADOS)
    
    # Arquivo 3: Rollback
    with open(f'migrations/sql/{timestamp}_ROLLBACK.sql', 'w', encoding='utf-8') as f:
        f.write(SQL_ROLLBACK)
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║  ARQUIVOS SQL CRIADOS                                        ║
╚══════════════════════════════════════════════════════════════╝

✅ migrations/sql/{timestamp}_add_data_emissao_COM_DADOS.sql
✅ migrations/sql/{timestamp}_add_data_emissao_SEM_DADOS.sql
✅ migrations/sql/{timestamp}_ROLLBACK.sql
    """.format(timestamp=timestamp))


# ===== GUIA DE APLICAÇÃO =====

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║  APLICAR MIGRATION NO BANCO                                  ║
╚══════════════════════════════════════════════════════════════╝

⚠️  CRÍTICO: FAÇA BACKUP ANTES!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 0: BACKUP (OBRIGATÓRIO!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

mysqldump -u root -p sistema_filas_imtsb > backup_$(date +%Y%m%d).sql

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPÇÃO A: BANCO TEM DADOS (PRODUÇÃO/DEV COM DADOS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Copie o SQL acima (SQL_COM_DADOS)

2. Salve em arquivo: migration.sql

3. Execute no MySQL:

   mysql -u root -p sistema_filas_imtsb < migration.sql

4. OU execute no MySQL Workbench:
   - Abra o SQL
   - Execute linha por linha
   - Verifique cada passo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPÇÃO B: BANCO VAZIO (DEV/TESTES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Copie o SQL acima (SQL_SEM_DADOS)

2. Execute no MySQL:

   mysql -u root -p sistema_filas_imtsb < migration.sql

3. Depois execute seeders:

   python seed.py

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPÇÃO C: PYTHON (PROGRAMÁTICO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

python

>>> from app import create_app, db
>>> app = create_app()
>>> with app.app_context():
...     db.drop_all()  # ⚠️  Só se banco vazio!
...     db.create_all()
>>> exit()

python seed.py

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔══════════════════════════════════════════════════════════════╗
║  VERIFICAÇÃO PÓS-MIGRATION                                   ║
╚══════════════════════════════════════════════════════════════╝

Execute no MySQL para verificar:

USE sistema_filas_imtsb;

-- Ver estrutura
DESCRIBE senhas;

-- Ver índices
SHOW INDEX FROM senhas WHERE Table = 'senhas';

-- Testar unique composto (deve dar erro)
INSERT INTO senhas (numero, data_emissao, tipo, status, servico_id, emitida_em)
VALUES ('N001', CURRENT_DATE, 'normal', 'aguardando', 1, NOW());

-- Segunda tentativa (deve dar erro de duplicação)
INSERT INTO senhas (numero, data_emissao, tipo, status, servico_id, emitida_em)
VALUES ('N001', CURRENT_DATE, 'normal', 'aguardando', 1, NOW());
-- Erro esperado: Duplicate entry 'N001-2026-02-16' for key 'uq_numero_data'

-- Limpar testes
DELETE FROM senhas WHERE numero = 'N001';

╔══════════════════════════════════════════════════════════════╗
║  RESULTADO ESPERADO                                          ║
╚══════════════════════════════════════════════════════════════╝

Após migration, a tabela senhas deve ter:

✅ Coluna data_emissao (DATE, NOT NULL)
✅ Índice uq_numero_data (UNIQUE, colunas: numero, data_emissao)
✅ Índice ix_senhas_data_emissao (INDEX)
✅ Índice ix_senhas_numero (INDEX, não-unique)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRÓXIMO ARQUIVO: 4_teste_numeracao_diaria.py
    """)
    
    # Criar arquivos SQL
    salvar_arquivos_sql()
