"""Gymnasium adapter for the same deterministic simulation used in the arcade."""

import gymnasium as gym
from gymnasium.utils.seeding import np_random
import numpy as np

from .client import SimulatorClient


class PhantomEscapeEnv(gym.Env):
    """Hold each discrete input for six simulation ticks."""

    metadata = {"render_modes": []}

    def __init__(self, *, max_steps=None, node="node", features="grid"):
        super().__init__()
        if max_steps is not None and (not isinstance(max_steps, int) or max_steps < 1):
            raise ValueError("max_steps must be a positive integer")
        self.max_steps = max_steps
        if features not in ("grid", "navigation"):
            raise ValueError("Unknown Phantom Escape observation profile")
        self.features = features
        self.render_mode = None
        self._steps = 0
        self._needs_reset = True
        self._client = SimulatorClient(node)
        try:
            spec = self._client.request("spec")
            if spec["version"] != 1:
                raise RuntimeError("Unsupported Phantom Escape simulator contract")
            self._grid_shape = tuple(spec["gridShape"])
            self.action_space = gym.spaces.Discrete(spec["actionCount"])
            key = "moves" if features == "navigation" else "grid"
            shape = (spec["movesSize"],) if features == "navigation" else self._grid_shape
            self.observation_space = gym.spaces.Dict({
                key: gym.spaces.Box(-1.0, 1.0, shape=shape, dtype=np.float32),
                "hud": gym.spaces.Box(0.0, 1.0, shape=(spec["hudSize"],), dtype=np.float32),
            })
        except Exception:
            self.close()
            raise

    def _observation(self, response):
        raw = response["observation"]
        observation = {key: np.asarray(value, dtype=np.float32) for key, value in raw.items()}
        if self.features == "grid":
            observation["grid"] = observation["grid"].reshape(self._grid_shape)
        return observation

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        options = options or {}
        if seed is not None and 0 <= seed <= 0xFFFFFFFF:
            default_seed = int(seed)
        else:
            default_seed = int(self.np_random.integers(0, 2**32))
        run_seed = options.get("run_seed", default_seed)
        if not isinstance(run_seed, (int, np.integer)) or not 0 <= run_seed < 2**32:
            raise ValueError("run_seed must be an unsigned 32-bit integer")
        response = self._client.request("reset", seed=int(run_seed), features=self.features)
        self._steps = 0
        self._needs_reset = False
        return self._observation(response), response["info"]

    def step(self, action):
        if self._needs_reset:
            raise gym.error.ResetNeeded("Reset Phantom Escape before stepping")
        if not self.action_space.contains(action):
            raise ValueError(f"Invalid Phantom Escape action: {action}")
        response = self._client.request("step", action=int(action))
        self._steps += 1
        info = response["info"]
        transition = response["transition"]
        info["ticks"] = transition["ticks"]
        info["events"] = transition["events"]
        terminated = info["outcome"] is not None
        truncated = not terminated and self.max_steps is not None and self._steps >= self.max_steps
        self._needs_reset = terminated or truncated
        return self._observation(response), transition["reward"], terminated, truncated, info

    def close(self):
        self._client.close()


class TrainingMaps(gym.Wrapper):
    """Sample deterministic training seeds outside the evaluation range."""

    def __init__(self, environment, arena_only):
        super().__init__(environment)
        self.arena_only = arena_only
        self._map_rng = None

    def reset(self, *, seed=None, options=None):
        if seed is not None or self._map_rng is None:
            self._map_rng, _ = np_random(seed)
        run_seed = int(self._map_rng.integers(1 << 24, 1 << 32))
        # Odd seeds start in an open arena. Subsequent levels use the arcade schedule.
        if self.arena_only:
            run_seed |= 1
        return self.env.reset(seed=seed, options={**(options or {}), "run_seed": run_seed})
