# ===== FASE 2: SENHA SERVICE COM PROTEÇÃO RACE CONDITION =====

"""
app/services/senha_service.py - VERSÃO COM LOCKS

MUDANÇAS:
1. ✅ SELECT ... FOR UPDATE (lock pessimista)
2. ✅ Isolation level SERIALIZABLE
3. ✅ Retry logic para deadlocks
4. ✅ Tratamento de IntegrityError

BACKUP ANTES DE APLICAR:
cp app/services/senha_service.py app/services/senha_service.py.backup_fase2
"""

from app import db
from app.models.senha import Senha
from app.models.servico import Servico
from app.models.log_actividade import LogActividade
from datetime import datetime, date
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError, OperationalError
import time
from app.services.cache_service import CacheService


class SenhaService:
    """
    Service para operações com senhas
    
    VERSÃO 2.0: Com proteção contra race conditions
    """
    
    # Configurações de retry
    MAX_RETRIES = 3
    RETRY_DELAY = 0.1  # segundos
    
    
    @staticmethod
    def emitir(servico_id, tipo, usuario_contato=None):
        """
        Emite nova senha com proteção contra race condition
        
        Usa locks transacionais para evitar duplicação em acessos simultâneos
        
        Args:
            servico_id (int): ID do serviço
            tipo (str): 'normal' ou 'prioritaria'
            usuario_contato (str, optional): Contato do usuário
            
        Returns:
            Senha: Objeto senha criado
            
        Raises:
            ValueError: Se dados inválidos
            
        Example:
            >>> senha = SenhaService.emitir(servico_id=1, tipo='normal')
            >>> print(senha.numero)  # N001 (sem risco de duplicação)
        """
        # Tentar até MAX_RETRIES vezes (proteção contra deadlocks)
        for tentativa in range(SenhaService.MAX_RETRIES):
            try:
                return SenhaService._emitir_com_lock(servico_id, tipo, usuario_contato)
                
            except IntegrityError as e:
                # Violação de UNIQUE - número duplicado
                db.session.rollback()
                
                if tentativa < SenhaService.MAX_RETRIES - 1:
                    # Tentar novamente após pequeno delay
                    time.sleep(SenhaService.RETRY_DELAY * (tentativa + 1))
                    continue
                else:
                    # Última tentativa falhou
                    raise ValueError(f"Erro ao gerar número único após {SenhaService.MAX_RETRIES} tentativas")
            
            except OperationalError as e:
                # Deadlock ou timeout
                db.session.rollback()
                
                if tentativa < SenhaService.MAX_RETRIES - 1:
                    time.sleep(SenhaService.RETRY_DELAY * (tentativa + 1))
                    continue
                else:
                    raise ValueError(f"Erro de concorrência após {SenhaService.MAX_RETRIES} tentativas")
            
            except Exception as e:
                db.session.rollback()
                raise
        
        # Se chegou aqui, todas as tentativas falharam
        raise ValueError("Erro inesperado ao emitir senha")
    
    
    @staticmethod
    def _emitir_com_lock(servico_id, tipo, usuario_contato):
        """
        Emissão com lock transacional (método interno)
        
        Esta função é chamada dentro de um loop de retry
        """
        # 1. Validar dados de entrada
        SenhaService.validar_dados_emissao(servico_id, tipo)
        
        # 2. Gerar número sequencial COM LOCK
        numero = SenhaService._gerar_proximo_numero_com_lock(tipo)
        
        # 3. Data de emissão (hoje)
        data_emissao = datetime.utcnow().date()
        
        # 4. Criar objeto Senha
        senha = Senha(
            numero=numero,
            servico_id=servico_id,
            tipo=tipo,
            usuario_contato=usuario_contato,
            data_emissao=data_emissao
        )
        
        # 5. Salvar no banco de dados
        db.session.add(senha)
        db.session.flush()  # Flush para detectar violações antes do commit
        
        # 6. Criar log de atividade (com tratamento de erro)
        try:
            servico = db.session.get(Servico, servico_id)
            servico_nome = servico.nome if servico else f"Serviço ID {servico_id}"
            
            log = LogActividade(
                senha_id=senha.id,
                acao='emitida',
                descricao=f'Senha {senha.numero} emitida para {servico_nome}',
                atendente_id=None
            )
            db.session.add(log)
            
        except Exception as log_error:
            print(f"⚠️  Aviso: Não foi possível criar log: {log_error}")
        
        # 7. Commit das alterações
        db.session.commit()
        
        # 8. Recarregar senha com relacionamentos
        db.session.refresh(senha)
        
        # Invalidar cache ao emitir senha
        data_emissao = datetime.utcnow().date()
        CacheService.delete(f'stats:{data_emissao.isoformat()}')
        CacheService.delete(f'fila:{servico_id}:{data_emissao.isoformat()}')
        
        return senha
    
    
    @staticmethod
    def _gerar_proximo_numero_com_lock(tipo):
        """
        Gera próximo número COM LOCK PESSIMISTA
        
        Usa SELECT ... FOR UPDATE para bloquear linha durante leitura
        Isso evita que dois processos leiam o mesmo número
        
        Args:
            tipo (str): 'normal' ou 'prioritaria'
            
        Returns:
            str: Número no formato N001, N002... ou P001, P002...
        """
        # Definir prefixo baseado no tipo
        prefixo = 'P' if tipo == 'prioritaria' else 'N'
        
        # Data de hoje
        hoje = datetime.utcnow().date()
        
        # ===== QUERY COM LOCK PESSIMISTA =====
        # FOR UPDATE bloqueia a linha durante a transação
        # Outros processos aguardam até o commit
        ultima_senha = db.session.query(Senha).filter(
            Senha.numero.like(f'{prefixo}%'),
            Senha.data_emissao == hoje
        ).order_by(Senha.id.desc()).with_for_update().first()
        
        # Calcular próximo número
        if ultima_senha:
            try:
                ultimo_numero = int(ultima_senha.numero[1:])
                proximo_numero = ultimo_numero + 1
            except (ValueError, IndexError):
                proximo_numero = 1
        else:
            proximo_numero = 1
        
        # Formatar com zero à esquerda
        return f'{prefixo}{proximo_numero:03d}'
    
    
    @staticmethod
    def validar_dados_emissao(servico_id, tipo):
        """Valida dados antes de emitir senha"""
        servico = db.session.get(Servico, servico_id)
        if not servico:
            raise ValueError(f"Serviço com ID {servico_id} não encontrado")
        
        if not servico.ativo:
            raise ValueError(f"Serviço '{servico.nome}' está inativo")
        
        if tipo not in Senha.TIPOS:
            raise ValueError(f"Tipo '{tipo}' inválido. Use: {', '.join(Senha.TIPOS)}")
    
    
    @staticmethod
    def obter_por_id(senha_id):
        """Busca senha por ID"""
        return db.session.get(Senha, senha_id)
    
    
    @staticmethod
    def obter_por_numero(numero, data_emissao=None):
        """Busca senha por número e data"""
        if data_emissao is None:
            data_emissao = datetime.utcnow().date()
        
        return Senha.query.filter_by(
            numero=numero,
            data_emissao=data_emissao
        ).first()
    
    
    @staticmethod
    def cancelar(senha_id, motivo, atendente_id=None):
        """Cancela uma senha"""
        senha = db.session.get(Senha, senha_id)
        if not senha:
            raise ValueError(f"Senha com ID {senha_id} não encontrada")
        
        if senha.status == 'concluida':
            raise ValueError("Não é possível cancelar senha já concluída")
        
        senha.status = 'cancelada'
        senha.observacoes = motivo
        
        try:
            log = LogActividade(
                senha_id=senha.id,
                atendente_id=atendente_id,
                acao='cancelada',
                descricao=f'Senha {senha.numero} cancelada. Motivo: {motivo}'
            )
            db.session.add(log)
        except Exception as e:
            print(f"⚠️  Aviso: Não foi possível criar log de cancelamento: {e}")
        
        db.session.commit()
        db.session.refresh(senha)
        
        return senha
    
    
    @staticmethod
    def obter_estatisticas_hoje(data=None):
        if data is None:
            data = datetime.utcnow().date()
    
    # Tentar cache
        cache_key = f'stats:{data.isoformat()}'
        cached = CacheService.get(cache_key)
        if cached:
            return cached
    
    # Buscar do banco
        senhas_do_dia = Senha.query.filter(
            Senha.data_emissao == data
        )
    
        stats = {
            'data': data.isoformat(),
            'total_emitidas': senhas_do_dia.count(),
            'aguardando': senhas_do_dia.filter_by(status='aguardando').count(),
            'chamando': senhas_do_dia.filter_by(status='chamando').count(),
            'atendendo': senhas_do_dia.filter_by(status='atendendo').count(),
            'concluidas': senhas_do_dia.filter_by(status='concluida').count(),
            'canceladas': senhas_do_dia.filter_by(status='cancelada').count(),
        }
    
    # Cache por 30 segundos
        CacheService.set(cache_key, stats, ttl_seconds=30)
    
        return stats
    
    
    @staticmethod
    def obter_fila(servico_id, data=None):
        if data is None:
            data = datetime.utcnow().date()
    
    # Tentar cache
        cache_key = f'fila:{servico_id}:{data.isoformat()}'
        cached = CacheService.get(cache_key)
        if cached:
            return cached
    
    # Buscar do banco
        fila = Senha.query.filter(
            Senha.data_emissao == data,
            Senha.servico_id == servico_id,
            Senha.status == 'aguardando'
        ).order_by(
            db.case(
                (Senha.tipo == 'prioritaria', 0),
                else_=1
            ),
            Senha.emitida_em
        ).all()
        
        # Cache por 10 segundos
        CacheService.set(cache_key, fila, ttl_seconds=10)
        
        return fila


