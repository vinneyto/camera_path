import re

import pytest
from conftest import CONTRACT, OPERATIONS

PROTECTED = [
    (method, path)
    for method, path, _ in OPERATIONS
    if method != "GET"
    and path not in {"/api/v1/auth/login", "/api/v1/auth/verify", "/api/v1/auth/resend"}
]


@pytest.mark.parametrize("method,path", PROTECTED, ids=[f"{m} {p}" for m, p in PROTECTED])
def test_every_write_operation_requires_authentication(public_backend, method, path):
    path = re.sub(r"\{[^}]+\}", "missing", path)
    public_backend.request(method, path, 401, json={}, auth=False)
    public_backend.request(
        method, path, 401, json={}, auth=False, headers={"Authorization": "Bearer invalid"}
    )


def test_openapi_inventory_and_cors(public_backend):
    b = public_backend
    schema = b.request("GET", "/api/v1/openapi.json").json()
    assert schema["paths"].keys() == CONTRACT["paths"].keys()
    for path, methods in CONTRACT["paths"].items():
        for method, operation in methods.items():
            assert schema["paths"][path][method]["operationId"] == operation["operationId"]
    assert b.request("GET", "/health").json() == {"status": "ok"}
    b.request("GET", "/docs")
    response = b.request(
        "OPTIONS",
        "/api/v1/projects",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,if-match",
        },
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    b.request(
        "OPTIONS",
        "/api/v1/projects",
        400,
        headers={"Origin": "https://not-allowed.example", "Access-Control-Request-Method": "POST"},
    )
    assert b.request("GET", "/api/v1/projects/missing", 404).json()["code"] == "project_not_found"
    b.request("GET", "/api/v1/auth/session", 401)
    assert b.request("GET", "/api/v1/profile/settings").json()["show_grid"] is True
