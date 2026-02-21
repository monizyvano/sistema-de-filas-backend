import time
import uuid
from flask import g, request
from functools import wraps


def log_request(app):
    """Middleware para logar todas as requisições"""
    
    @app.before_request
    def before_request():
        g.start_time = time.time()
        g.request_id = str(uuid.uuid4())
        request.request_id = g.request_id
    
    @app.after_request
    def after_request(response):
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            
            app.logger.info('Request completed', extra={
                'request_id': g.request_id,
                'method': request.method,
                'path': request.path,
                'status': response.status_code,
                'duration_ms': round(duration * 1000, 2),
                'ip': request.remote_addr,
                'user_agent': request.user_agent.string
            })
        
        # Adicionar request_id no header
        response.headers['X-Request-ID'] = g.get('request_id', 'unknown')
        
        return response