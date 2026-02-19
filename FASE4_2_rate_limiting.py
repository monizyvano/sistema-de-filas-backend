# ===== FASE 4.2: RATE LIMITING =====

"""
app/utils/rate_limiter.py - NOVO ARQUIVO

Sistema de rate limiting para prevenir spam e ataques DDoS

CRIAR EM: app/utils/rate_limiter.py
"""

from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
import time


class RateLimiter:
    """
    Rate limiter em memória
    
    Limita número de requisições por IP em uma janela de tempo
    """
    
    # Armazena: { 'IP': {'count': X, 'reset_time': datetime} }
    _requests = {}
    
    # Configurações padrão
    DEFAULT_LIMIT = 100  # requests
    DEFAULT_WINDOW = 60  # segundos
    
    
    @classmethod
    def _get_client_ip(cls):
        """Obtém IP do cliente"""
        # Tentar X-Forwarded-For primeiro (se atrás de proxy)
        if request.headers.get('X-Forwarded-For'):
            return request.headers.get('X-Forwarded-For').split(',')[0].strip()
        
        # Senão, usar IP direto
        return request.remote_addr or 'unknown'
    
    
    @classmethod
    def _clean_old_entries(cls):
        """Remove entradas expiradas (garbage collection)"""
        now = time.time()
        expired_ips = [
            ip for ip, data in cls._requests.items()
            if now > data['reset_time']
        ]
        
        for ip in expired_ips:
            del cls._requests[ip]
    
    
    @classmethod
    def is_allowed(cls, ip: str = None, limit: int = None, window: int = None) -> tuple:
        """
        Verifica se requisição é permitida
        
        Args:
            ip: IP do cliente (None = auto-detectar)
            limit: Número máximo de requisições
            window: Janela de tempo em segundos
            
        Returns:
            (permitido: bool, info: dict)
        """
        if ip is None:
            ip = cls._get_client_ip()
        
        if limit is None:
            limit = cls.DEFAULT_LIMIT
        
        if window is None:
            window = cls.DEFAULT_WINDOW
        
        # Limpar entradas antigas
        cls._clean_old_entries()
        
        now = time.time()
        
        # Se IP não está no tracking, adicionar
        if ip not in cls._requests:
            cls._requests[ip] = {
                'count': 1,
                'reset_time': now + window,
                'first_request': now
            }
            
            return True, {
                'limit': limit,
                'remaining': limit - 1,
                'reset': int(now + window)
            }
        
        # Se passou do tempo de reset, resetar contador
        if now > cls._requests[ip]['reset_time']:
            cls._requests[ip] = {
                'count': 1,
                'reset_time': now + window,
                'first_request': now
            }
            
            return True, {
                'limit': limit,
                'remaining': limit - 1,
                'reset': int(now + window)
            }
        
        # Incrementar contador
        cls._requests[ip]['count'] += 1
        
        # Verificar se excedeu limite
        if cls._requests[ip]['count'] > limit:
            return False, {
                'limit': limit,
                'remaining': 0,
                'reset': int(cls._requests[ip]['reset_time']),
                'retry_after': int(cls._requests[ip]['reset_time'] - now)
            }
        
        # Ainda dentro do limite
        return True, {
            'limit': limit,
            'remaining': limit - cls._requests[ip]['count'],
            'reset': int(cls._requests[ip]['reset_time'])
        }
    
    
    @classmethod
    def reset(cls, ip: str = None):
        """Reseta contador para um IP"""
        if ip is None:
            ip = cls._get_client_ip()
        
        if ip in cls._requests:
            del cls._requests[ip]
    
    
    @classmethod
    def get_stats(cls) -> dict:
        """Retorna estatísticas do rate limiter"""
        cls._clean_old_entries()
        
        return {
            'total_ips': len(cls._requests),
            'active_requests': sum(data['count'] for data in cls._requests.values())
        }


# ===== DECORATOR PARA USAR EM ROTAS =====

def rate_limit(limit=100, window=60, key_prefix='general'):
    """
    Decorator para aplicar rate limiting em rotas
    
    Args:
        limit: Número máximo de requisições
        window: Janela de tempo em segundos
        key_prefix: Prefixo para diferenciar limitadores
        
    Example:
        @app.route('/api/senhas', methods=['POST'])
        @rate_limit(limit=10, window=60)  # 10 req/min
        def emitir_senha():
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Verificar se permitido
            allowed, info = RateLimiter.is_allowed(limit=limit, window=window)
            
            # Adicionar headers de rate limit na resposta
            def add_headers(response):
                response.headers['X-RateLimit-Limit'] = str(info['limit'])
                response.headers['X-RateLimit-Remaining'] = str(info['remaining'])
                response.headers['X-RateLimit-Reset'] = str(info['reset'])
                
                if not allowed:
                    response.headers['Retry-After'] = str(info['retry_after'])
                
                return response
            
            # Se não permitido, retornar erro
            if not allowed:
                response = jsonify({
                    'erro': 'Taxa de requisições excedida',
                    'mensagem': f'Limite de {limit} requisições por {window}s excedido',
                    'retry_after': info['retry_after']
                })
                response.status_code = 429
                return add_headers(response)
            
            # Executar função normalmente
            response = func(*args, **kwargs)
            
            # Se resposta já é um objeto Response, adicionar headers
            if hasattr(response, 'headers'):
                return add_headers(response)
            
            # Se resposta é tuple (data, status), converter para Response
            from flask import make_response
            response = make_response(response)
            return add_headers(response)
        
        return wrapper
    return decorator


# ===== EXEMPLO DE USO =====

EXEMPLO_USO = """
# app/controllers/senha_controller.py

