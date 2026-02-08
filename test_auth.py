"""
Teste do AuthService
"""
from app import create_app
from app.services.auth_service import AuthService

app = create_app()

with app.app_context():
    try:
        resultado = AuthService.login('admin@imtsb.ao', 'admin123', ip_address='127.0.0.1')
        print('✅ LOGIN BEM-SUCEDIDO!')
        print(f"Atendente: {resultado['atendente']['nome']} ({resultado['atendente']['tipo']})")
        print(f"Access Token: {resultado['access_token'][:50]}...")
        print(f"Refresh Token: {resultado['refresh_token'][:50]}...")
    except Exception as e:
        print(f'❌ ERRO: {e}')
        import traceback
        traceback.print_exc()
