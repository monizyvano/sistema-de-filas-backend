"""
Senha Service - FIX EMITIDA_EM
app/services/senha_service.py

✅ FIX: Garantir que emitida_em sempre seja preenchido
✅ Preencher data_emissao também
"""

from app.models.senha import Senha
from app.models.servico import Servico
from app.extensions import db
from datetime import date, datetime
from sqlalchemy import func


class SenhaService:
    """Serviço para gerenciamento de senhas"""

    @staticmethod
    def emitir_senha(servico_id, tipo='normal', usuario_contato=None):
        """
        ✅ FIX: Sempre preenche emitida_em e data_emissao
        
        Emite uma nova senha
        
        Args:
            servico_id: ID do serviço
            tipo: 'normal' ou 'prioritaria'
            usuario_contato: Contato do usuário (opcional)
            
        Returns:
            Senha: Nova senha emitida
        """
        # Validar serviço
        servico = Servico.query.get(servico_id)
        if not servico:
            raise ValueError(f"Serviço {servico_id} não encontrado")
        
        # Obter hoje
        hoje = date.today()
        agora = datetime.now()  # ✅ FIX: Pegar timestamp completo
        
        # Gerar número da senha
        # Contar senhas emitidas hoje para este serviço
        contador = Senha.query.filter(
            func.date(Senha.emitida_em) == hoje,
            Senha.servico_id == servico_id
        ).count() + 1
        
        # Formato: N001, N002, P001 (P para prioritária)
        prefixo = 'P' if tipo == 'prioritaria' else 'N'
        numero = f"{prefixo}{contador:03d}"
        
        print(f"\n[DEBUG emitir_senha]")
        print(f"  Serviço: {servico.nome} (ID: {servico_id})")
        print(f"  Tipo: {tipo}")
        print(f"  Número gerado: {numero}")
        print(f"  Data: {hoje}")
        print(f"  Timestamp: {agora}")
        
        # Criar senha
        senha = Senha(
            numero=numero,
            tipo=tipo,
            servico_id=servico_id,
            usuario_contato=usuario_contato,
            status='aguardando',
            emitida_em=agora,        # ✅ FIX: SEMPRE PREENCHER!
            data_emissao=hoje        # ✅ FIX: SEMPRE PREENCHER!
        )
        
        db.session.add(senha)
        db.session.commit()
        
        print(f"✅ Senha {numero} emitida com sucesso!")
        print(f"   ID: {senha.id}")
        print(f"   Status: {senha.status}")
        print(f"   Emitida em: {senha.emitida_em}")
        print(f"   Data emissão: {senha.data_emissao}\n")
        
        return senha

    @staticmethod
    def listar_senhas(status=None, servico_id=None, atendente_id=None, data_emissao=None):
        """
        Lista senhas com filtros opcionais
        
        Args:
            status: Filtrar por status
            servico_id: Filtrar por serviço
            atendente_id: Filtrar por atendente
            data_emissao: Filtrar por data de emissão
            
        Returns:
            List[Senha]: Lista de senhas
        """
        query = Senha.query
        
        if status:
            query = query.filter(Senha.status == status)
        
        if servico_id:
            query = query.filter(Senha.servico_id == servico_id)
        
        if atendente_id:
            query = query.filter(Senha.atendente_id == atendente_id)
        
        if data_emissao:
            query = query.filter(func.date(Senha.emitida_em) == data_emissao)
        
        return query.order_by(Senha.created_at.desc()).all()

    @staticmethod
    def obter_senha(senha_id):
        """
        Obtém uma senha por ID
        
        Args:
            senha_id: ID da senha
            
        Returns:
            Senha: Senha encontrada
        """
        senha = Senha.query.get(senha_id)
        if not senha:
            raise ValueError(f"Senha {senha_id} não encontrada")
        return senha

    @staticmethod
    def cancelar_senha(senha_id, motivo=None):
        """
        Cancela uma senha
        
        Args:
            senha_id: ID da senha
            motivo: Motivo do cancelamento (opcional)
            
        Returns:
            Senha: Senha cancelada
        """
        senha = SenhaService.obter_senha(senha_id)
        
        if senha.status != 'aguardando':
            raise ValueError(f"Apenas senhas aguardando podem ser canceladas")
        
        senha.status = 'cancelada'
        if motivo:
            senha.observacoes = motivo
        
        db.session.commit()
        
        return senha

    @staticmethod
    def obter_estatisticas_hoje():
        """
        ✅ FIX: Filtro de data mais permissivo
        
        Obtém estatísticas do dia atual
        
        Returns:
            dict: Estatísticas
        """
        from datetime import timedelta
        
        hoje = date.today()
        ontem = hoje - timedelta(days=1)
        
        # ✅ FIX: Aceita senhas de hoje OU com emitida_em NULL
        query_base = Senha.query.filter(
            db.or_(
                func.date(Senha.emitida_em) == hoje,
                Senha.emitida_em.is_(None)
            )
        )
        
        # Total emitidas
        total_emitidas = query_base.count()
        
        # Por status
        aguardando = query_base.filter(Senha.status == 'aguardando').count()
        atendendo = query_base.filter(Senha.status == 'atendendo').count()
        concluidas = query_base.filter(Senha.status == 'concluida').count()
        canceladas = query_base.filter(Senha.status == 'cancelada').count()
        
        # Tempo médio de espera
        senhas_atendidas = query_base.filter(
            Senha.status.in_(['atendendo', 'concluida']),
            Senha.atendimento_iniciado_em.isnot(None)
        ).all()
        
        tempos_espera = []
        for senha in senhas_atendidas:
            if senha.tempo_espera_minutos:
                tempos_espera.append(senha.tempo_espera_minutos)
        
        tempo_medio_espera = 0
        if tempos_espera:
            tempo_medio_espera = round(sum(tempos_espera) / len(tempos_espera))
        
        # Tempo médio de atendimento
        senhas_concluidas = query_base.filter(
            Senha.status == 'concluida',
            Senha.tempo_atendimento_minutos.isnot(None)
        ).all()
        
        tempos_atendimento = []
        for senha in senhas_concluidas:
            if senha.tempo_atendimento_minutos:
                tempos_atendimento.append(senha.tempo_atendimento_minutos)
        
        tempo_medio_atendimento = 0
        if tempos_atendimento:
            tempo_medio_atendimento = round(sum(tempos_atendimento) / len(tempos_atendimento))
        
        return {
            'total_emitidas': total_emitidas,
            'aguardando': aguardando,
            'atendendo': atendendo,
            'concluidas': concluidas,
            'canceladas': canceladas,
            'tempo_medio_espera': tempo_medio_espera,
            'tempo_medio_atendimento': tempo_medio_atendimento
        }

    @staticmethod
    def obter_estatisticas_atendente(atendente_id):
        """
        Estatísticas de um atendente no dia
        
        Args:
            atendente_id: ID do atendente
            
        Returns:
            dict: Estatísticas do atendente
        """
        from datetime import timedelta
        
        hoje = date.today()
        ontem = hoje - timedelta(days=1)
        
        # Senhas atendidas hoje
        query_base = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            db.or_(
                func.date(Senha.emitida_em) == hoje,
                Senha.emitida_em.is_(None)
            ),
            Senha.status.in_(['atendendo', 'concluida'])
        )
        
        atendidos_hoje = query_base.count()
        
        # Tempo médio de atendimento
        senhas_concluidas = query_base.filter(
            Senha.status == 'concluida'
        ).all()
        
        tempos_atendimento = []
        for senha in senhas_concluidas:
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
        
        # ✅ SERIALIZAR OBJETO SENHA PARA DICT
        em_atendimento_dict = None
        if em_atendimento:
            em_atendimento_dict = em_atendimento.to_dict()
        
        # Aguardando no sistema
        aguardando = Senha.query.filter(
            db.or_(
                func.date(Senha.emitida_em) == hoje,
                Senha.emitida_em.is_(None)
            ),
            Senha.status == 'aguardando'
        ).count()
        
        return {
            'atendidos_hoje': atendidos_hoje,
            'tempo_medio_atendimento': tempo_medio,
            'em_atendimento': em_atendimento_dict,
            'aguardando': aguardando
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