from app.utils.rate_limiter import rate_limit

@senha_bp.route('/senhas', methods=['POST'])
@rate_limit(limit=10, window=60)  # 10 emissões por minuto
def emitir_senha():
    # ... código de emissão ...
    pass


@senha_bp.route('/filas/<int:servico_id>', methods=['GET'])
@rate_limit(limit=30, window=60)  # 30 consultas por minuto
def buscar_fila(servico_id):
    # ... código de busca ...
    pass


@auth_bp.route('/login', methods=['POST'])
@rate_limit(limit=5, window=300)  # 5 tentativas de login por 5 minutos
def login():
    # ... código de login ...
    pass
"""


# ===== TESTE DO RATE LIMITER =====

def testar_rate_limiter():
    """Testa o rate limiter"""
    print("\n🧪 TESTANDO RATE LIMITER\n")
    
    # Limpar estado
    RateLimiter._requests.clear()
    
    # Teste 1: Requisições normais
    print("TESTE 1: Requisições dentro do limite")
    for i in range(5):
        allowed, info = RateLimiter.is_allowed(
            ip='192.168.1.100',
            limit=10,
            window=60
        )
        print(f"  Req {i+1}: {'✅ Permitida' if allowed else '❌ Bloqueada'} "
              f"- Restantes: {info['remaining']}")
    
    assert allowed, "Deveria permitir 5 requisições!"
    
    # Teste 2: Exceder limite
    print("\nTESTE 2: Exceder limite")
    for i in range(7):  # Mais 7 = total 12 (excede 10)
        allowed, info = RateLimiter.is_allowed(
            ip='192.168.1.100',
            limit=10,
            window=60
        )
    
    print(f"  12ª requisição: {'✅ Permitida' if allowed else '❌ Bloqueada'}")
    print(f"  Retry after: {info.get('retry_after', 0)}s")
    
    assert not allowed, "Deveria bloquear após 10 requisições!"
    
    # Teste 3: IPs diferentes
    print("\nTESTE 3: IPs diferentes têm limites separados")
    allowed1, _ = RateLimiter.is_allowed(ip='192.168.1.101', limit=5, window=60)
    allowed2, _ = RateLimiter.is_allowed(ip='192.168.1.102', limit=5, window=60)
    
    print(f"  IP 101: {'✅ Permitida' if allowed1 else '❌ Bloqueada'}")
    print(f"  IP 102: {'✅ Permitida' if allowed2 else '❌ Bloqueada'}")
    
    assert allowed1 and allowed2, "IPs diferentes devem ser independentes!"
    
    # Teste 4: Reset manual
    print("\nTESTE 4: Reset manual")
    RateLimiter.reset(ip='192.168.1.100')
    allowed, info = RateLimiter.is_allowed(ip='192.168.1.100', limit=10, window=60)
    
    print(f"  Após reset: {'✅ Permitida' if allowed else '❌ Bloqueada'}")
    print(f"  Restantes: {info['remaining']}")
    
    assert allowed, "Após reset deveria permitir!"
    
    # Teste 5: Estatísticas
    print("\nTESTE 5: Estatísticas")
    stats = RateLimiter.get_stats()
    print(f"  Total IPs: {stats['total_ips']}")
    print(f"  Requisições ativas: {stats['active_requests']}")
    
    print("\n✅ TODOS OS TESTES PASSARAM!\n")


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║  FASE 4.2 - RATE LIMITING                                    ║
╚══════════════════════════════════════════════════════════════╝

CRIAR ARQUIVO:
────────────────────────────────────────────────────────────────
app/utils/rate_limiter.py

Cole o código acima (classe RateLimiter + decorator)

LIMITES RECOMENDADOS:
────────────────────────────────────────────────────────────────
Emissão de senha:      10 req/min
Buscar fila:           30 req/min
Estatísticas:          20 req/min
Login:                 5 req/5min (prevenir brute force)
Endpoints públicos:    100 req/min

USO:
────────────────────────────────────────────────────────────────
@rate_limit(limit=10, window=60)
def minha_rota():
    pass

HEADERS DE RESPOSTA:
────────────────────────────────────────────────────────────────
X-RateLimit-Limit:      100
X-RateLimit-Remaining:  95
X-RateLimit-Reset:      1708300800
Retry-After:            45 (se bloqueado)

BENEFÍCIOS:
────────────────────────────────────────────────────────────────
✅ Previne spam de emissão de senhas
✅ Protege contra ataques DDoS
✅ Previne brute force em login
✅ Controla carga no servidor
✅ Headers informativos para frontend

PRÓXIMO: FASE4_3_aplicar_validacoes.py
    """)
    
    # Executar testes
    testar_rate_limiter()
