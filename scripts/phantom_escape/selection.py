"""Keep the strongest validation checkpoint, including the starting policy."""

import json

from stable_baselines3.common.callbacks import BaseCallback

from .evaluation import VALIDATION_FIRST_SEED, evaluate, selection_key


class SelectCheckpoint(BaseCallback):
    def __init__(self, output, interval, episodes):
        super().__init__()
        self.output = output
        self.interval = interval
        self.episodes = episodes
        self.best_key = None
        self.best_step = None
        self.last_step = None

    def compare(self, model):
        step = model.num_timesteps
        if self.last_step == step:
            return
        metrics = evaluate(model, self.episodes, first_seed=VALIDATION_FIRST_SEED, first_level_only=True)
        self.last_step = step
        key = selection_key(metrics)
        improved = self.best_key is None or key > self.best_key
        if improved:
            self.best_key = key
            self.best_step = step
            model.save(self.output / "best_validation")
        with (self.output / "validation.jsonl").open("a", encoding="utf-8") as log:
            log.write(json.dumps({"step": step, "selected": improved, **metrics}) + "\n")
        print(f"Validation at {step:,} steps: {key[0]:.0%} clear, {key[1]:.0%} rooms, "
              f"best checkpoint at {self.best_step:,} steps", flush=True)

    def _on_step(self):
        return True

    def _on_rollout_start(self):
        # At a rollout start, PPO has already updated on the preceding rollout.
        if self.num_timesteps - self.last_step >= self.interval:
            self.compare(self.model)
