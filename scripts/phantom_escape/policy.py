"""Spatial features for Phantom Escape's structured grid and HUD."""

from math import prod

from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
import torch
from torch import nn


class StateFeatures(BaseFeaturesExtractor):
    def __init__(self, observation_space):
        super().__init__(observation_space, features_dim=128 + observation_space["hud"].shape[0])
        channels, height, width = observation_space["grid"].shape
        self.grid = nn.Sequential(
            nn.Conv2d(channels, 16, kernel_size=3, stride=2, padding=1),
            nn.ReLU(),
            nn.Conv2d(16, 32, kernel_size=3, stride=2, padding=1),
            nn.ReLU(),
            nn.Conv2d(32, 32, kernel_size=3, stride=2, padding=1),
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(prod((32, (height + 7) // 8, (width + 7) // 8)), 128),
            nn.ReLU(),
        )

    def forward(self, observations):
        return torch.cat((self.grid(observations["grid"]), observations["hud"]), dim=1)


class NavigationFeatures(BaseFeaturesExtractor):
    def __init__(self, observation_space):
        width = observation_space["moves"].shape[0] + observation_space["hud"].shape[0]
        super().__init__(observation_space, features_dim=width)
        self.register_buffer("center", torch.zeros(width))
        self.register_buffer("scale", torch.ones(width))

    def normalize_from(self, states, huds):
        for offset, values in ((0, states), (states.shape[1], huds)):
            tensor = torch.as_tensor(values, device=self.center.device, dtype=torch.float32)
            width = tensor.shape[1]
            self.center[offset:offset + width].copy_(tensor.mean(dim=0))
            self.scale[offset:offset + width].copy_(tensor.std(dim=0, unbiased=False).clamp_min(.05))

    def forward(self, observations):
        state = torch.cat((observations["moves"], observations["hud"]), dim=1)
        return (state - self.center) / self.scale
