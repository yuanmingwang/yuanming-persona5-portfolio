"""Train or evaluate a State PPO policy for Phantom Escape."""

import argparse
from collections import Counter
from datetime import datetime, timezone
from functools import partial
import json
from pathlib import Path
from statistics import mean

from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import CheckpointCallback
from stable_baselines3.common.logger import configure
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.vec_env import DummyVecEnv
import torch

from .env import PhantomEscapeEnv, TrainingMaps
from .policy import NavigationFeatures, StateFeatures

EVAL_FIRST_SEED = 5300
EVAL_SEED_COUNT = 200
MAX_EPISODE_STEPS = 1200
ROLLOUT_STEPS = 256


def make_training_env(arena_only, features):
    return Monitor(TrainingMaps(PhantomEscapeEnv(max_steps=MAX_EPISODE_STEPS, features=features), arena_only))


def checkpoint_features(policy):
    return "navigation" if "moves" in policy.observation_space.spaces else "grid"


def evaluate(policy, episodes):
    outcomes = Counter()
    layout_results = {}
    returns, levels, scores = [], [], []
    env = PhantomEscapeEnv(max_steps=MAX_EPISODE_STEPS, features=checkpoint_features(policy))
    try:
        for seed in range(EVAL_FIRST_SEED, EVAL_FIRST_SEED + episodes):
            observation, info = env.reset(seed=seed)
            layout = layout_results.setdefault(info["layout"], {"episodes": 0, "first_level_clears": 0})
            total_reward = 0.0
            while True:
                action, _ = policy.predict(observation, deterministic=True)
                observation, reward, terminated, truncated, info = env.step(action.item())
                total_reward += reward
                if terminated or truncated:
                    outcomes[info["outcome"] or "step_limit"] += 1
                    break
            returns.append(total_reward)
            scores.append(info["score"])
            levels.append(info["level"] - 1)
            layout["episodes"] += 1
            layout["first_level_clears"] += int(info["level"] > 1)
    finally:
        env.close()

    return {
        "episodes": episodes,
        "first_seed": EVAL_FIRST_SEED,
        "max_steps": MAX_EPISODE_STEPS,
        "mean_return": mean(returns),
        "mean_levels_cleared": mean(levels),
        "first_level_clear_rate": mean(level > 0 for level in levels),
        "mean_score": mean(scores),
        "outcomes": dict(outcomes),
        "starting_layouts": layout_results,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--steps", type=int, default=500_000, help="additional PPO transitions")
    parser.add_argument("--envs", type=int, default=4)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--stage", choices=("arena", "mixed"), default="arena")
    parser.add_argument("--features", choices=("grid", "navigation"), help="observation profile for a fresh policy")
    parser.add_argument("--imitation-episodes", type=int, default=0, help="attempt this many teacher demonstrations")
    parser.add_argument("--imitation-epochs", type=int, default=12)
    parser.add_argument("--output", type=Path, help="new directory for model and logs")
    model_source = parser.add_mutually_exclusive_group()
    model_source.add_argument("--resume", type=Path, help="resume from your own trusted PPO checkpoint")
    model_source.add_argument("--evaluate", type=Path, help="evaluate your own trusted checkpoint without training")
    parser.add_argument("--eval-episodes", type=int, default=20, help="0 to skip evaluation after training")
    args = parser.parse_args()
    if args.steps < 0 or args.envs < 1 or not 0 <= args.seed <= 2**32 - args.envs:
        parser.error("steps must be nonnegative, envs must be positive, and seeds must fit uint32")
    if args.imitation_episodes < 0 or args.imitation_epochs < 1:
        parser.error("imitation episodes must be nonnegative and imitation epochs must be positive")
    if args.imitation_episodes and (args.resume or args.evaluate):
        parser.error("imitation requires a new model")
    if args.features and (args.resume or args.evaluate):
        parser.error("the checkpoint determines the observation profile")
    if not (args.steps or args.imitation_episodes or args.evaluate):
        parser.error("specify PPO steps, imitation episodes, or a checkpoint to evaluate")
    if not (int(bool(args.evaluate)) <= args.eval_episodes <= EVAL_SEED_COUNT):
        parser.error("--eval-episodes must be 0–200, or 1–200 with --evaluate")
    if args.device == "cuda" and not torch.cuda.is_available():
        parser.error("PyTorch cannot see a CUDA device. Use --device cpu or check your WSL CUDA setup.")
    if args.device != "cuda":
        torch.set_num_threads(min(4, torch.get_num_threads()))

    if args.evaluate:
        policy = PPO.load(args.evaluate, device=args.device)
        print(json.dumps(evaluate(policy, args.eval_episodes), indent=2))
        return

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    output = args.output or Path("training-output/phantom-escape") / f"{args.stage}-{timestamp}"
    try:
        output.mkdir(parents=True, exist_ok=False)
    except FileExistsError:
        parser.error(f"output already exists: {output}. Choose a new directory.")
    loaded = PPO.load(args.resume, device=args.device, seed=args.seed) if args.resume else None
    features = checkpoint_features(loaded) if loaded else args.features or "grid"
    vec = DummyVecEnv([partial(make_training_env, args.stage == "arena", features) for _ in range(args.envs)])
    try:
        if loaded:
            if loaded.n_envs == vec.num_envs:
                policy = loaded
                policy.set_env(vec)
            else:
                policy = PPO.load(args.resume, env=vec, device=args.device, seed=args.seed)
            vec.seed(args.seed)
        else:
            navigation = features == "navigation"
            layers = [96, 64] if navigation else [64]
            policy_kwargs = {
                "features_extractor_class": NavigationFeatures if navigation else StateFeatures,
                "normalize_images": False, "net_arch": {"pi": layers, "vf": layers},
            }
            policy = PPO(
                "MultiInputPolicy", vec, device=args.device, seed=args.seed,
                n_steps=ROLLOUT_STEPS, batch_size=128, learning_rate=3e-4,
                gamma=.995, gae_lambda=.95, ent_coef=.01,
                policy_kwargs=policy_kwargs,
            )
        policy.set_logger(configure(str(output), ["stdout", "csv"]))
        print(f"Training on {policy.device} with {features} observations. Outputs: {output}", flush=True)
        if args.imitation_episodes:
            from .imitation import warm_start

            history = warm_start(policy, args.imitation_episodes, args.imitation_epochs,
                                 args.seed, arena_only=args.stage == "arena", features=features)
            (output / "imitation.json").write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")
            policy.save(output / "imitation")
        checkpoint = CheckpointCallback(
            save_freq=max(50_000 // args.envs, 1), save_path=str(output / "checkpoints"),
            name_prefix="state_ppo",
        )
        try:
            if args.steps:
                policy.learn(total_timesteps=args.steps, callback=checkpoint, reset_num_timesteps=not args.resume)
        except KeyboardInterrupt:
            policy.save(output / "interrupted")
            print(f"Saved interrupted checkpoint to {output / 'interrupted.zip'}")
            return
        if args.steps:
            policy.save(output / "state_ppo")
    finally:
        vec.close()

    if args.eval_episodes:
        metrics = json.dumps(evaluate(policy, args.eval_episodes), indent=2)
        (output / "evaluation.json").write_text(metrics + "\n", encoding="utf-8")
        print(metrics)


if __name__ == "__main__":
    main()
