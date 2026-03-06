import json


def test_register_login_me_flow(client, db_session):
    register_payload = {
        "nome": "Novo Atendente",
        "email": "novo.atendente@test.com",
        "senha": "senha123",
        "tipo": "atendente",
        "balcao": 2,
    }

    register_response = client.post("/api/auth/register", json=register_payload)
    assert register_response.status_code == 201

    register_body = register_response.get_json()
    assert register_body["atendente"]["email"] == register_payload["email"]
    assert "senha" not in json.dumps(register_body).lower()

    login_response = client.post(
        "/api/auth/login",
        json={"email": register_payload["email"], "senha": register_payload["senha"]},
    )
    assert login_response.status_code == 200

    login_body = login_response.get_json()
    assert "access_token" in login_body
    assert login_body["atendente"]["email"] == register_payload["email"]

    me_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {login_body['access_token']}"},
    )
    assert me_response.status_code == 200
    me_body = me_response.get_json()
    assert me_body["email"] == register_payload["email"]


def test_register_duplicate_email_returns_400(client, db_session):
    payload = {
        "nome": "Duplicado",
        "email": "duplicado@test.com",
        "senha": "senha123",
        "tipo": "atendente",
        "balcao": 1,
    }

    first = client.post("/api/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post("/api/auth/register", json=payload)
    assert second.status_code == 400
    assert "erro" in second.get_json()


def test_login_invalid_password_returns_401(client, db_session):
    payload = {
        "nome": "User Login",
        "email": "user.login@test.com",
        "senha": "senha123",
        "tipo": "atendente",
        "balcao": 4,
    }
    client.post("/api/auth/register", json=payload)

    login_response = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "senha": "senha-errada"},
    )

    assert login_response.status_code == 401
    assert login_response.get_json()["erro"] == "Email ou senha incorretos"
