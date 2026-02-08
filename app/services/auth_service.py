"""
AuthService - Lógica de autenticação e autorização
Responsável por: login, JWT, verificação de permissões
"""
from datetime import datetime, timedelta
from flask_jwt_extended import create_access_token, create_refresh_token
from app.models import Atendente, LogActividade


class AuthService:
    """
    Service para autenticação
    
    Methods:
        login(): Autentica atendente
        verificar_credenciais(): Valida email/senha
        criar_tokens_jwt(): Gera tokens
        registrar_atendente(): Cria novo atendente (admin only)
    """
    
    @staticmethod
    def login(email, senha, ip_address=None):
        """
        Autentica atendente
        
        Args:
            email (str): Email do atendente
            senha (str): Senha em texto plano
            ip_address (str): IP do cliente
        
        Returns:
            dict: {
                'atendente': {...},
                'access_token': '...',
                'refresh_token': '...'
            }
        
        Raises:
            ValueError: Se credenciais inválidas
        
        Example:
            >>> resultado = AuthService.login('admin@imtsb.ao', 'admin123')
            >>> print(resultado['access_token'])
        """
        # Verificar credenciais
        atendente = AuthService.verificar_credenciais(email, senha)
        
        # Atualizar último login
        atendente.registrar_login()
        
        # Gerar tokens JWT
        tokens = AuthService.criar_tokens_jwt(atendente)
        
        # Registrar log
        LogActividade.registrar(
            acao='login',
            atendente_id=atendente.id,
            descricao=f"Login realizado: {atendente.nome}",
            ip_address=ip_address
        )
        
        return {
            'atendente': atendente.to_dict(),
            'access_token': tokens['access_token'],
            'refresh_token': tokens['refresh_token']
        }
    
    @staticmethod
    def verificar_credenciais(email, senha):
        """
        Verifica se email/senha estão corretos
        
        Args:
            email (str): Email
            senha (str): Senha
        
        Returns:
            Atendente: Atendente autenticado
        
        Raises:
            ValueError: Se credenciais inválidas
        """
        # Buscar atendente por email
        atendente = Atendente.query.filter_by(email=email.lower()).first()
        
        if not atendente:
            raise ValueError("Email ou senha incorretos")
        
        # Verificar se está ativo
        if not atendente.ativo:
            raise ValueError("Atendente inativo. Contacte o administrador.")
        
        # Verificar senha
        if not atendente.verificar_senha(senha):
            raise ValueError("Email ou senha incorretos")
        
        return atendente
    
    @staticmethod
    def criar_tokens_jwt(atendente):
        """
        Cria tokens JWT para atendente
        
        Args:
            atendente (Atendente): Atendente autenticado
        
        Returns:
            dict: {
                'access_token': '...',
                'refresh_token': '...'
            }
        """
        # Claims adicionais (payload do JWT)
        additional_claims = {
            'tipo': atendente.tipo,
            'balcao': atendente.balcao,
            'nome': atendente.nome
        }
        
        # Access token (expira em 1 hora)
        access_token = create_access_token(
            identity=atendente.id,
            additional_claims=additional_claims,
            expires_delta=timedelta(hours=1)
        )
        
        # Refresh token (expira em 7 dias)
        refresh_token = create_refresh_token(
            identity=atendente.id,
            expires_delta=timedelta(days=7)
        )
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token
        }
    
    @staticmethod
    def registrar_atendente(dados, admin_id):
        """
        Registra novo atendente (apenas admin)
        
        Args:
            dados (dict): {nome, email, senha, tipo, balcao}
            admin_id (int): ID do admin que está criando
        
        Returns:
            Atendente: Atendente criado
        
        Raises:
            ValueError: Se dados inválidos ou sem permissão
        """
        # Verificar se quem está criando é admin
        admin = Atendente.query.get(admin_id)
        if not admin or admin.tipo != 'admin':
            raise ValueError("Apenas administradores podem criar atendentes")
        
        # Verificar se email já existe
        existe = Atendente.query.filter_by(email=dados['email'].lower()).first()
        if existe:
            raise ValueError(f"Email {dados['email']} já cadastrado")
        
        # Criar atendente
        atendente = Atendente(
            nome=dados['nome'],
            email=dados['email'],
            senha=dados['senha'],
            tipo=dados.get('tipo', 'atendente'),
            balcao=dados.get('balcao')
        )
        atendente.save()
        
        # Registrar log
        LogActividade.registrar(
            acao='atendente_criado',
            atendente_id=admin_id,
            descricao=f"Atendente {atendente.nome} criado por {admin.nome}"
        )
        
        return atendente
    
    @staticmethod
    def verificar_permissao_admin(atendente_id):
        """
        Verifica se atendente é admin
        
        Args:
            atendente_id (int): ID do atendente
        
        Returns:
            bool: True se admin
        """
        atendente = Atendente.query.get(atendente_id)
        return atendente and atendente.tipo == 'admin'
