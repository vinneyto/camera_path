"""Issue/renew the API certificate and enable Nginx HTTPS before releasing code."""
import json
import re
import socket
import subprocess
import time
from pathlib import Path

CONFIG = Path('/etc/camera-path/deployment.json')
NGINX = Path('/etc/nginx/sites-available/camera-path')
HOOK = Path('/etc/letsencrypt/renewal-hooks/deploy/camera-path')
WEBROOT = '/var/www/camera-path-acme'


def run(args):
    subprocess.run(args, check=True, timeout=300)


def wait_dns(domain, expected_ip):
    # Avoid repeatedly submitting ACME requests while Route 53 is propagating.
    for _ in range(120):
        try:
            addresses = {row[4][0] for row in socket.getaddrinfo(domain, 80, family=socket.AF_INET)}
            if addresses == {expected_ip}:
                return
        except OSError:
            pass
        time.sleep(5)
    raise RuntimeError('API DNS does not point to this Elastic IP; certificate issuance skipped')


def nginx_config(domain):
    return f'''server {{
    listen 80 default_server;
    server_name {domain};
    location /.well-known/acme-challenge/ {{ root {WEBROOT}; }}
    location / {{ return 308 https://{domain}$request_uri; }}
}}
server {{
    listen 443 ssl default_server;
    server_name {domain};
    ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 2m;
    location / {{
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }}
}}
'''


def activate_nginx(content):
    previous = NGINX.read_text()
    if previous == content:
        return
    NGINX.write_text(content)
    try:
        run(['nginx', '-t'])
        run(['systemctl', 'reload', 'nginx'])
    except Exception:
        NGINX.write_text(previous)
        run(['nginx', '-t'])
        run(['systemctl', 'reload', 'nginx'])
        raise


def configure(config):
    domain = config['api_domain']
    email = config['tls_email']
    if not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}', domain):
        raise ValueError('Invalid API domain')
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise ValueError('Invalid certificate contact email')
    wait_dns(domain, config['public_ip'])
    run(['certbot', 'certonly', '--webroot', '--webroot-path', WEBROOT,
         '--non-interactive', '--agree-tos', '--email', email,
         '--cert-name', domain, '--domain', domain, '--keep-until-expiring'])
    activate_nginx(nginx_config(domain))
    HOOK.parent.mkdir(parents=True, exist_ok=True)
    HOOK.write_text('#!/bin/sh\nset -eu\n/usr/sbin/nginx -t\n/bin/systemctl reload nginx\n')
    HOOK.chmod(0o755)
    run(['systemctl', 'enable', '--now', 'certbot.timer'])


if __name__ == '__main__':
    configure(json.loads(CONFIG.read_text()))
