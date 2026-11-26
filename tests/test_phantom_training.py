"""Test the training interface and replay its checkpoints through the Python process."""

import importlib.util
import unittest

from scripts.phantom_escape.client import SimulatorClient


class TestReplay(unittest.TestCase):
    def test_teacher_labels_replay_through_normal_training_actions(self):
        with SimulatorClient() as expert, SimulatorClient() as simulator:
            initial = expert.request("reset", seed=5301)
            self.assertEqual(simulator.request("reset", seed=5301), initial)
            for _ in range(600):
                result = expert.request("expert")
                action = result.pop("action")
                self.assertEqual(simulator.request("step", action=action), result)
                if result["info"]["level"] == 2:
                    break
            self.assertEqual(result["info"]["level"], 2)

    def test_golden_collision_replay(self):
        expected_events = [
            (86, ["alert_enemy_detect_player"]),
            (102, ["alert_enemy_detect_player"]),
            (121, ["death"]),
        ]
        with SimulatorClient() as simulator:
            spec = simulator.request("spec")
            self.assertEqual(spec["gridShape"], [7, 24, 40])
            self.assertEqual(spec["actionCount"], 9)
            start = simulator.request("reset", seed=7)
            sequence = [1, 2, 3, 4, 5, 6, 7, 8, 0]
            events = []
            for step in range(121):
                result = simulator.request("step", action=sequence[(step // 5) * 7 % 9])
                if result["transition"]["events"]:
                    events.append((step + 1, result["transition"]["events"]))
            self.assertEqual(events, expected_events)
            self.assertEqual(result["info"], {
                "seed": 7, "level": 1, "score": 0, "outcome": "caught", "layout": "arena",
                "ticksLeft": 2876, "coins": 0, "quota": 12,
            })
            self.assertEqual(result["transition"]["ticks"], 4)
            self.assertAlmostEqual(result["transition"]["reward"], -10 - .005 * 4 / 6)
            self.assertEqual(simulator.request("reset", seed=7), start)


@unittest.skipUnless(importlib.util.find_spec("gymnasium"), "Gymnasium is not installed")
class TestGymnasium(unittest.TestCase):
    def test_spatial_vision_profile_keeps_rgb_and_pixel_derived_moves(self):
        import numpy as np
        from gymnasium.utils.env_checker import check_env
        from scripts.phantom_escape.env import PhantomEscapeEnv

        with PhantomEscapeEnv(features="vision-spatial") as env:
            check_env(env, skip_render_check=True)
            observation, info = env.reset(seed=5301)
            self.assertTrue(env.observation_space.contains(observation))
            self.assertEqual(observation["moves"].shape, (99,))
            with SimulatorClient() as bridge:
                reference = bridge.request("reset", seed=5301, features="vision-spatial")
            self.assertEqual(reference["info"], info)
            np.testing.assert_array_equal(observation["moves"], np.asarray(reference["observation"]["moves"], dtype=np.float32))

    def test_vision_stack_uses_latest_pixels_and_reset_clears_history(self):
        import numpy as np
        from gymnasium.utils.env_checker import check_env
        from scripts.phantom_escape.env import PhantomEscapeEnv

        with PhantomEscapeEnv(features="vision") as env:
            check_env(env, skip_render_check=True)
            initial, info = env.reset(seed=5301)
            self.assertEqual(initial["frames"].shape, (12, 192, 320))
            self.assertEqual(initial["frames"].dtype, np.uint8)
            np.testing.assert_array_equal(initial["frames"][:3], initial["frames"][9:])
            next_observation, _, _, _, _ = env.step(3)
            np.testing.assert_array_equal(next_observation["frames"][:-3], initial["frames"][3:])
            self.assertFalse(np.array_equal(next_observation["frames"][9:], initial["frames"][9:]))
            replay, replay_info = env.reset(seed=5301)
            self.assertEqual(info, replay_info)
            np.testing.assert_array_equal(replay["frames"], initial["frames"])

    def test_room_focus_keeps_both_starting_layouts(self):
        from collections import Counter
        from scripts.phantom_escape.env import PhantomEscapeEnv, TrainingMaps

        with TrainingMaps(PhantomEscapeEnv(features="navigation"), room_focus=True) as env:
            _, first = env.reset(seed=2026)
            counts = Counter(env.reset()[1]["layout"] for _ in range(120))
            self.assertEqual(env.reset(seed=2026)[1], first)
        self.assertGreater(counts["rooms"], counts["arena"])
        self.assertGreater(counts["arena"], 0)

    def test_first_level_validation_tracks_both_layouts(self):
        from types import SimpleNamespace
        import numpy as np
        from scripts.phantom_escape.evaluation import VALIDATION_FIRST_SEED, evaluate, selection_key

        class IdlePolicy:
            observation_space = SimpleNamespace(spaces={"moves": None})

            def predict(self, observation, deterministic):
                self_shape = observation["moves"].shape
                if self_shape != (99,) or not deterministic:
                    raise AssertionError("Expected deterministic navigation observations")
                return np.array(0), None

        metrics = evaluate(IdlePolicy(), 2, first_seed=VALIDATION_FIRST_SEED, first_level_only=True)
        self.assertEqual(metrics["max_steps"], 600)
        self.assertEqual(sum(metrics["outcomes"].values()), 2)
        self.assertEqual(metrics["starting_layouts"], {
            "rooms": {"episodes": 1, "first_level_clears": 0},
            "arena": {"episodes": 1, "first_level_clears": 0},
        })
        self.assertEqual(selection_key(metrics)[:2], (0, 0))

    def test_navigation_observations_match_arcade_replay(self):
        from gymnasium.utils.env_checker import check_env
        from scripts.phantom_escape.env import PhantomEscapeEnv

        navigation = PhantomEscapeEnv(features="navigation")
        self.addCleanup(navigation.close)
        check_env(navigation, skip_render_check=True)
        observation, info = navigation.reset(seed=5301)
        self.assertEqual(observation["moves"].shape, (99,))
        self.assertNotIn("grid", observation)
        with SimulatorClient() as simulator:
            self.assertEqual(simulator.request("reset", seed=5301)["info"], info)
            for action in range(9):
                projected = navigation.step(action)
                original = simulator.request("step", action=action)
                self.assertTrue(navigation.observation_space.contains(projected[0]))
                self.assertEqual(projected[1], original["transition"]["reward"])
                self.assertEqual(projected[4]["score"], original["info"]["score"])
                self.assertEqual(projected[4]["events"], original["transition"]["events"])

    def test_training_maps_use_reproducible_seeds_outside_evaluation_range(self):
        from scripts.phantom_escape.env import PhantomEscapeEnv, TrainingMaps

        env = TrainingMaps(PhantomEscapeEnv(), arena_only=True)
        self.addCleanup(env.close)
        _, first = env.reset(seed=2026)
        _, second = env.reset()
        _, replay = env.reset(seed=2026)
        self.assertEqual(first, replay)
        self.assertNotEqual(first["seed"], second["seed"])
        for info in (first, second):
            self.assertGreaterEqual(info["seed"], 1 << 24)
            self.assertEqual(info["layout"], "arena")

    def test_contract(self):
        from gymnasium.error import ResetNeeded
        from gymnasium.utils.env_checker import check_env
        from scripts.phantom_escape.env import PhantomEscapeEnv

        env = PhantomEscapeEnv(max_steps=10)
        self.addCleanup(env.close)
        check_env(env, skip_render_check=True)
        with self.assertRaises(ValueError):
            env.step(99)
        observation, info = env.reset(seed=0)
        self.assertTrue(env.observation_space.contains(observation))
        self.assertEqual(info["seed"], 0)
        for _ in range(10):
            observation, _, terminated, truncated, _ = env.step(0)
        self.assertFalse(terminated)
        self.assertTrue(truncated)
        self.assertTrue(env.observation_space.contains(observation))
        with self.assertRaises(ResetNeeded):
            env.step(0)


if __name__ == "__main__":
    unittest.main()
