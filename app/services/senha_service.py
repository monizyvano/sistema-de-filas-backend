"""
Senha Service - FIX NOME DO MÉTODO
app/services/senha_service.py

✅ FIX: Renomear obter_estatisticas_atendente → obter_estatisticas_trabalhador
✅ Manter emitida_em sempre preenchido
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
        """
        # Validar serviço
        servico = Servico.query.get(servico_id)
        if not servico:
            raise ValueError(f"Serviço {servico_id} não encontrado")
        
        # Obter hoje
        hoje = date.today()
        agora = datetime.now()  # ✅ FIX: Pegar timestamp completo
        
        # Gerar número da senha
        contador = Senha.query.filter(
            func.date(Senha.emitida_em) == hoje,
            Senha.servico_id == servico_id
        ).count() + 1
        
        # Formato: N001, N002, P001 (P para prioritária)
        prefixo = 'P' if tipo == 'prioritaria' else 'N'
        numero = f"{prefixo}{contador:03d}"
        
        print(f"\n[DEBUG emitir_senha]")
        print(f"  Serviço: {servico.nome} (ID: {servico_id})")
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
        print(f"   Emitida em: {senha.emitida_em}\n")
        
        return senha

    @staticmethod
    def emitir(servico_id, tipo='normal', usuario_contato=None):
        """Alias retrocompatível para emissão de senha."""
        return SenhaService.emitir_senha(
            servico_id=servico_id,
            tipo=tipo,
            usuario_contato=usuario_contato,
        )

    @staticmethod
    def listar_senhas(status=None, servico_id=None, atendente_id=None, data_emissao=None):
        """Lista senhas com filtros opcionais"""
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
        """Obtém uma senha por ID"""
        senha = Senha.query.get(senha_id)
        if not senha:
            raise ValueError(f"Senha {senha_id} não encontrada")
        return senha

    @staticmethod
    def obter_por_id(senha_id):
        """Alias retrocompatível para busca por ID."""
        return Senha.query.get(senha_id)

    @staticmethod
    def obter_por_numero(numero):
        """Alias retrocompatível para busca por número."""
        return Senha.query.filter(Senha.numero == numero).first()

    @staticmethod
    def cancelar_senha(senha_id, motivo=None):
        """Cancela uma senha"""
        senha = SenhaService.obter_senha(senha_id)
        
        if senha.status != 'aguardando':
            raise ValueError(f"Apenas senhas aguardando podem ser canceladas")
        
        senha.status = 'cancelada'
        if motivo:
            senha.observacoes = motivo
        
        db.session.commit()

        return senha

    @staticmethod
    def cancelar(senha_id, motivo=None, atendente_id=None):
        """Alias retrocompatível para cancelamento de senha."""
        _ = atendente_id
        return SenhaService.cancelar_senha(senha_id=senha_id, motivo=motivo)

    @staticmethod
    def obter_estatisticas_hoje():
        """Obtém estatísticas do dia atual"""
        hoje = date.today()
        
        query_base = Senha.query.filter(
            func.date(Senha.emitida_em) == hoje
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
    def obter_estatisticas_trabalhador(atendente_id):
        """
        ✅ FIX: Nome correto do método!
        
        Estatísticas de um trabalhador/atendente no dia
        """
        hoje = date.today()
        
        # Senhas atendidas hoje
        query_base = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            func.date(Senha.emitida_em) == hoje,
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
            func.date(Senha.emitida_em) == hoje,
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
        """Finaliza automaticamente senha anterior do atendente"""
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
