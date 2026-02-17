"""
SenhaService - Lógica de negócio para senhas
Responsável por: emissão, validação, numeração automática
"""
from datetime import datetime
from app import db
from app.models import Senha, Servico, LogActividade
from sqlalchemy import func


class SenhaService:
    """
    Service para gerenciar senhas
    
    Methods:
        emitir(): Emite nova senha com numeração automática
        obter_por_id(): Busca senha por ID
        obter_por_numero(): Busca senha por número
        cancelar(): Cancela senha
        validar_dados_emissao(): Valida dados antes de emitir
    """
    
    @staticmethod
    def emitir(servico_id, tipo='normal', usuario_contato=None):
        """
        Emite nova senha
        
        Args:
            servico_id (int): ID do serviço
            tipo (str): normal ou prioritaria
            usuario_contato (str): Telefone opcional
        
        Returns:
            Senha: Senha criada
        
        Raises:
            ValueError: Se dados inválidos
        
        Example:
            >>> senha = SenhaService.emitir(servico_id=1, tipo='normal')
            >>> print(senha.numero)  # "N001"
        """
        # Validar dados
        SenhaService.validar_dados_emissao(servico_id, tipo)
        
        # Gerar número automático
        numero = SenhaService._gerar_proximo_numero(tipo)
        
        # Criar senha
        senha = Senha(
            numero=numero,
            servico_id=servico_id,
            tipo=tipo,
            usuario_contato=usuario_contato
        )
        senha.save()
        
        # Registrar log
        LogActividade.registrar(
            acao='emitida',
            senha_id=senha.id,
            descricao=f"Senha {senha.numero} emitida para serviço {senha.servico.nome}"
        )
        
        return senha
    
    @staticmethod
    def _gerar_proximo_numero(tipo):
        """
        Gera próximo número de senha (privado)
        
        Args:
            tipo (str): normal ou prioritaria
        
        Returns:
            str: Número da senha (ex: "N001", "P005")
        
        Logic:
            - Normal: N001, N002, N003...
            - Prioritária: P001, P002, P003...
            - Reinicia diariamente (N001 todo dia)
        """
        # Prefixo conforme tipo
        prefixo = 'P' if tipo == 'prioritaria' else 'N'
        
        # Buscar última senha do dia com este prefixo
        hoje = datetime.utcnow().date()
        
        ultima_senha = Senha.query.filter(
            Senha.numero.like(f'{prefixo}%'),
            func.date(Senha.created_at) == hoje
        ).order_by(Senha.id.desc()).first()
        
        if ultima_senha:
            # Extrair número: "N042" → 42
            numero_atual = int(ultima_senha.numero[1:])
            proximo_numero = numero_atual + 1
        else:
            # Primeira senha do dia
            proximo_numero = 1
        
        # Formatar: 1 → "N001", 42 → "N042"
        return f"{prefixo}{proximo_numero:03d}"
    
    @staticmethod
    def validar_dados_emissao(servico_id, tipo):
        """
        Valida dados antes de emitir senha
        
        Args:
            servico_id (int): ID do serviço
            tipo (str): Tipo da senha
        
        Raises:
            ValueError: Se dados inválidos
        """
        # Validar serviço existe
        servico = Servico.query.get(servico_id)
        if not servico:
            raise ValueError(f"Serviço com ID {servico_id} não existe")
        
        # Validar serviço está ativo
        if not servico.ativo:
            raise ValueError(f"Serviço '{servico.nome}' está inativo")
        
        # Validar tipo
        if tipo not in Senha.TIPOS:
            raise ValueError(f"Tipo '{tipo}' inválido. Use: {', '.join(Senha.TIPOS)}")
    
    @staticmethod
    def obter_por_id(senha_id):
        """
        Busca senha por ID
        
        Args:
            senha_id (int): ID da senha
        
        Returns:
            Senha: Senha encontrada ou None
        """
        return Senha.query.get(senha_id)
    
    @staticmethod
    def obter_por_numero(numero):
        """
        Busca senha por número
        
        Args:
            numero (str): Número da senha (ex: "N042")
        
        Returns:
            Senha: Senha encontrada ou None
        """
        return Senha.query.filter_by(numero=numero).first()
    
    @staticmethod
    def cancelar(senha_id, motivo=None, atendente_id=None):
        """
        Cancela uma senha
        
        Args:
            senha_id (int): ID da senha
            motivo (str): Motivo do cancelamento
            atendente_id (int): ID do atendente (opcional)
        
        Returns:
            Senha: Senha cancelada
        
        Raises:
            ValueError: Se senha não pode ser cancelada
        """
        senha = SenhaService.obter_por_id(senha_id)
        
        if not senha:
            raise ValueError(f"Senha {senha_id} não existe")
        
        if senha.status in ['concluida', 'cancelada']:
            raise ValueError(f"Senha {senha.numero} já está {senha.status}")
        
        # Cancelar
        senha.cancelar(motivo)
        
        # Registrar log
        LogActividade.registrar(
            acao='cancelada',
            senha_id=senha.id,
            atendente_id=atendente_id,
            descricao=f"Senha {senha.numero} cancelada. Motivo: {motivo or 'Não informado'}"
        )
        
        return senha
    
    @staticmethod
    def obter_estatisticas_hoje():
        """
        Retorna estatísticas de senhas do dia
        
        Returns:
            dict: Estatísticas
        """
        hoje = datetime.utcnow().date()
        
        return {
            'total_emitidas': Senha.query.filter(
                func.date(Senha.created_at) == hoje
            ).count(),
            'aguardando': Senha.query.filter_by(status='aguardando').count(),
            'atendendo': Senha.query.filter_by(status='atendendo').count(),
            'concluidas': Senha.query.filter(
                Senha.status == 'concluida',
                func.date(Senha.atendimento_concluido_em) == hoje
            ).count(),
            'canceladas': Senha.query.filter(
                Senha.status == 'cancelada',
                func.date(Senha.updated_at) == hoje
            ).count()
        }
