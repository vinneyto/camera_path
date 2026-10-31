"""Loopback-only test peers. No application imports or external services."""

import json
import re
import socketserver
import threading
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from queue import Queue


class SMTPHandler(socketserver.StreamRequestHandler):
    def handle(self):
        self.wfile.write(b"220 test mailbox\r\n")
        recipients = []
        while line := self.rfile.readline(8192):
            command = line.split(b" ", 1)[0].strip().upper()
            if command in {b"EHLO", b"HELO"}:
                reply = b"250 localhost\r\n"
            elif command == b"MAIL":
                recipients = []
                reply = b"250 OK\r\n"
            elif command == b"RCPT":
                recipients.append(line.decode().split(":", 1)[1].strip().strip("<>"))
                reply = b"250 OK\r\n"
            elif command == b"DATA":
                self.wfile.write(b"354 End with dot\r\n")
                chunks = []
                while chunk := self.rfile.readline(8192):
                    if chunk == b".\r\n":
                        break
                    chunks.append(chunk[1:] if chunk.startswith(b"..") else chunk)
                message = BytesParser(policy=policy.default).parsebytes(b"".join(chunks))
                self.server.messages.put((recipients, message))
                reply = b"250 Accepted\r\n"
            elif command == b"QUIT":
                self.wfile.write(b"221 Bye\r\n")
                return
            elif command in {b"RSET", b"NOOP"}:
                reply = b"250 OK\r\n"
            else:
                reply = b"502 Unsupported\r\n"
            self.wfile.write(reply)


class Mailbox(socketserver.ThreadingTCPServer):
    daemon_threads = True

    def __init__(self):
        super().__init__(("127.0.0.1", 0), SMTPHandler)
        self.messages = Queue()
        self.thread = threading.Thread(target=self.serve_forever, daemon=True)
        self.thread.start()

    def code(self, recipient):
        recipients, message = self.messages.get(timeout=5)
        assert recipients == [recipient]
        assert message["To"] == recipient
        assert "sign-in code" in message["Subject"]
        match = re.search(r"\b(\d{6})\b", message.get_body().get_content())
        assert match, "SMTP message did not contain a six-digit code"
        return match[1]

    def close(self):
        if not self.thread.is_alive():
            return
        self.shutdown()
        self.server_close()
        self.thread.join(timeout=5)


class ResponsesHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        assert self.path == "/v1/responses"
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.server.requests.append(body)
        if self.server.mode == "failure":
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                b'{"error":{"message":"fixture failure","type":"invalid_request_error"}}'
            )
            return
        tool_done = any(item.get("type") == "function_call_output" for item in body["input"])
        output = (
            [
                {
                    "type": "function_call",
                    "id": "fc_fixture",
                    "call_id": "call_fixture",
                    "name": "set_default_speed",
                    "arguments": '{"speed": 2.5}',
                }
            ]
            if self.server.mode == "tool" and not tool_done
            else [
                {
                    "type": "message",
                    "id": "msg_fixture",
                    "role": "assistant",
                    "status": "completed",
                    "content": [
                        {"type": "output_text", "text": "Fixture answer", "annotations": []}
                    ],
                }
            ]
        )
        response = {
            "id": "resp_fixture",
            "object": "response",
            "created_at": 0,
            "status": "completed",
            "model": "fixture",
            "output": output,
        }
        self.send_response(200)
        streaming = body.get("stream", False)
        self.send_header("Content-Type", "text/event-stream" if streaming else "application/json")
        self.end_headers()
        if streaming:
            events = []
            if self.server.mode != "truncated":
                if output[0]["type"] == "message":
                    events.append(
                        {
                            "type": "response.output_text.delta",
                            "delta": "Fixture answer",
                            "item_id": "msg_fixture",
                            "output_index": 0,
                            "content_index": 0,
                            "sequence_number": 1,
                        }
                    )
                events.append(
                    {"type": "response.completed", "response": response, "sequence_number": 2}
                )
            for event in events:
                self.wfile.write(f"data: {json.dumps(event)}\n\n".encode())
                self.wfile.flush()
        else:
            self.wfile.write(json.dumps(response).encode())


class ResponsesServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self):
        super().__init__(("127.0.0.1", 0), ResponsesHandler)
        self.mode = "answer"
        self.requests = []
        self.thread = threading.Thread(target=self.serve_forever, daemon=True)
        self.thread.start()

    def close(self):
        self.shutdown()
        self.server_close()
        self.thread.join(timeout=5)
