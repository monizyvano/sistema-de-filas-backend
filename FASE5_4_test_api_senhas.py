# ===== FASE 5.4: TESTES DE INTEGRAÇÃO - API SENHAS =====

"""
tests/integration/test_api_senhas.py

Testes dos endpoints /api/senhas/*
"""

TEST_API_SENHAS = """
import pytest


class TestEmitirSenha:
    '''Testes do endpoint POST /api/senhas'''
    
    def test_emitir_senha_valida(self, client, servico, db_session):
        '''Deve emitir senha com dados válidos'''
        response = client.post('/api/senhas', json={
            'servico_id': servico.id,
            'tipo': 'normal'
        })
        
        assert response.status_code == 201
        data = response.json
        assert 'senha' in data
        assert data['senha']['numero'].startswith('N')
        assert data['senha']['tipo'] == 'normal'
        assert data['senha']['status'] == 'aguardando'
    
    
    def test_emitir_senha_prioritaria(self, client, servico):
        '''Deve emitir senha prioritária'''
        response = client.post('/api/senhas', json={
            'servico_id': servico.id,
            'tipo': 'prioritaria'
        })
        
        assert response.status_code == 201
        data = response.json
        assert data['senha']['numero'].startswith('P')
        assert data['senha']['tipo'] == 'prioritaria'
    
    
    def test_emitir_senha_servico_invalido(self, client):
        '''Deve rejeitar serviço inválido'''
        response = client.post('/api/senhas', json={
            'servico_id': 9999,
            'tipo': 'normal'
        })
        
        assert response.status_code == 400
    
    
    def test_emitir_senha_tipo_invalido(self, client, servico):
        '''Deve rejeitar tipo inválido'''
        response = client.post('/api/senhas', json={
            'servico_id': servico.id,
            'tipo': 'invalido'
        })
        
        assert response.status_code == 400
        assert 'erro' in response.json
    
    
    def test_emitir_senha_campos_obrigatorios(self, client):
        '''Deve rejeitar quando faltam campos'''
        response = client.post('/api/senhas', json={})
        
        assert response.status_code == 400
        assert 'erro' in response.json
    
    
    def test_rate_limiting_emissao(self, client, servico):
        '''Deve bloquear após 10 emissões'''
        # Fazer 12 requisições
        respostas = []
        for i in range(12):
            response = client.post('/api/senhas', json={
                'servico_id': servico.id,
                'tipo': 'normal'
            })
            respostas.append(response.status_code)
        
        # Primeiras 10 devem passar (201)
        assert respostas[:10].count(201) == 10
        
        # Últimas 2 devem ser bloqueadas (429)
        assert 429 in respostas[10:]


class TestBuscarSenha:
    '''Testes do endpoint GET /api/senhas/:id'''
    
    def test_buscar_senha_existente(self, client, senha):
        '''Deve buscar senha por ID'''
        response = client.get(f'/api/senhas/{senha.id}')
        
        assert response.status_code == 200
        data = response.json
        assert data['numero'] == 'N001'
    
    
    def test_buscar_senha_inexistente(self, client):
        '''Deve retornar 404 para senha inexistente'''
        response = client.get('/api/senhas/9999')
        
        assert response.status_code == 404


class TestIniciarAtendimento:
    '''Testes do endpoint PUT /api/senhas/:id/iniciar'''
    
    def test_iniciar_atendimento_com_auth(self, client, senha, auth_headers):
        '''Deve iniciar atendimento com autenticação'''
        response = client.put(
            f'/api/senhas/{senha.id}/iniciar',
            json={'numero_balcao': 1},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json
        assert data['mensagem'] == 'Atendimento iniciado'
    
    
    def test_iniciar_atendimento_sem_auth(self, client, senha):
        '''Deve rejeitar sem autenticação'''
        response = client.put(
            f'/api/senhas/{senha.id}/iniciar',
            json={'numero_balcao': 1}
        )
        
        assert response.status_code == 401


class TestFinalizarAtendimento:
    '''Testes do endpoint PUT /api/senhas/:id/finalizar'''
    
    def test_finalizar_atendimento(self, client, senha, auth_headers, atendente):
        '''Deve finalizar atendimento'''
        # Primeiro iniciar
        senha.iniciar_atendimento(atendente.id, 1)
        
        # Depois finalizar
        response = client.put(
            f'/api/senhas/{senha.id}/finalizar',
            json={'observacoes': 'Atendimento concluído'},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json
        assert 'senha' in data


class TestCancelarSenha:
    '''Testes do endpoint DELETE /api/senhas/:id/cancelar'''
    
    def test_cancelar_senha(self, client, senha, auth_headers):
        '''Deve cancelar senha com motivo'''
        response = client.delete(
            f'/api/senhas/{senha.id}/cancelar',
            json={'motivo': 'Usuário desistiu'},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json
        assert data['mensagem'] == 'Senha cancelada com sucesso'
    
    
    def test_cancelar_senha_sem_motivo(self, client, senha, auth_headers):
        '''Deve rejeitar cancelamento sem motivo'''
        response = client.delete(
            f'/api/senhas/{senha.id}/cancelar',
            json={},
            headers=auth_headers
        )
        
        assert response.status_code == 400


class TestEstatisticas:
    '''Testes do endpoint GET /api/senhas/estatisticas'''
    
    def test_estatisticas_vazio(self, client, db_session):
        '''Deve retornar estatísticas vazias'''
        response = client.get('/api/senhas/estatisticas')
        
        assert response.status_code == 200
        data = response.json
        assert 'total_emitidas' in data
        assert data['total_emitidas'] == 0
    
    
    def test_estatisticas_com_senhas(self, client, senha):
        '''Deve retornar estatísticas corretas'''
        response = client.get('/api/senhas/estatisticas')
        
        assert response.status_code == 200
        data = response.json
        assert data['total_emitidas'] >= 1
        assert data['aguardando'] >= 1
"""

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║  FASE 5.4 - TESTES DE INTEGRAÇÃO - API SENHAS                ║
╚══════════════════════════════════════════════════════════════╝

CRIAR ARQUIVO:
────────────────────────────────────────────────────────────────
tests/integration/test_api_senhas.py

Cole o código acima (TEST_API_SENHAS)

TESTES INCLUÍDOS:
────────────────────────────────────────────────────────────────
TestEmitirSenha:
  ✅ test_emitir_senha_valida
  ✅ test_emitir_senha_prioritaria
  ✅ test_emitir_senha_servico_invalido
  ✅ test_emitir_senha_tipo_invalido
  ✅ test_emitir_senha_campos_obrigatorios
  ✅ test_rate_limiting_emissao

TestBuscarSenha:
  ✅ test_buscar_senha_existente
  ✅ test_buscar_senha_inexistente

TestIniciarAtendimento:
  ✅ test_iniciar_atendimento_com_auth
  ✅ test_iniciar_atendimento_sem_auth

TestFinalizarAtendimento:
  ✅ test_finalizar_atendimento

TestCancelarSenha:
  ✅ test_cancelar_senha
  ✅ test_cancelar_senha_sem_motivo

TestEstatisticas:
  ✅ test_estatisticas_vazio
  ✅ test_estatisticas_com_senhas

TOTAL: 15 testes de integração

EXECUTAR:
────────────────────────────────────────────────────────────────
pytest tests/integration/test_api_senhas.py -v

PRÓXIMO: FASE5_5_test_api_auth.py
    """)
    
    print(TEST_API_SENHAS)
