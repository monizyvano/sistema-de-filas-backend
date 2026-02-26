# run.py

from app import create_app
from app.extensions import socketio

# Criar aplicação usando config padrão (development se não passar nada)
app = create_app()

if __name__ == '__main__':
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=app.config.get("DEBUG", False)
    )
