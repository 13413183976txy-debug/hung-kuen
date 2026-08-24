# -*- coding: utf-8 -*-
"""洪拳 · Hung Kuen - 一键启动器 (Python)
自动: 探测端口 -> 起静态服务器 -> 打开浏览器。由 .bat 调用，处理编码更可靠。
"""
import os
import sys
import socket
import time
import threading
import webbrowser

try:
    import http.server
    HAS_PY = True
except Exception:
    HAS_PY = False

ROOT = os.path.dirname(os.path.abspath(__file__))
START_PORT = 8080
HOST = "127.0.0.1"


def port_busy(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.settimeout(0.2)
        return s.connect_ex((HOST, port)) == 0
    finally:
        s.close()


def find_port():
    p = START_PORT
    for _ in range(20):
        if not port_busy(p):
            return p
        p += 1
    return None


box = lambda s: "  " + str(s)
star = "=" * 46


def main():
    print()
    print("  " + star)
    print("        洪拳 · Hung Kuen  ·  一键启动")
    print("  " + star)
    print("  " + box("目录: " + ROOT))
    print()

    if not HAS_PY:
        print("  [x] 运行环境异常：请安装 Python 后重试")
        print("      https://www.python.org/downloads/")
        input("  按回车退出...")
        sys.exit(1)

    port = find_port()
    if port is None:
        print("  [x] 未找到可用端口")
        input("  按回车退出...")
        sys.exit(1)
    url = "http://localhost:%d/" % port
    print("  [OK] 使用端口: %d" % port)

    # 打开浏览器（等服务器起来后）
    def _open():
        time.sleep(0.8)
        try:
            webbrowser.open(url)
        except Exception:
            pass
    threading.Thread(target=_open, daemon=True).start()
    print("  [OK] 已在浏览器打开: %s" % url)
    print()

    # 启动静态服务器（前台阻塞；多线程，精灵并行加载更快）
    os.chdir(ROOT)
    handler = http.server.SimpleHTTPRequestHandler

    class Server(http.server.ThreadingHTTPServer):
        allow_reuse_address = True

    try:
        with Server((HOST, port), handler) as httpd:
            print("  [OK] 服务器已启动，按 Ctrl+C 停止 ...")
            print("  " + "-" * 46)
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                pass
            finally:
                httpd.server_close()
    except OSError as e:
        print("  [x] 启动失败: %s" % e)
        input("  按回车退出...")
        sys.exit(1)

    print()
    print("  [i] 服务器已停止。")
    input("  按回车退出...")


if __name__ == "__main__":
    main()
