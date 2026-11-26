"""Persistent transport for the arcade's Node-based simulator."""

import json
from pathlib import Path
import subprocess

_BRIDGE = Path(__file__).with_name("bridge.mjs")


class SimulatorClient:
    def __init__(self, node="node"):
        self._process = subprocess.Popen(
            [node, "--experimental-strip-types", str(_BRIDGE)], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, encoding="utf-8", bufsize=1,
        )

    def request(self, command, **payload):
        process = self._process
        if process is None:
            raise RuntimeError("Phantom Escape simulator is closed")
        try:
            process.stdin.write(json.dumps({"command": command, **payload}) + "\n")
            process.stdin.flush()
            line = process.stdout.readline()
        except (BrokenPipeError, OSError) as exc:
            raise RuntimeError("Phantom Escape simulator stopped responding") from exc
        if not line:
            raise RuntimeError(f"Phantom Escape simulator exited ({process.poll()})")
        result = json.loads(line)
        if "error" in result:
            raise RuntimeError(result["error"])
        return result

    def close(self):
        process = self._process
        if process is None:
            return
        self._process = None
        try:
            process.stdin.close()
        finally:
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            finally:
                process.stdout.close()

    def __enter__(self):
        return self

    def __exit__(self, *_exception):
        self.close()
