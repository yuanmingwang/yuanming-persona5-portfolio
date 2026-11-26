"""Run a reproducible random-policy baseline for the upcoming State PPO model."""

import argparse
from collections import Counter
import json
from random import Random
from statistics import mean
from time import perf_counter

from .client import SimulatorClient


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episodes", type=int, default=200)
    parser.add_argument("--first-seed", type=int, default=5300)
    parser.add_argument("--max-steps", type=int, default=1200)
    args = parser.parse_args()
    if args.episodes < 1 or not 0 <= args.first_seed <= 2**32 - args.episodes:
        parser.error("episodes must be positive and all episode seeds must fit in uint32")
    if args.max_steps < 1:
        parser.error("max-steps must be positive")

    outcomes = Counter()
    returns, levels, scores, steps = [], [], [], []
    started = perf_counter()
    with SimulatorClient() as simulator:
        action_count = simulator.request("spec")["actionCount"]
        for seed in range(args.first_seed, args.first_seed + args.episodes):
            rng = Random(seed)
            simulator.request("reset", seed=seed)
            episode_reward = 0.0
            for step in range(1, args.max_steps + 1):
                result = simulator.request("step", action=rng.randrange(action_count))
                info = result["info"]
                episode_reward += result["transition"]["reward"]
                if info["outcome"] or step == args.max_steps:
                    outcomes[info["outcome"] or "step_limit"] += 1
                    break
            returns.append(episode_reward)
            levels.append(info["level"] - 1)
            scores.append(info["score"])
            steps.append(step)

    print(json.dumps({
        "episodes": args.episodes, "first_seed": args.first_seed, "max_steps": args.max_steps,
        "mean_return": mean(returns), "mean_levels_cleared": mean(levels),
        "first_level_clear_rate": mean(level > 0 for level in levels), "mean_score": mean(scores),
        "mean_steps": mean(steps), "steps_per_second": sum(steps) / (perf_counter() - started),
        "outcomes": dict(outcomes),
    }, indent=2))


if __name__ == "__main__":
    main()
