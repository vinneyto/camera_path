set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git ca-certificates python3-venv sqlite3 nginx
python3 -m venv /opt/camera-path-tools
/opt/camera-path-tools/bin/pip install 'uv==0.8.22' 'boto3>=1.40,<2'
id camera-path >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/camera-path --shell /usr/sbin/nologin camera-path
install -d -o camera-path -g camera-path -m 0750 /opt/camera-path/releases
install -d -m 0755 /var/lib/camera-path
cat > /etc/nginx/sites-available/camera-path <<'CP_NGINX'
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 2m;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
CP_NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/camera-path /etc/nginx/sites-enabled/camera-path
nginx -t
systemctl enable nginx
systemctl restart nginx
cat > /etc/systemd/system/camera-path-backend.service <<'CP_SERVICE'
[Unit]
Description=Camera Path backend
Wants=network-online.target
After=network-online.target
RequiresMountsFor=/var/lib/camera-path
[Service]
User=camera-path
Group=camera-path
WorkingDirectory=/opt/camera-path/current/backend
EnvironmentFile=/etc/camera-path/backend.env
ExecStartPre=/usr/bin/mountpoint -q /var/lib/camera-path
ExecStart=/opt/camera-path/current/backend/.venv/bin/uvicorn camera_path.api:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/camera-path/backend
[Install]
WantedBy=multi-user.target
CP_SERVICE
systemctl daemon-reload
systemctl enable camera-path-backend
touch /etc/camera-path/bootstrap-ready
