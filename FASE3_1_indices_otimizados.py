# ===== FASE 3: ÍNDICES OTIMIZADOS =====

"""
FASE3_1_indices_otimizados.py

OBJETIVO: Criar índices compostos para queries < 50ms
QUANDO: Aplicar ANTES de modificar código Python
"""

SQL_INDICES = """
-- ════════════════════════════════════════════════════════════
-- FASE 3: ÍNDICES OTIMIZADOS PARA PERFORMANCE
-- ════════════════════════════════════════════════════════════

USE sistema_filas_imtsb;

-- Índice composto para fila por serviço
CREATE INDEX idx_servico_data_status 
ON senhas(servico_id, data_emissao, status);

-- Índice para atendimento
CREATE INDEX idx_atendente_status 
ON senhas(atendente_id, status);

-- Índice para ordenação de fila
CREATE INDEX idx_tipo_emitida 
ON senhas(tipo, emitida_em);

-- Índices em log_actividades
CREATE INDEX idx_log_senha_created 
ON log_actividades(senha_id, created_at DESC);

-- Verificar
SHOW INDEX FROM senhas;
"""

print("""
╔══════════════════════════════════════════════════════════════╗
║  FASE 3.1 - CRIAR ÍNDICES OTIMIZADOS                         ║
╚══════════════════════════════════════════════════════════════╝

Execute no MySQL:

""" + SQL_INDICES + """

✅ Depois execute: python FASE3_2_cache_estatisticas.py
""")
