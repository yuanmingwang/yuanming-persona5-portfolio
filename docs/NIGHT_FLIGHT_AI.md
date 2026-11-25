# How Night Flight's AI works

Night Flight uses a small vision model to locate the bird and pipes. A flight planner then chooses whether to flap. The CNN learns to recognize parts of an image, while the planner uses the game's gravity and flap strength to predict what a move will do.

## How the model learns

1. **Generate training frames.** [The sampler](../scripts/sample-night-flight.mjs) puts the bird and pipes in many positions, varies gap size and the background, and asks the [frame renderer](../src/demos/night-flight/frames.ts) to draw each scene. Each resulting image is 84 × 84 grayscale pixels. The local `training-output/night-flight/frames.bin` file stores those images as consecutive blocks of 7,056 bytes, with one byte per pixel.
2. **Create labels.** [The PyTorch trainer](../scripts/train-night-flight.py) uses the distinct grayscale values of the cream bird and bright pipe-cap highlights to label their pixels automatically. Other bright pixels are examples of background. The trainer weights the rarer bird and pipe-cap classes more heavily and reserves about one seventh of the frames for validation.
3. **Fit the CNN.** A 3 × 3 convolution learns eight filters that look at each pixel's neighborhood. A ReLU activation feeds their output into a 1 × 1 convolution, which assigns scores to three classes for each pixel. PyTorch adjusts the 107 trainable parameters to improve the classification and reports precision and recall on the held-out frames.
4. **Export the parameters.** The trainer writes the convolution weights and biases as four arrays in a JSON file. The chosen weights go in [`model.json`](../src/demos/night-flight/model.json). The original release used an equivalent network trained with NumPy, which is why the PyTorch export can use the same file format.

| JSON field | Shape | Role |
| --- | --- | --- |
| `kernels` | 8 × 9 | Eight first-layer filters, each flattened from 3 × 3 |
| `bias` | 8 | One bias per first-layer filter |
| `head` | 3 × 8 | One row of weights per output class |
| `outputBias` | 3 | One bias per output class |

## Bundled model

The bundled weights were trained with PyTorch 2.12.1 on CPU using 8,000 frames generated with seed `829761`. Training ran for 12 epochs at a batch size of 32, with 6,858 frames for training and 1,142 for validation. The exported weights matched the original NumPy model's scores on all 25 benchmark courses tested, with 21 courses reaching the 150-pipe cap. The optional `numpy-baseline.json` in the local training folder is an archive for reproducing that comparison. New candidates can use the bundled PyTorch weights as their benchmark baseline.

## How the AI flies in the browser

1. **Capture a frame.** The [canvas renderer](../src/demos/night-flight/render.ts) and the grayscale renderer share the same drawing commands. The grayscale renderer keeps the brightest source pixel in each output cell so narrow highlights survive downsampling. The game runs at 60 physics ticks per second and samples one image every two ticks.
2. **Find the bird and gap.** [TypeScript inference](../src/demos/night-flight/vision.ts) applies the exported filters to the current grayscale image. It combines bird pixels into a vertical position and pairs pipe-cap highlights to estimate the gap's position and height. These geometry estimates come from screen pixels.
3. **Choose a move.** The [pilot](../src/demos/night-flight/pilot.ts) tracks recent observations and when a flap actually happened. The [planner](../src/demos/night-flight/planner.ts) uses those estimates and the score-based scroll speed to simulate possible flap and glide sequences. It checks clearance at each physics tick and applies the first move from its best sequence. A new observation triggers a fresh decision.
4. **Show the decision.** [Night Flight](../src/demos/night-flight/NightFlight.tsx) executes the proposed flap in AI mode. In Human mode, the same result appears as a recommendation while your inputs control the bird. The [AI Vision panel](../src/demos/night-flight/FlightVision.tsx) displays the latest 84 × 84 grayscale input beside its color-coded CNN output, plus the previous three inputs, inferred heights, and decision time. Each output cell shows the predicted class for that input pixel. The model compares its three raw scores to pick a class, and the browser assigns pixels below its brightness cutoff directly to background.

## How to tell whether a model is better

The trainer's **precision and recall** measure whether it recognizes the right pixels. The [benchmark](../scripts/benchmark-night-flight.mjs) runs the full browser pilot against repeatable pipe layouts and measures how far it flies. A crash can come from a missed detection, an imprecise position estimate, or a poor choice of flap timing. The benchmark and the validation metrics help identify which part to look at.

See the [README training instructions](../README.md#train-the-night-flight-cnn) for setup, commands, and how to compare a candidate before bundling it.
