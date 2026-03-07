"""
SenhaService - Lógica de negócio para senhas
app/services/senha_service.py

✅ Numeração diária funcionando
✅ Proteção contra race conditions (SELECT FOR UPDATE)
✅ Cache integrado
✅ Retry logic para deadlocks
✅ Compatível com todo o sistema
"""
from datetime import datetime, date
from app import db
from app.models import Senha, Servico, LogActividade
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, OperationalError
import time


class SenhaService:
    """
    Service para gerenciar senhas
    
    Methods:
        emitir(): Emite nova senha com proteção contra race conditions
        obter_por_id(): Busca senha por ID
        obter_por_numero(): Busca senha por número
        cancelar(): Cancela senha
        obter_estatisticas_hoje(): Estatísticas do dia (com cache)
    """
    
    # Configurações de retry para race conditions
    MAX_RETRIES = 3
    RETRY_DELAY = 0.1  # segundos
    
    @staticmethod
    def emitir(servico_id, tipo='normal', usuario_contato=None, data_emissao=None):
        """
        Emite nova senha com numeração diária E proteção contra race conditions
        
        Args:
            servico_id (int): ID do serviço
            tipo (str): 'normal' ou 'prioritaria'
            usuario_contato (str): Contato do usuário
            data_emissao (date): Data de emissão (default: hoje)
        
        Returns:
            Senha: Senha criada
        
        Raises:
            ValueError: Se serviço inválido ou tipo inválido
        
        Example:
            >>> senha = SenhaService.emitir(servico_id=1, tipo='normal')
            >>> print(senha.numero)  # N001 (único, sem duplicação)
        """
        from flask import current_app
        
        # Log início (se logger disponível)
        try:
            current_app.logger.info('Iniciando emissão de senha', extra={
                'servico_id': servico_id,
                'tipo': tipo
            })
        except:
            print(f"📝 Emitindo senha: servico={servico_id}, tipo={tipo}")
        
        # Tentar até MAX_RETRIES vezes (proteção contra deadlocks)
        for tentativa in range(SenhaService.MAX_RETRIES):
            try:
                # Chamar método interno com lock
                senha = SenhaService._emitir_com_lock(
                    servico_id, 
                    tipo, 
                    usuario_contato,
                    data_emissao
                )
                
                # Invalidar cache
                SenhaService._invalidar_cache(data_emissao or datetime.utcnow().date())
                
                # Log sucesso
                try:
                    current_app.logger.info('Senha emitida', extra={
                        'senha_id': senha.id,
                        'numero': senha.numero
                    })
                except:
                    print(f"✅ Senha emitida: {senha.numero}")
                
                return senha
                
            except IntegrityError as e:
                # Violação de UNIQUE - número duplicado
                db.session.rollback()
                
                if tentativa < SenhaService.MAX_RETRIES - 1:
                    print(f"⚠️ IntegrityError, tentando novamente ({tentativa + 1}/{SenhaService.MAX_RETRIES})")
                    time.sleep(SenhaService.RETRY_DELAY * (tentativa + 1))
                    continue
                else:
                    raise ValueError(f"Erro ao gerar número único após {SenhaService.MAX_RETRIES} tentativas")
            
            except OperationalError as e:
                # Deadlock ou timeout
                db.session.rollback()
                
                if tentativa < SenhaService.MAX_RETRIES - 1:
                    print(f"⚠️ OperationalError, tentando novamente ({tentativa + 1}/{SenhaService.MAX_RETRIES})")
                    time.sleep(SenhaService.RETRY_DELAY * (tentativa + 1))
                    continue
                else:
                    raise ValueError(f"Erro de concorrência após {SenhaService.MAX_RETRIES} tentativas")
        
        # Se chegou aqui, todas as tentativas falharam
        raise ValueError("Erro inesperado ao emitir senha")
    
    @staticmethod
    def _emitir_com_lock(servico_id, tipo, usuario_contato, data_emissao):
        """
        Emissão com lock transacional (método interno)
        
        Usa SELECT ... FOR UPDATE para evitar race conditions
        """
        # 1. Validar dados de entrada
        SenhaService.validar_dados_emissao(servico_id, tipo)
        
        # 2. Data de emissão (default: hoje)
        if data_emissao is None:
            data_emissao = datetime.utcnow().date()
        
        # 3. Gerar número sequencial COM LOCK
        numero = SenhaService._gerar_proximo_numero_com_lock(tipo, data_emissao)
        
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
        
        # 6. Criar log de atividade
        try:
            servico = db.session.get(Servico, servico_id)
            servico_nome = servico.nome if servico else f"Serviço ID {servico_id}"
            
            LogActividade.registrar(
                acao='emitida',
                senha_id=senha.id,
                descricao=f"Senha {senha.numero} emitida para {servico_nome}"
            )
        except Exception as log_error:
            print(f"⚠️ Aviso: Não foi possível criar log: {log_error}")
        
        # 7. Commit das alterações
        db.session.commit()
        
        # 8. Recarregar senha com relacionamentos
        db.session.refresh(senha)
        
        return senha
    
    @staticmethod
    def _gerar_proximo_numero_com_lock(tipo, data_emissao):
        """
        Gera próximo número COM LOCK PESSIMISTA
        
        Usa SELECT ... FOR UPDATE para bloquear linha durante leitura
        Isso evita que dois processos leiam o mesmo número simultaneamente
        
        Args:
            tipo (str): 'normal' ou 'prioritaria'
            data_emissao (date): Data da senha
            
        Returns:
            str: Número no formato N001, N002... ou P001, P002...
        """
        # Definir prefixo baseado no tipo
        prefixo = 'P' if tipo == 'prioritaria' else 'N'
        
        # ===== QUERY COM LOCK PESSIMISTA =====
        # FOR UPDATE bloqueia a linha durante a transação
        # Outros processos aguardam até o commit
        ultima_senha = db.session.query(Senha).filter(
            Senha.tipo == tipo,
            Senha.data_emissao == data_emissao
        ).order_by(Senha.id.desc()).with_for_update().first()
        
        # Calcular próximo número
        if ultima_senha:
            try:
                ultimo_numero = int(ultima_senha.numero[1:])  # Remove prefixo
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
        
        if tipo not in ['normal', 'prioritaria']:
            raise ValueError(f"Tipo '{tipo}' inválido. Use 'normal' ou 'prioritaria'")
    
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
            numero=numero.upper(),
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
        
        # Cancelar
        senha.cancelar(motivo, atendente_id)
        
        # Registrar log
        try:
            LogActividade.registrar(
                acao='cancelada',
                senha_id=senha.id,
                atendente_id=atendente_id,
                descricao=f"Senha {senha.numero} cancelada: {motivo}"
            )
        except Exception as e:
            print(f"⚠️ Aviso: Não foi possível criar log de cancelamento: {e}")
        
        # Invalidar cache
        SenhaService._invalidar_cache(senha.data_emissao)
        
        return senha
    
    @staticmethod
    def obter_estatisticas_hoje(data=None):
        """
        Estatísticas de senhas do dia (COM CACHE)
        
        Args:
            data (date): Data (default: hoje)
        
        Returns:
            dict: Estatísticas
        """
        if data is None:
            data = datetime.utcnow().date()
        
        # Tentar pegar do cache
        cache_key = f"estatisticas:{data.isoformat()}"
        cached = SenhaService._get_cache(cache_key)
        if cached:
            return cached
        
        # Calcular estatísticas
        total_emitidas = Senha.query.filter_by(data_emissao=data).count()
        
        aguardando = Senha.query.filter(
            Senha.data_emissao == data,
            Senha.status == 'aguardando'
        ).count()
        
        atendendo = Senha.query.filter(
            Senha.data_emissao == data,
            Senha.status == 'atendendo'
        ).count()
        
        concluidas = Senha.query.filter(
            Senha.data_emissao == data,
            Senha.status == 'concluida'
        ).count()
        
        canceladas = Senha.query.filter(
            Senha.data_emissao == data,
            Senha.status == 'cancelada'
        ).count()
        
        # Tempo médio de espera
        senhas_concluidas = Senha.query.filter(
            Senha.data_emissao == data,
            Senha.status == 'concluida',
            Senha.tempo_espera_minutos.isnot(None)
        ).all()
        
        if senhas_concluidas:
            tempos = [s.tempo_espera_minutos for s in senhas_concluidas]
            tempo_medio_espera = sum(tempos) / len(tempos)
        else:
            tempo_medio_espera = 0
        
        stats = {
            'total_emitidas': total_emitidas,
            'aguardando': aguardando,
            'atendendo': atendendo,
            'concluidas': concluidas,
            'canceladas': canceladas,
            'tempo_medio_espera': round(tempo_medio_espera, 1)
        }
        
        # Salvar no cache (30 segundos)
        SenhaService._set_cache(cache_key, stats, ttl=30)
        
        return stats
    
    # ===============================
    # 🗄️ CACHE HELPERS
    # ===============================
    
    @staticmethod
    def _get_cache(key):
        """Tenta pegar do cache (se disponível)"""
        try:
            from app.services.cache_service import get_cache
            cache = get_cache()
            return cache.get(key)
        except:
            return None
    
    @staticmethod
    def _set_cache(key, value, ttl=60):
        """Salva no cache (se disponível)"""
        try:
            from app.services.cache_service import get_cache
            cache = get_cache()
            cache.set(key, value, ttl)
        except:
            pass
    
    @staticmethod
    def _invalidar_cache(data_emissao):
        """Invalida cache de estatísticas"""
        try:
            from app.services.cache_service import get_cache
            cache = get_cache()
            cache_key = f"estatisticas:{data_emissao.isoformat()}"
            cache.delete(cache_key)
        except:
            pass