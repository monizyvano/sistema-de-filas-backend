# ===== FASE 1: MODEL SENHA CORRIGIDO =====

"""
app/models/senha.py - VERSÃO PROFISSIONAL

MUDANÇAS:
1. ✅ Adiciona coluna data_emissao (Date)
2. ✅ Remove unique=True de numero
3. ✅ Adiciona __table_args__ com UNIQUE composto
4. ✅ Atualiza __init__() para aceitar data_emissao
5. ✅ Melhora to_dict() incluindo data_emissao

BACKUP ANTES DE APLICAR:
cp app/models/senha.py app/models/senha.py.backup.$(date +%Y%m%d_%H%M%S)
"""

from app.extensions import db
from app.extensions import bcrypt
from app.models.base import BaseModel
from datetime import datetime, date
from sqlalchemy import func


class Senha(BaseModel):
    """
    Model para senhas de atendimento
    
    Suporta numeração diária com UNIQUE composto (numero, data_emissao)
    Permite N001 repetir em dias diferentes mas impede no mesmo dia
    """
    
    __tablename__ = 'senhas'
    
    # ===== UNIQUE COMPOSTO - PERMITE REPETIÇÃO EM DIAS DIFERENTES =====
    __table_args__ = (
        db.UniqueConstraint('numero', 'data_emissao', name='uq_numero_data'),
        {'comment': 'Senhas de atendimento com numeração diária'}
    )
    
    # ===== CONSTANTES DE TIPO E STATUS =====
    TIPOS = ['normal', 'prioritaria']
    STATUS = ['aguardando', 'chamando', 'atendendo', 'concluida', 'cancelada']
    
    # ===== CAMPOS PRINCIPAIS =====
    
    # Número da senha (SEM unique individual - unique é composto)
    numero = db.Column(
        db.String(20),
        nullable=False,
        index=True,  # Mantém índice para busca rápida
        comment="Número da senha (ex: N001, P001)"
    )
    
    # Data de emissão - NOVA COLUNA (crítica para numeração diária)
    data_emissao = db.Column(
        db.Date,
        nullable=False,
        default=lambda: datetime.utcnow().date(),  # Lambda evita bug de valor fixo
        index=True,  # Índice para queries por data
        comment="Data da emissão (para controle de numeração diária)"
    )
    
    # Tipo da senha
    tipo = db.Column(
        db.String(20),
        nullable=False,
        default='normal',
        index=True,
        comment="Tipo: normal ou prioritaria"
    )
    
    # Status atual
    status = db.Column(
        db.String(20),
        nullable=False,
        default='aguardando',
        index=True,
        comment="Status: aguardando, chamando, atendendo, concluida, cancelada"
    )
    
    # ===== RELACIONAMENTOS =====
    servico_id = db.Column(
        db.Integer,
        db.ForeignKey('servicos.id'),
        nullable=False,
        index=True
    )
    
    atendente_id = db.Column(
        db.Integer,
        db.ForeignKey('atendentes.id'),
        nullable=True
    )
    
    # ===== DADOS DE ATENDIMENTO =====
    numero_balcao = db.Column(db.Integer, nullable=True)
    usuario_contato = db.Column(db.String(100), nullable=True)
    
    # ===== TIMESTAMPS =====
    emitida_em = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        index=True,
        comment="Data/hora de emissão (timestamp completo)"
    )
    
    chamada_em = db.Column(
        db.DateTime,
        nullable=True,
        comment="Data/hora que senha foi chamada"
    )
    
    atendimento_iniciado_em = db.Column(
        db.DateTime,
        nullable=True,
        comment="Data/hora início do atendimento"
    )
    
    atendimento_concluido_em = db.Column(
        db.DateTime,
        nullable=True,
        comment="Data/hora fim do atendimento"
    )
    
    # ===== MÉTRICAS CALCULADAS =====
    tempo_espera_minutos = db.Column(
        db.Integer,
        nullable=True,
        comment="Tempo entre emissão e início (em minutos)"
    )
    
    tempo_atendimento_minutos = db.Column(
        db.Integer,
        nullable=True,
        comment="Tempo entre início e fim (em minutos)"
    )
    
    # ===== OBSERVAÇÕES =====
    observacoes = db.Column(db.Text, nullable=True)
    
    # ===== RELACIONAMENTOS ORM =====
    # Relacionamentos ORM (sem backref para evitar conflito)
    servico = db.relationship('Servico', foreign_keys=[servico_id])
    atendente = db.relationship('Atendente', foreign_keys=[atendente_id])
    
    def __init__(self, numero, servico_id, tipo='normal', usuario_contato=None, data_emissao=None):
        """
        Inicializa nova senha
        
        Args:
            numero (str): Número da senha (ex: N001, P001)
            servico_id (int): ID do serviço
            tipo (str): 'normal' ou 'prioritaria'
            usuario_contato (str, optional): Contato do usuário
            data_emissao (date, optional): Data de emissão (default: hoje)
        """
        self.numero = numero
        self.servico_id = servico_id
        self.tipo = tipo
        self.usuario_contato = usuario_contato
        self.data_emissao = data_emissao or datetime.utcnow().date()
        self.status = 'aguardando'
        self.emitida_em = datetime.utcnow()
    
    
    def __repr__(self):
        """Representação em string"""
        return f'<Senha {self.numero} ({self.data_emissao}) - {self.status}>'
    
    
    def to_dict(self, include_relationships=True):
        """
        Converte para dicionário
        
        Args:
            include_relationships (bool): Incluir relacionamentos (servico, atendente)
            
        Returns:
            dict: Dados da senha serializados
        """
        data = {
            'id': self.id,
            'numero': self.numero,
            'data_emissao': self.data_emissao.isoformat() if self.data_emissao else None,
            'tipo': self.tipo,
            'status': self.status,
            'servico_id': self.servico_id,
            'atendente_id': self.atendente_id,
            'numero_balcao': self.numero_balcao,
            'usuario_contato': self.usuario_contato,
            'emitida_em': self.emitida_em.isoformat() if self.emitida_em else None,
            'chamada_em': self.chamada_em.isoformat() if self.chamada_em else None,
            'atendimento_iniciado_em': self.atendimento_iniciado_em.isoformat() if self.atendimento_iniciado_em else None,
            'atendimento_concluido_em': self.atendimento_concluido_em.isoformat() if self.atendimento_concluido_em else None,
            'tempo_espera_minutos': self.tempo_espera_minutos,
            'tempo_atendimento_minutos': self.tempo_atendimento_minutos,
            'observacoes': self.observacoes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Relacionamentos opcionais
        if include_relationships:
            if self.servico:
                data['servico'] = {
                    'id': self.servico.id,
                    'nome': self.servico.nome,
                    'icone': self.servico.icone
                }
            
            if self.atendente:
                data['atendente'] = {
                    'id': self.atendente.id,
                    'nome': self.atendente.nome
                }
        
        return data
    
    
    @classmethod
    def obter_por_numero_e_data(cls, numero, data_emissao=None):
        """
        Busca senha por número e data
        
        Args:
            numero (str): Número da senha (ex: N001)
            data_emissao (date, optional): Data (default: hoje)
            
        Returns:
            Senha: Objeto senha ou None
        """
        if data_emissao is None:
            data_emissao = datetime.utcnow().date()
        
        return cls.query.filter_by(
            numero=numero,
            data_emissao=data_emissao
        ).first()
    
    
    @classmethod
    def obter_fila_do_dia(cls, servico_id=None, data_emissao=None):
        """
        Retorna fila do dia ordenada (prioritárias primeiro)
        
        Args:
            servico_id (int, optional): Filtrar por serviço
            data_emissao (date, optional): Data (default: hoje)
            
        Returns:
            list[Senha]: Lista de senhas na fila
        """
        if data_emissao is None:
            data_emissao = datetime.utcnow().date()
        
        query = cls.query.filter_by(
            data_emissao=data_emissao,
            status='aguardando'
        )
        
        if servico_id:
            query = query.filter_by(servico_id=servico_id)
        
        # Ordenar: prioritárias primeiro, depois ordem de emissão
        return query.order_by(
            db.case(
                (cls.tipo == 'prioritaria', 0),
                else_=1
            ),
            cls.emitida_em
        ).all()
    # ===== MÉTODOS DE AÇÃO (ADICIONAR APÓS obter_fila_do_dia) =====
    
    def chamar(self, numero_balcao=None):
        """
        Chamar senha (muda status para 'chamada')
        
        Args:
            numero_balcao (int, optional): Número do balcão
            
        Raises:
            ValueError: Se senha não estiver aguardando
        """
        if self.status != 'aguardando':
            raise ValueError(f"Senha {self.numero} não está aguardando (status atual: {self.status})")
        
        self.status = 'chamada'
        self.chamada_em = datetime.utcnow()
        
        if numero_balcao:
            self.numero_balcao = numero_balcao
        
        db.session.commit()
    
    
    def iniciar_atendimento(self, atendente_id, numero_balcao=None):
        """
        Iniciar atendimento da senha
        
        Args:
            atendente_id (int): ID do atendente
            numero_balcao (int, optional): Número do balcão
            
        Raises:
            ValueError: Se senha não estiver chamada ou aguardando
        """
        if self.status not in ['aguardando', 'chamada']:
            raise ValueError(f"Senha {self.numero} não pode ser atendida (status: {self.status})")
        
        self.status = 'atendendo'
        self.atendente_id = atendente_id
        self.atendimento_iniciado_em = datetime.utcnow()
        
        if numero_balcao:
            self.numero_balcao = numero_balcao
        
        # Calcular tempo de espera
        if self.emitida_em:
            delta = self.atendimento_iniciado_em - self.emitida_em
            self.tempo_espera_minutos = int(delta.total_seconds() / 60)
        
        db.session.commit()
    
    
    def finalizar(self, observacoes=None):
        """
        Finalizar atendimento
        
        Args:
            observacoes (str, optional): Observações sobre o atendimento
            
        Raises:
            ValueError: Se senha não estiver em atendimento
        """
        if self.status != 'atendendo':
            raise ValueError(f"Senha {self.numero} não está em atendimento (status: {self.status})")
        
        self.status = 'concluida'
        self.atendimento_concluido_em = datetime.utcnow()
        
        if observacoes:
            self.observacoes = observacoes
        
        # Calcular tempo de atendimento
        if self.atendimento_iniciado_em:
            delta = self.atendimento_concluido_em - self.atendimento_iniciado_em
            self.tempo_atendimento_minutos = int(delta.total_seconds() / 60)
        
        db.session.commit()
    
    
    def cancelar(self, motivo, atendente_id=None):
        """
        Cancelar senha
        
        Args:
            motivo (str): Motivo do cancelamento
            atendente_id (int, optional): ID do atendente que cancelou
            
        Raises:
            ValueError: Se senha já estiver concluída
        """
        if self.status == 'concluida':
            raise ValueError(f"Senha {self.numero} já foi concluída, não pode ser cancelada")
        
        self.status = 'cancelada'
        self.observacoes = f"CANCELADA: {motivo}"
        
        if atendente_id:
            self.atendente_id = atendente_id
        
        db.session.commit()


# ===== INSTRUÇÕES DE APLICAÇÃO =====
if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║  APLICAR MODEL SENHA CORRIGIDO                               ║
╚══════════════════════════════════════════════════════════════╝

⚠️  IMPORTANTE: Faça backup antes!

PASSO 1: Backup
---------------
cd /caminho/do/projeto
cp app/models/senha.py app/models/senha.py.backup

PASSO 2: Substituir arquivo
----------------------------
# Copie TODO o conteúdo deste arquivo
# Cole em: app/models/senha.py
# Salve

PASSO 3: Verificar imports
---------------------------
Certifique-se que NO TOPO do arquivo tem:

from app import db
from app.models.base import BaseModel
from datetime import datetime, date
from sqlalchemy import func

PASSO 4: NÃO reiniciar servidor ainda
--------------------------------------
Model está pronto mas banco ainda não tem data_emissao!
Próximo passo: aplicar migration no banco

╔══════════════════════════════════════════════════════════════╗
║  MUDANÇAS NESTE MODEL                                        ║
╚══════════════════════════════════════════════════════════════╝

✅ Campo data_emissao adicionado
✅ __table_args__ com UNIQUE composto
✅ numero sem unique=True individual
✅ __init__() aceita data_emissao
✅ to_dict() inclui data_emissao
✅ Novos métodos helper (obter_por_numero_e_data, obter_fila_do_dia)
✅ Docstrings completas

PRÓXIMO ARQUIVO: 2_senha_service_corrigido.py
    """)
