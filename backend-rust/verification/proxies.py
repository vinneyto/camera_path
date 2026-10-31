"""Local fault injection at transport boundaries, without changing backend code."""

import json
import socket
import socketserver
import threading
from contextlib import suppress
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx


def exact(sock, count):
    result = b""
    while len(result) < count:
        chunk = sock.recv(count - len(result))
        if not chunk:
            raise EOFError
        result += chunk
    return result


class AmqpHandler(socketserver.BaseRequestHandler):
    def handle(self):
        remote = socket.create_connection(("127.0.0.1", 35672), timeout=5)
        remote.settimeout(None)
        local = self.request

        def receive():
            try:
                while chunk := remote.recv(65536):
                    local.sendall(chunk)
            except OSError:
                pass
            finally:
                with suppress(OSError):
                    local.shutdown(socket.SHUT_RDWR)

        thread = threading.Thread(target=receive, daemon=True)
        thread.start()
        try:
            remote.sendall(exact(local, 8))  # AMQP protocol negotiation header.
            while True:
                header = exact(local, 7)
                size = int.from_bytes(header[3:7], "big")
                if size > 8 * 1024 * 1024:
                    raise ValueError("Oversized test frame")
                payload = exact(local, size + 1)
                # AMQP 0-9-1 Basic.Ack: class 60, method 80. Drop BEFORE broker sees it.
                if header[0] == 1 and payload[:4] == b"\x00\x3c\x00\x50":
                    self.server.blocked.set()
                    break
                remote.sendall(header + payload)
        except (OSError, EOFError, ValueError):
            pass
        finally:
            with suppress(OSError):
                remote.shutdown(socket.SHUT_RDWR)
            remote.close()
            thread.join(timeout=2)


class AmqpAckFailure(socketserver.ThreadingTCPServer):
    daemon_threads = True

    def __init__(self):
        super().__init__(("127.0.0.1", 0), AmqpHandler)
        self.blocked = threading.Event()
        self.thread = threading.Thread(target=self.serve_forever, daemon=True)
        self.thread.start()

    def close(self):
        self.shutdown()
        self.server_close()
        self.thread.join(timeout=5)


class SqsHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        target = self.headers.get("X-Amz-Target", "")
        if target.endswith("DeleteMessage"):
            self.server.receipt = json.loads(body)["ReceiptHandle"]
            self.server.blocked.set()
            self.send_response(503)
            self.send_header("Content-Type", "application/x-amz-json-1.0")
            self.send_header("X-Amzn-Errortype", "ServiceUnavailable")
            self.end_headers()
            self.wfile.write(b'{"__type":"ServiceUnavailable","message":"fixture ACK failure"}')
            return
        headers = {
            k: v
            for k, v in self.headers.items()
            if k.lower() not in {"host", "content-length", "connection"}
        }
        reply = httpx.post(
            "http://127.0.0.1:35000" + self.path,
            headers=headers,
            content=body,
            timeout=30,
            trust_env=False,
        )
        self.send_response(reply.status_code)
        for key in ["Content-Type", "X-Amzn-Requestid"]:
            if key in reply.headers:
                self.send_header(key, reply.headers[key])
        self.end_headers()
        self.wfile.write(reply.content)


class SqsAckFailure(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self):
        super().__init__(("127.0.0.1", 0), SqsHandler)
        self.blocked = threading.Event()
        self.receipt = None
        self.thread = threading.Thread(target=self.serve_forever, daemon=True)
        self.thread.start()

    def close(self):
        self.shutdown()
        self.server_close()
        self.thread.join(timeout=5)


class SesHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        headers = {
            k: v
            for k, v in self.headers.items()
            if k.lower() not in {"host", "content-length", "connection"}
        }
        reply = httpx.post(
            "http://127.0.0.1:35000" + self.path,
            headers=headers,
            content=body,
            timeout=30,
            trust_env=False,
        )
        if self.path == "/v2/email/outbound-emails" and reply.is_success:
            self.server.messages.put(json.loads(body))
        self.send_response(reply.status_code)
        self.send_header("Content-Type", reply.headers.get("Content-Type", "application/json"))
        self.end_headers()
        self.wfile.write(reply.content)


class SesCapture(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self):
        from queue import Queue

        super().__init__(("127.0.0.1", 0), SesHandler)
        self.messages = Queue()
        self.thread = threading.Thread(target=self.serve_forever, daemon=True)
        self.thread.start()

    def close(self):
        self.shutdown()
        self.server_close()
        self.thread.join(timeout=5)
