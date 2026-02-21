import logging
import json
from datetime import datetime
from flask import request, has_request_context


class JsonFormatter(logging.Formatter):
    """Formata logs como JSON"""
    
    def format(self, record):
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Adicionar contexto da requisição se disponível
        if has_request_context():
            log_data.update({
                'request_id': getattr(request, 'request_id', None),
                'method': request.method,
                'path': request.path,
                'ip': request.remote_addr
            })
        
        # Adicionar exceção se existir
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_data)


def setup_logging(app):
    """Configura sistema de logs"""
    
    # Criar diretório de logs
    import os
    os.makedirs('logs', exist_ok=True)
    
    # Handler para arquivo (JSON)
    file_handler = logging.FileHandler('logs/app.log')
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(JsonFormatter())
    
    # Handler para console (texto)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG if app.debug else logging.INFO)
    console_handler.setFormatter(
        logging.Formatter('[%(levelname)s] %(name)s: %(message)s')
    )
    
    # Configurar logger da aplicação
    app.logger.setLevel(logging.DEBUG if app.debug else logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
    
    # Log de inicialização
    app.logger.info('Sistema de logs inicializado', extra={
        'environment': app.config.get('ENV', 'unknown')
    })