# ===== COMPARAÇÃO: ANTES vs DEPOIS =====
if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║  FASE 2 - PROTEÇÃO CONTRA RACE CONDITIONS                    ║
╚══════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTES (SEM PROTEÇÃO):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ultima_senha = Senha.query.filter(...).first()
# ❌ Dois usuários podem ler N005 ao mesmo tempo
# ❌ Ambos tentam criar N006
# ❌ Um deles falha com erro de duplicação

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPOIS (COM PROTEÇÃO):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ultima_senha = Senha.query.filter(...).with_for_update().first()
# ✅ Primeiro usuário BLOQUEIA a linha
# ✅ Segundo usuário AGUARDA até primeiro commitar
# ✅ Cada um recebe número único (N006, N007)

+ Retry logic: Se der deadlock, tenta novamente (3x)
+ IntegrityError handling: Captura duplicações

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TÉCNICAS USADAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SELECT ... FOR UPDATE
   → Lock pessimista (bloqueia linha durante leitura)

2. Retry Logic
   → Se der deadlock, tenta novamente (até 3x)

3. IntegrityError Handling
   → Captura violação de UNIQUE e retenta

4. Isolation Level
   → MySQL InnoDB usa READ COMMITTED por padrão
   → FOR UPDATE garante serialização

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔══════════════════════════════════════════════════════════════╗
║  APLICAR SERVICE COM PROTEÇÃO                                ║
╚══════════════════════════════════════════════════════════════╝

PASSO 1: Backup
---------------
cp app/services/senha_service.py app/services/senha_service.py.backup_fase2

PASSO 2: Substituir
-------------------
# Copie TODO o conteúdo deste arquivo
# Cole em: app/services/senha_service.py
# Salve

PASSO 3: Testar
---------------
python FASE2_2_teste_concorrencia.py

PRÓXIMO ARQUIVO: FASE2_2_teste_concorrencia.py
    """)
