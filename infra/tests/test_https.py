import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from test_deploy import load

h = load('https_config', 'scripts/configure_https.py')


class HttpsTests(unittest.TestCase):
    def test_failed_nginx_validation_restores_previous_config(self):
        with tempfile.TemporaryDirectory() as temp:
            config = Path(temp) / 'nginx'
            config.write_text('old configuration')
            with patch.object(h, 'NGINX', config), patch.object(h, 'run', side_effect=[RuntimeError('invalid'), None, None]):
                with self.assertRaisesRegex(RuntimeError, 'invalid'):
                    h.activate_nginx('new configuration')
            self.assertEqual(config.read_text(), 'old configuration')

    def test_dns_timeout_never_submits_certificate_request(self):
        with patch.object(h.socket, 'getaddrinfo', return_value=[(None, None, None, None, ('192.0.2.2', 80))]), \
                patch.object(h.time, 'sleep'), patch.object(h, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'DNS'):
                h.configure({'api_domain': 'api.example.com', 'public_ip': '192.0.2.1', 'tls_email': 'ops@example.com'})
            run.assert_not_called()

    def test_tls_setup_uses_webroot_and_installs_renewal_hook(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(h, 'wait_dns'), \
                patch.object(h, 'activate_nginx'), patch.object(h, 'run') as run, \
                patch.object(h, 'HOOK', Path(temp) / 'hook'):
            h.configure({'api_domain': 'api.example.com', 'public_ip': '192.0.2.1', 'tls_email': 'ops@example.com'})
            argv = run.call_args_list[0].args[0]
            self.assertIn('--webroot', argv)
            self.assertNotIn('--force-renewal', argv)
            self.assertEqual(run.call_args_list[-1].args[0], ['systemctl', 'enable', '--now', 'certbot.timer'])
            self.assertIn('reload nginx', h.HOOK.read_text())
            self.assertEqual(h.HOOK.stat().st_mode & 0o777, 0o755)

    def test_cli_websocket_does_not_change_regular_proxy_headers(self):
        https = h.nginx_config('api.example.com').split('server {')[2]
        commands, normal = https.split('location / {')
        self.assertIn('location = /api/v1/inference/commands', commands)
        self.assertIn('proxy_set_header Upgrade $http_upgrade;', commands)
        self.assertIn('proxy_set_header Connection "upgrade";', commands)
        self.assertIn('proxy_read_timeout 120s;', commands)
        self.assertNotIn('proxy_set_header Upgrade', normal)
        self.assertIn('proxy_buffering off;', normal)

    def test_http_only_serves_challenges_or_redirects(self):
        http, https = h.nginx_config('api.example.com').split('server {')[1:]
        self.assertIn('/.well-known/acme-challenge/', http)
        self.assertIn('308 https://api.example.com$request_uri', http)
        self.assertNotIn('proxy_pass', http)
        self.assertIn('listen 443 ssl', https)
        self.assertIn('proxy_buffering off', https)


if __name__ == '__main__':
    unittest.main()
