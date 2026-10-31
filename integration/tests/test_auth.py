import os
import time
from concurrent.futures import ThreadPoolExecutor

import pytest


def challenge(backend):
    return backend.request(
        "POST",
        "/api/v1/auth/login",
        json={"username": backend.email, "password": backend.password},
        auth=False,
    ).json()


def test_real_email_challenge_single_use_logout_and_restart(backend):
    b = backend
    b.request("POST", "/api/v1/auth/login", 401, json={"username": b.email, "password": "wrong"})
    assert b.mail.messages.empty()
    c = challenge(b)
    assert "access_token" not in c
    assert 0 < c["expires_in"] <= 300 and c["resend_after"] > 0
    b.request("POST", "/api/v1/projects", 401, json={"name": "not signed in"})
    b.request(
        "GET", "/api/v1/auth/session", 401, headers={"Authorization": f"Bearer {c['challenge_id']}"}
    )
    code = b.mail.code(b.email)
    wrong = "000000" if code != "000000" else "111111"
    payload = {"challenge_id": c["challenge_id"], "code": wrong}
    b.request("POST", "/api/v1/auth/verify", 401, json=payload)
    # The challenge and attempt count survive an actual process restart.
    b.stop()
    b.start()
    payload["code"] = code
    token = b.request("POST", "/api/v1/auth/verify", json=payload).json()
    assert token["token_type"] == "bearer" and token["expires_in"] > 0
    b.token = token["access_token"]
    assert b.request("GET", "/api/v1/auth/session").json() == {"username": b.email}
    b.request("POST", "/api/v1/auth/verify", 401, json=payload)
    b.stop()
    b.start()
    b.request("GET", "/api/v1/auth/session")
    b.request("POST", "/api/v1/auth/logout", 204)
    b.request("GET", "/api/v1/auth/session", 401)
    b.request("POST", "/api/v1/projects", 401, json={})


def test_five_wrong_codes_lock_challenge_even_after_restart(backend):
    b = backend
    c = challenge(b)
    code = b.mail.code(b.email)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        b.request(
            "POST",
            "/api/v1/auth/verify",
            401,
            json={"challenge_id": c["challenge_id"], "code": wrong},
        )
    b.stop()
    b.start()
    b.request(
        "POST", "/api/v1/auth/verify", 401, json={"challenge_id": c["challenge_id"], "code": code}
    )
    b.request("POST", "/api/v1/auth/resend", 401, json={"challenge_id": c["challenge_id"]})


def test_concurrent_verification_only_issues_one_token(backend):
    b = backend
    c = challenge(b)
    code = b.mail.code(b.email)
    with ThreadPoolExecutor(max_workers=2) as pool:
        replies = list(
            pool.map(
                lambda _: b.client.post(
                    "/api/v1/auth/verify", json={"challenge_id": c["challenge_id"], "code": code}
                ),
                range(2),
            )
        )
    assert sorted(r.status_code for r in replies) == [200, 401]


def test_resend_cooldown_and_unknown_challenge(backend):
    b = backend
    c = challenge(b)
    b.mail.code(b.email)
    r = b.request("POST", "/api/v1/auth/resend", 429, json={"challenge_id": c["challenge_id"]})
    assert int(r.headers["retry-after"]) > 0
    b.request("POST", "/api/v1/auth/resend", 401, json={"challenge_id": "x" * 40})


def test_password_throttling_survives_restart_and_ignores_forwarded_peer(backend):
    b = backend
    # Rate limits use real minute buckets. Avoid straddling a bucket boundary during the test.
    remaining = 60 - time.time() % 60
    if remaining < 15:
        time.sleep(remaining + 1)
    for _ in range(10):
        b.request(
            "POST", "/api/v1/auth/login", 401, json={"username": b.email, "password": "wrong"}
        )
    b.stop()
    b.start()
    r = b.request(
        "POST",
        "/api/v1/auth/login",
        429,
        headers={"X-Forwarded-For": "192.0.2.3"},
        json={"username": b.email, "password": b.password},
    )
    assert "retry-after" in r.headers and b.mail.messages.empty()


def test_smtp_failure_does_not_issue_session(backend):
    b = backend
    b.mail.close()
    b.request("POST", "/api/v1/auth/login", 503, json={"username": b.email, "password": b.password})
    b.request("GET", "/api/v1/auth/session", 401)
    b.request("POST", "/api/v1/projects", 401, json={})


@pytest.mark.skipif(not os.environ.get("CP_TEST_SLOW_AUTH"), reason="real cooldown/expiry; opt-in")
def test_real_resend_and_expiry_without_clock_override(backend):
    b = backend
    c = challenge(b)
    old = b.mail.code(b.email)
    time.sleep(c["resend_after"] + 1)
    c = b.request("POST", "/api/v1/auth/resend", json={"challenge_id": c["challenge_id"]}).json()
    new = b.mail.code(b.email)
    # A random six-digit resend can legitimately repeat the previous value.
    if old != new:
        b.request(
            "POST",
            "/api/v1/auth/verify",
            401,
            json={"challenge_id": c["challenge_id"], "code": old},
        )
    time.sleep(c["expires_in"] + 1)
    b.request(
        "POST", "/api/v1/auth/verify", 401, json={"challenge_id": c["challenge_id"], "code": new}
    )
