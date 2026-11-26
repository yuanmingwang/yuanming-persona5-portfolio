"""Roll out policies on fixed seeds without feeding evaluation maps into training."""

from collections import Counter
from statistics import mean

from .env import PhantomEscapeEnv

EVAL_FIRST_SEED = 5300
EVAL_SEED_COUNT = 200
VALIDATION_FIRST_SEED = 8000
FIRST_LEVEL_STEPS = 600
MAX_EPISODE_STEPS = 1200


def checkpoint_features(policy):
    spaces = policy.observation_space.spaces
    if "frames" in spaces:
        return "vision-spatial" if "moves" in spaces else "vision"
    return "navigation" if "moves" in spaces else "grid"


def evaluate(policy, episodes, *, first_seed=EVAL_FIRST_SEED, first_level_only=False):
    outcomes = Counter()
    layout_results = {}
    returns, levels, scores = [], [], []
    max_steps = FIRST_LEVEL_STEPS if first_level_only else MAX_EPISODE_STEPS
    with PhantomEscapeEnv(max_steps=max_steps, features=checkpoint_features(policy)) as env:
        for seed in range(first_seed, first_seed + episodes):
            observation, info = env.reset(seed=seed)
            layout = layout_results.setdefault(info["layout"], {"episodes": 0, "first_level_clears": 0})
            total_reward = 0.0
            while True:
                action, _ = policy.predict(observation, deterministic=True)
                observation, reward, terminated, truncated, info = env.step(action.item())
                total_reward += reward
                if first_level_only and info["level"] > 1:
                    outcomes["cleared"] += 1
                    break
                if terminated or truncated:
                    outcomes[info["outcome"] or "step_limit"] += 1
                    break
            returns.append(total_reward)
            scores.append(info["score"])
            levels.append(info["level"] - 1)
            layout["episodes"] += 1
            layout["first_level_clears"] += int(info["level"] > 1)
    return {
        "episodes": episodes,
        "first_seed": first_seed,
        "max_steps": max_steps,
        "mean_return": mean(returns),
        "mean_levels_cleared": mean(levels),
        "first_level_clear_rate": mean(level > 0 for level in levels),
        "mean_score": mean(scores),
        "outcomes": dict(outcomes),
        "starting_layouts": layout_results,
    }


def selection_key(metrics):
    rooms = metrics["starting_layouts"].get("rooms")
    room_clear_rate = rooms["first_level_clears"] / rooms["episodes"] if rooms else 0
    return metrics["first_level_clear_rate"], room_clear_rate, metrics["mean_score"]
