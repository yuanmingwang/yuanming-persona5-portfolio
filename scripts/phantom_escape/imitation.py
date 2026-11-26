"""Warm-start State PPO with successful demonstrations from the 10 Hz teacher."""

import numpy as np

from .client import SimulatorClient

# Keep demonstration maps separate from both evaluation and PPO rollout maps.
DEMO_FIRST_SEED = 1 << 20
MAX_DEMO_STEPS = 600
BATCH_SIZE = 256


def collect(episodes, arena_only, features="grid"):
    states, huds, actions = [], [], []
    with SimulatorClient() as simulator:
        spec = simulator.request("spec")
        key = "moves" if features == "navigation" else "grid"
        shape = (spec["movesSize"],) if key == "moves" else spec["gridShape"]
        for index in range(episodes):
            seed = DEMO_FIRST_SEED + (2 * index + 1 if arena_only else index)
            result = simulator.request("reset", seed=seed, features=features)
            demo_states, demo_huds, demo_actions = [], [], []
            for _ in range(MAX_DEMO_STEPS):
                current = result["observation"]
                result = simulator.request("expert")
                demo_states.append(np.asarray(current[key], dtype=np.float16).reshape(shape))
                demo_huds.append(current["hud"])
                demo_actions.append(result["action"])
                if result["info"]["level"] > 1:
                    states.extend(demo_states)
                    huds.extend(demo_huds)
                    actions.extend(demo_actions)
                    break
                if result["info"]["outcome"]:
                    break
    if not actions:
        raise RuntimeError("No teacher demonstrations cleared level one")
    return np.stack(states), np.asarray(huds, dtype=np.float32), np.asarray(actions, dtype=np.int64)


def warm_start(model, episodes, epochs, seed, arena_only, features="grid"):
    import torch
    from torch.nn import functional as F

    states, huds, actions = collect(episodes, arena_only, features)
    key = "moves" if features == "navigation" else "grid"
    if features == "navigation":
        model.policy.features_extractor.normalize_from(states, huds)
    rng = np.random.default_rng(seed)
    model.policy.set_training_mode(True)
    optimizer = torch.optim.Adam(model.policy.parameters(), lr=3e-4)
    print(f"Imitation warm start: {len(actions)} actions from successful first levels", flush=True)
    history = []
    for epoch in range(epochs):
        hits = 0
        loss_total = 0.0
        order = rng.permutation(len(actions))
        for start in range(0, len(actions), BATCH_SIZE):
            batch = order[start:start + BATCH_SIZE]
            observations = {
                key: torch.as_tensor(states[batch], device=model.device, dtype=torch.float32),
                "hud": torch.as_tensor(huds[batch], device=model.device),
            }
            labels = torch.as_tensor(actions[batch], device=model.device)
            distribution = model.policy.get_distribution(observations).distribution
            loss = F.cross_entropy(distribution.logits, labels)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            hits += (distribution.logits.argmax(dim=1) == labels).sum().item()
            loss_total += loss.item() * len(batch)
        metrics = {"epoch": epoch + 1, "loss": loss_total / len(actions), "action_accuracy": hits / len(actions)}
        history.append(metrics)
        print(f"Imitation epoch {epoch + 1}/{epochs}: loss={metrics['loss']:.3f}, train accuracy={hits / len(actions):.1%}", flush=True)
    return {"samples": len(actions), "training_history": history}
