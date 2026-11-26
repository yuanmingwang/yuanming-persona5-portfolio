"""Train or evaluate a State or Vision PPO policy for Phantom Escape."""

import argparse
from datetime import datetime, timezone
from functools import partial
import json
from pathlib import Path

from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import CallbackList, CheckpointCallback
from stable_baselines3.common.logger import configure
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.vec_env import DummyVecEnv
import torch

from .env import PhantomEscapeEnv, TrainingMaps
from .evaluation import EVAL_SEED_COUNT, MAX_EPISODE_STEPS, checkpoint_features, evaluate
from .policy import NavigationFeatures, SpatialVisionFeatures, StateFeatures, VisionFeatures
from .selection import SelectCheckpoint

ROLLOUT_STEPS = 256


def make_training_env(stage, features):
    env = PhantomEscapeEnv(max_steps=MAX_EPISODE_STEPS, features=features)
    return Monitor(TrainingMaps(env, arena_only=stage == "arena", room_focus=stage == "room-focus"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--steps", type=int, default=500_000, help="additional PPO transitions")
    parser.add_argument("--envs", type=int, default=4)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--stage", choices=("arena", "mixed", "room-focus"), default="arena")
    parser.add_argument("--learning-rate", type=float, help="override the PPO learning rate")
    parser.add_argument("--select-every", type=int, default=0, help="enable checkpoint selection at this step interval")
    parser.add_argument("--validation-episodes", type=int, default=40, help="even number of validation seeds")
    parser.add_argument("--features", choices=("grid", "navigation", "vision", "vision-spatial"),
                        help="observation profile for a fresh policy")
    parser.add_argument("--imitation-episodes", type=int, default=0, help="attempt this many teacher demonstrations")
    parser.add_argument("--imitation-epochs", type=int, default=12)
    parser.add_argument("--output", type=Path, help="new directory for model and logs")
    model_source = parser.add_mutually_exclusive_group()
    model_source.add_argument("--resume", type=Path, help="resume from your own trusted PPO checkpoint")
    model_source.add_argument("--evaluate", type=Path, help="evaluate your own trusted checkpoint without training")
    model_source.add_argument("--initialize-navigation", type=Path,
                              help="initialize a spatial-vision policy from your own navigation checkpoint")
    parser.add_argument("--eval-episodes", type=int, default=20, help="0 to skip evaluation after training")
    args = parser.parse_args()
    if args.steps < 0 or args.envs < 1 or not 0 <= args.seed <= 2**32 - args.envs:
        parser.error("steps must be nonnegative, envs must be positive, and seeds must fit uint32")
    if args.imitation_episodes < 0 or args.imitation_epochs < 1:
        parser.error("imitation episodes must be nonnegative and imitation epochs must be positive")
    if args.learning_rate is not None and not 0 < args.learning_rate <= 1:
        parser.error("--learning-rate must be greater than 0 and at most 1")
    if args.select_every < 0 or (args.select_every and (not args.steps or args.evaluate)):
        parser.error("--select-every requires PPO training and a positive interval")
    if args.select_every and not (2 <= args.validation_episodes <= 200 and args.validation_episodes % 2 == 0):
        parser.error("--validation-episodes must be even and between 2 and 200")
    if args.imitation_episodes and (args.resume or args.evaluate):
        parser.error("imitation requires a new model")
    if args.features and (args.resume or args.evaluate):
        parser.error("the checkpoint determines the observation profile")
    if args.initialize_navigation and args.features != "vision-spatial":
        parser.error("--initialize-navigation requires --features vision-spatial")
    if not (args.steps or args.imitation_episodes or args.evaluate or args.initialize_navigation):
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
    overrides = {"learning_rate": args.learning_rate} if args.learning_rate is not None else {}
    loaded = PPO.load(args.resume, device=args.device, seed=args.seed, **overrides) if args.resume else None
    features = checkpoint_features(loaded) if loaded else args.features or "grid"
    vec = DummyVecEnv([partial(make_training_env, args.stage, features) for _ in range(args.envs)])
    selector = SelectCheckpoint(output, args.select_every, args.validation_episodes) if args.select_every else None
    try:
        if loaded:
            if loaded.n_envs == vec.num_envs:
                policy = loaded
                policy.set_env(vec)
            else:
                policy = PPO.load(args.resume, env=vec, device=args.device, seed=args.seed, **overrides)
            vec.seed(args.seed)
        else:
            vision = features.startswith("vision")
            extractors = {"grid": StateFeatures, "navigation": NavigationFeatures, "vision": VisionFeatures,
                          "vision-spatial": SpatialVisionFeatures}
            layers = [96, 64] if features in ("navigation", "vision-spatial") else [64]
            policy_kwargs = {
                "features_extractor_class": extractors[features],
                "normalize_images": vision, "net_arch": {"pi": layers, "vf": layers},
            }
            policy = PPO(
                "MultiInputPolicy", vec, device=args.device, seed=args.seed,
                n_steps=64 if vision else ROLLOUT_STEPS, batch_size=16 if vision else 128,
                n_epochs=4 if vision else 10, learning_rate=args.learning_rate or 3e-4,
                gamma=.995, gae_lambda=.95, ent_coef=.01,
                policy_kwargs=policy_kwargs,
            )
            if args.initialize_navigation:
                source = PPO.load(args.initialize_navigation, device=args.device)
                if checkpoint_features(source) != "navigation":
                    parser.error("--initialize-navigation expects a navigation policy")
                policy.policy.features_extractor.initialize_from_navigation(source.policy.features_extractor)
                policy.policy.mlp_extractor.load_state_dict(source.policy.mlp_extractor.state_dict())
                policy.policy.action_net.load_state_dict(source.policy.action_net.state_dict())
                policy.policy.value_net.load_state_dict(source.policy.value_net.state_dict())
                policy.save(output / "spatial_initial")
        policy.set_logger(configure(str(output), ["stdout", "csv"]))
        print(f"Training on {policy.device} with {features} observations. Outputs: {output}", flush=True)
        if args.imitation_episodes:
            from .imitation import warm_start

            history = warm_start(policy, args.imitation_episodes, args.imitation_epochs,
                                 args.seed, arena_only=args.stage == "arena", features=features,
                                 keep_normalization=bool(args.initialize_navigation))
            (output / "imitation.json").write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")
            policy.save(output / "imitation")
        checkpoint = CheckpointCallback(
            save_freq=max(50_000 // args.envs, 1), save_path=str(output / "checkpoints"),
            name_prefix="vision_ppo" if features.startswith("vision") else "state_ppo",
        )
        try:
            if args.steps:
                if selector:
                    selector.compare(policy)
                callbacks = CallbackList([checkpoint, selector]) if selector else checkpoint
                policy.learn(total_timesteps=args.steps, callback=callbacks, reset_num_timesteps=not args.resume)
                if selector:
                    selector.compare(policy)
        except KeyboardInterrupt:
            policy.save(output / "interrupted")
            print(f"Saved interrupted checkpoint to {output / 'interrupted.zip'}")
            return
        if args.steps:
            policy.save(output / ("vision_ppo" if features.startswith("vision") else "state_ppo"))
    finally:
        vec.close()

    if args.eval_episodes:
        if selector:
            policy = PPO.load(output / "best_validation.zip", device=args.device)
        result = evaluate(policy, args.eval_episodes)
        if selector:
            result.update(checkpoint="best_validation.zip", selected_step=selector.best_step)
        metrics = json.dumps(result, indent=2)
        (output / "evaluation.json").write_text(metrics + "\n", encoding="utf-8")
        print(metrics)


if __name__ == "__main__":
    main()
