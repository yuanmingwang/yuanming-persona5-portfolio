"""Export the matched navigation and zero-residual vision actor for the arcade."""

import argparse
from base64 import b64encode
import json
from pathlib import Path
from tempfile import NamedTemporaryFile

import torch
from stable_baselines3 import PPO

from .policy import NavigationFeatures, SpatialVisionFeatures

ACTOR_TENSORS = (
    ("features_extractor.center", (104,)),
    ("features_extractor.scale", (104,)),
    ("mlp_extractor.policy_net.0.weight", (96, 104)),
    ("mlp_extractor.policy_net.0.bias", (96,)),
    ("mlp_extractor.policy_net.2.weight", (64, 96)),
    ("mlp_extractor.policy_net.2.bias", (64,)),
    ("action_net.weight", (9, 64)),
    ("action_net.bias", (9,)),
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("navigation", type=Path, help="trusted navigation checkpoint")
    parser.add_argument("vision", type=Path, help="trusted spatial-vision checkpoint")
    parser.add_argument("--output", type=Path, default=Path("src/demos/phantom-escape/learned-weights.json"))
    args = parser.parse_args()
    navigation = PPO.load(args.navigation, device="cpu").policy
    vision = PPO.load(args.vision, device="cpu").policy
    if type(navigation.features_extractor) is not NavigationFeatures or not isinstance(
        vision.features_extractor, SpatialVisionFeatures,
    ):
        parser.error("expected a navigation checkpoint and a spatial-vision checkpoint")
    for policy in (navigation, vision):
        if tuple(type(layer) for layer in policy.mlp_extractor.policy_net) != (
            torch.nn.Linear, torch.nn.Tanh, torch.nn.Linear, torch.nn.Tanh,
        ):
            parser.error("expected a two-layer tanh actor")
    projection = vision.features_extractor.residual[-1]
    if torch.count_nonzero(projection.weight).item() or torch.count_nonzero(projection.bias).item():
        parser.error("the selected vision checkpoint needs CNN inference")
    navigation_weights, vision_weights = navigation.state_dict(), vision.state_dict()
    arrays = []
    for name, shape in ACTOR_TENSORS:
        a, b = navigation_weights[name], vision_weights[name]
        if tuple(a.shape) != shape or not torch.isfinite(a).all() or not torch.equal(a, b):
            parser.error(f"incompatible or different actor tensor: {name}")
        if name.endswith(".scale") and not torch.all(a > 0):
            parser.error("invalid normalization scale")
        arrays.append(a.numpy().astype("<f4", copy=False).tobytes())
    data = json.dumps({"version": 1, "float32": b64encode(b"".join(arrays)).decode("ascii")}) + "\n"
    with NamedTemporaryFile(dir=args.output.parent, delete=False) as temporary:
        temporary.write(data.encode("utf-8"))
        temporary_path = Path(temporary.name)
    try:
        temporary_path.replace(args.output)
    finally:
        temporary_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
