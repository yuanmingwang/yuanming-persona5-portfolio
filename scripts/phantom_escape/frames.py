"""Decode the shared RGB renderer and retain compressed frame history."""

from base64 import b64decode
from collections import deque
from zlib import decompress

import numpy as np


class VisionFrames:
    def __init__(self, spec):
        self.frame_shape = tuple(spec["visionShape"])
        height, width, channels = self.frame_shape
        self.count = spec["visionHistory"]
        self.shape = (self.count * channels, height, width)
        self._frames = deque(maxlen=self.count)
        self._level = None
        self._decoded = {}

    def append(self, frame, level, *, reset=False):
        compressed = b64decode(frame, validate=True)
        if reset or level != self._level:
            self._frames.clear()
            self._frames.extend([compressed] * self.count)
            self._level = level
        else:
            self._frames.append(compressed)
        return tuple(self._frames)

    def decode(self, frames):
        result = np.empty(self.shape, dtype=np.uint8)
        channels = self.frame_shape[-1]
        decoded = {}
        for index, frame in enumerate(frames):
            if frame not in decoded:
                cached = self._decoded.get(frame)
                if cached is None:
                    raw = decompress(frame, wbits=-15)
                    cached = np.frombuffer(raw, dtype=np.uint8).reshape(self.frame_shape).transpose(2, 0, 1)
                decoded[frame] = cached
            result[index * channels:(index + 1) * channels] = decoded[frame]
        self._decoded = decoded
        return result
