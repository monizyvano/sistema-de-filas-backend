"""
Senha Service - VERSÃO CORRIGIDA
app/services/senha_service.py

✅ CORREÇÃO: Geração de número movida para o service
✅ Métodos completos de estatísticas
"""

from app.models.senha import Senha
from app.models.servico import Servico
from app.extensions import db
from datetime import datetime, date
from sqlalchemy import func


class SenhaService:
    """Serviço para gerenciamento de senhas"""

    @staticmethod
    def emitir(servico_id, tipo='normal', usuario_contato=None):
        """
        ✅ CORRIGIDO - Emite uma nova senha
        
        Args:
            servico_id: ID do serviço
            tipo: 'normal' ou 'prioritaria'
            usuario_contato: Contato do usuário (opcional)
            
        Returns:
            Senha: Objeto da senha criada
        """
        # Validar serviço
        servico = Servico.query.get(servico_id)
        if not servico:
            raise ValueError(f"Serviço {servico_id} não encontrado")
        
        # ✅ GERAR NÚMERO AQUI (não no model)
        hoje = date.today()
        
        # Contar senhas do dia
        count = Senha.query.filter(
            func.date(Senha.emitida_em) == hoje
        ).count()
        
        # Gerar número sequencial
        prefixo = 'P' if tipo == 'prioritaria' else 'N'
        numero = f"{prefixo}{count + 1:03d}"
        
        # Criar senha COM número
        senha = Senha(
            numero=numero,
            servico_id=servico_id,
            tipo=tipo,
            usuario_contato=usuario_contato
            # status='aguardando' já é definido no __init__ do model
        )
        
        # Salvar
        db.session.add(senha)
        db.session.commit()
        
        return senha

    @staticmethod
    def listar_senhas(usuario_id=None, status=None, servico_id=None):
        """
        Lista senhas com filtros opcionais
        """
        query = Senha.query
        
        # Aplicar filtros
        if status:
            query = query.filter(Senha.status == status)
        
        if servico_id:
            query = query.filter(Senha.servico_id == servico_id)
        
        # Ordenar por data (mais recentes primeiro)
        query = query.order_by(Senha.created_at.desc())
        
        return query.all()

    @staticmethod
    def obter_por_id(senha_id):
        """Busca senha por ID"""
        return Senha.query.get(senha_id)

    @staticmethod
    def obter_por_numero(numero):
        """Busca senha por número"""
        hoje = date.today()
        return Senha.query.filter(
            Senha.numero == numero,
            func.date(Senha.emitida_em) == hoje
        ).first()

    @staticmethod
    def obter_senhas_hoje():
        """Retorna todas as senhas emitidas hoje"""
        hoje = date.today()
        return Senha.query.filter(
            func.date(Senha.emitida_em) == hoje
        ).order_by(Senha.emitida_em.desc()).all()

    @staticmethod
    def cancelar(senha_id, motivo, atendente_id):
        """Cancela uma senha"""
        senha = Senha.query.get(senha_id)
        
        if not senha:
            raise ValueError("Senha não encontrada")
        
        if senha.status not in ['aguardando', 'chamada']:
            raise ValueError("Apenas senhas aguardando ou chamadas podem ser canceladas")
        
        senha.status = 'cancelada'
        senha.observacoes = f"Cancelada: {motivo}"
        senha.atendente_id = atendente_id
        
        db.session.commit()
        
        return senha

    @staticmethod
    def calcular_tempo_medio_espera():
        """
        Calcula tempo médio de espera (em minutos)
        
        Returns:
            int: Tempo médio em minutos
        """
        hoje = date.today()
        
        # Buscar senhas atendidas hoje
        senhas = Senha.query.filter(
            func.date(Senha.emitida_em) == hoje,
            Senha.status.in_(['atendendo', 'concluida']),
            Senha.atendimento_iniciado_em.isnot(None)
        ).all()
        
        if not senhas:
            return 0
        
        # Calcular tempo de cada senha
        tempos = []
        for senha in senhas:
            delta = senha.atendimento_iniciado_em - senha.emitida_em
            minutos = delta.total_seconds() / 60
            tempos.append(minutos)
        
        # Retornar média arredondada
        return round(sum(tempos) / len(tempos))

    @staticmethod
    def obter_estatisticas_hoje():
        """
        Estatísticas completas do dia
        
        Returns:
            dict com estatísticas
        """
        hoje = date.today()
        
        # Query base: senhas de hoje
        query_hoje = Senha.query.filter(
            func.date(Senha.emitida_em) == hoje
        )
        
        # Contar por status
        total = query_hoje.count()
        aguardando = query_hoje.filter(Senha.status == 'aguardando').count()
        atendendo = query_hoje.filter(Senha.status == 'atendendo').count()
        concluidas = query_hoje.filter(Senha.status == 'concluida').count()
        canceladas = query_hoje.filter(Senha.status == 'cancelada').count()
        
        # Calcular tempo médio
        tempo_medio = SenhaService.calcular_tempo_medio_espera()
        
        return {
            'total_emitidas': total,
            'aguardando': aguardando,
            'atendendo': atendendo,
            'concluidas': concluidas,
            'canceladas': canceladas,
            'tempo_medio_espera': tempo_medio
        }

    @staticmethod
    def obter_estatisticas_trabalhador(atendente_id):
        """
        Estatísticas de um trabalhador específico hoje
        """
        hoje = date.today()
        
        # Senhas atendidas por este trabalhador hoje
        senhas = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            func.date(Senha.emitida_em) == hoje,
            Senha.status.in_(['atendendo', 'concluida'])
        ).all()
        
        # Contar concluídas
        concluidas = [s for s in senhas if s.status == 'concluida']
        atendidos_hoje = len(concluidas)
        
        # Calcular tempo médio de atendimento
        tempos_atendimento = []
        for senha in concluidas:
            if senha.tempo_atendimento_minutos:
                tempos_atendimento.append(senha.tempo_atendimento_minutos)
        
        tempo_medio = 0
        if tempos_atendimento:
            tempo_medio = round(sum(tempos_atendimento) / len(tempos_atendimento))
        
        # Senha em atendimento atual
        em_atendimento = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            Senha.status == 'atendendo'
        ).first()
        
        return {
            'atendidos_hoje': atendidos_hoje,
            'tempo_medio_atendimento': tempo_medio,
            'em_atendimento': em_atendimento
        }

    @staticmethod
    def finalizar_atendimento_anterior(atendente_id):
        """
        Finaliza automaticamente senha anterior do atendente
        """
        # Buscar senha em atendimento deste trabalhador
        senha_anterior = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            Senha.status == 'atendendo'
        ).first()
        
        if senha_anterior:
            # Marcar como concluída
            senha_anterior.finalizar()
            db.session.commit()
            
            print(f"✅ Senha {senha_anterior.numero} finalizada automaticamente")
        
        return senha_anterior
