"""
app/services/senha_service.py — CORRIGIDO
Fix: emitir_senha aceita e guarda o campo observacoes.
"""

from datetime import datetime, date
from sqlalchemy import func, or_
from app.extensions import db
from app.models.senha import Senha
from app.models.log_actividade import LogActividade


class SenhaService:

    @staticmethod
    def emitir_senha(servico_id: int, tipo: str = 'normal',
                     usuario_contato: str = None, utente_id: int = None,
                     observacoes: str = None) -> Senha:
        """Cria e persiste nova senha. Aceita observacoes do formulário."""
        hoje    = datetime.utcnow().date()
        prefixo = 'P' if tipo == 'prioritaria' else 'N'

        contagem = Senha.query.filter(
            Senha.data_emissao == hoje,
            Senha.numero.like(f'{prefixo}%')
        ).count()

        numero = f"{prefixo}{str(contagem + 1).zfill(3)}"

        senha = Senha(
            numero=numero,
            servico_id=servico_id,
            tipo=tipo,
            usuario_contato=usuario_contato,
            data_emissao=hoje,
            utente_id=utente_id
        )

        # Guardar dados do formulário nas observações
        if observacoes:
            senha.observacoes = observacoes

        db.session.add(senha)
        db.session.commit()
        db.session.refresh(senha)

        print(f"\n[SenhaService] Emitida: {senha.numero} | Serviço: {servico_id} | Tipo: {tipo}")
        return senha

    @staticmethod
    def listar_senhas(atendente_id=None, status=None, servico_id=None, limite=500):
        query = Senha.query
        if atendente_id: query = query.filter(Senha.atendente_id == atendente_id)
        if status:       query = query.filter(Senha.status == status)
        if servico_id:   query = query.filter(Senha.servico_id == servico_id)
        return query.order_by(Senha.created_at.desc()).limit(limite).all()

    @staticmethod
    def listar_senhas_paginado(atendente_id=None, status=None, servico_id=None, page=1, per_page=15):
        query = Senha.query
        if atendente_id: query = query.filter(Senha.atendente_id == atendente_id)
        if status:       query = query.filter(Senha.status == status)
        if servico_id:   query = query.filter(Senha.servico_id == servico_id)
        return query.order_by(Senha.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    @staticmethod
    def obter_por_id(senha_id):
        return Senha.query.get(senha_id)

    @staticmethod
    def obter_por_numero(numero):
        hoje = date.today()
        return Senha.query.filter(
            Senha.numero == numero,
            func.date(Senha.emitida_em) == hoje
        ).first()

    @staticmethod
    def cancelar(senha_id, motivo, atendente_id):
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            raise ValueError("Senha não encontrada")
        if senha.status != 'aguardando':
            raise ValueError("Apenas senhas aguardando podem ser canceladas")
        senha.status = 'cancelada'
        if motivo:
            senha.observacoes = (senha.observacoes or "") + f" | CANCELADA: {motivo}"
        try:
            db.session.add(LogActividade(
                acao='cancelada', senha_id=senha.id, atendente_id=atendente_id,
                descricao=f'Senha {senha.numero} cancelada. Motivo: {motivo}'
            ))
        except Exception:
            pass
        db.session.commit()
        db.session.refresh(senha)
        return senha

    @staticmethod
    def obter_estatisticas_hoje(data=None):
        if data is None:
            data = datetime.utcnow().date()
        q = Senha.query.filter(
            or_(Senha.data_emissao == data, func.date(Senha.emitida_em) == data)
        )
        total      = q.count()
        aguardando = q.filter(Senha.status == 'aguardando').count()
        atendendo  = q.filter(Senha.status == 'atendendo').count()
        concluidas = q.filter(Senha.status == 'concluida').count()
        canceladas = q.filter(Senha.status == 'cancelada').count()
        tempos     = [s.tempo_espera_minutos for s in
                      q.filter(Senha.status.in_(['atendendo','concluida']),
                               Senha.tempo_espera_minutos.isnot(None)).all()]
        return {
            'data': data.isoformat(),
            'total_emitidas': total, 'aguardando': aguardando,
            'atendendo': atendendo, 'concluidas': concluidas,
            'canceladas': canceladas,
            'tempo_medio_espera': round(sum(tempos)/len(tempos), 1) if tempos else 0
        }

    @staticmethod
    def obter_estatisticas_trabalhador(atendente_id):
        hoje       = datetime.utcnow().date()
        senhas     = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            or_(Senha.data_emissao == hoje, func.date(Senha.emitida_em) == hoje)
        ).all()
        atendidos  = [s for s in senhas if s.status == 'concluida']
        tempos     = [s.tempo_atendimento_minutos for s in atendidos if s.tempo_atendimento_minutos]
        aguardando = Senha.query.filter(Senha.status == 'aguardando').count()
        return {
            'atendidos_hoje': len(atendidos),
            'tempo_medio_atendimento': round(sum(tempos)/len(tempos), 1) if tempos else 0,
            'aguardando': aguardando
        }