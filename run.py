from app import create_app, socketio

# Criar aplicação
app = create_app()
app.config['DEBUG'] = True  # ← Adicione esta linha

if __name__ == '__main__':
    # Rodar com SocketIO para suporte a WebSockets
    socketio.run(
        app,
        debug=True,
        host='0.0.0.0',
        port=5000
    )
