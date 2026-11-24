"""Train Night Flight's per-pixel CNN with PyTorch and export browser weights."""

import argparse
import json
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader

FRAME_SIZE = 84
FILTERS = 8
CLASSES = ("background", "bird", "pipe cap")
# captureFrame takes the maximum luminance in each output cell. The bird's
# cream ink and the cap's highlight have distinct luminance values.
BIRD_LUMINANCE = round(.299 * 255 + .587 * 244 + .114 * 223)
CAP_LUMINANCE = round(.299 * 255 + .587 * 155 + .114 * 168)
MIN_TRAINING_LUMINANCE = 45


class PixelCNN(nn.Sequential):
    def __init__(self):
        super().__init__(
            nn.Conv2d(1, FILTERS, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv2d(FILTERS, len(CLASSES), kernel_size=1),
        )

    def browser_weights(self):
        first, _, last = self
        return {
            "kernels": first.weight.detach().cpu().flatten(1).tolist(),
            "bias": first.bias.detach().cpu().tolist(),
            "head": last.weight.detach().cpu().flatten(1).tolist(),
            "outputBias": last.bias.detach().cpu().tolist(),
        }


def load_frames(path):
    size = path.stat().st_size
    if size % FRAME_SIZE ** 2 or size < 10 * FRAME_SIZE ** 2:
        raise ValueError(f"Expected at least 10 complete {FRAME_SIZE} × {FRAME_SIZE} raw frames.")
    frames = torch.from_file(str(path), size=size, dtype=torch.uint8)
    return frames.reshape(-1, FRAME_SIZE, FRAME_SIZE)


def pixel_labels(images):
    labels = torch.zeros_like(images, dtype=torch.long)
    labels[images == BIRD_LUMINANCE] = 1
    labels[images == CAP_LUMINANCE] = 2
    # Keep brighter background pixels as negative examples.
    labels[images < MIN_TRAINING_LUMINANCE] = -100
    return labels


def prepare_batch(images, device):
    labels = pixel_labels(images).to(device)
    pixels = images.unsqueeze(1).to(device, dtype=torch.float32) / 255
    return pixels, labels


@torch.inference_mode()
def validate(model, batches, device):
    model.eval()
    confusion = torch.zeros((len(CLASSES), len(CLASSES)), dtype=torch.long)
    for images in batches:
        pixels, labels = prepare_batch(images, device)
        prediction = model(pixels).argmax(dim=1).cpu()
        truth = labels.cpu()
        included = truth >= 0
        pairs = truth[included] * len(CLASSES) + prediction[included]
        confusion += pairs.bincount(minlength=confusion.numel()).reshape_as(confusion)
    for index, name in enumerate(CLASSES):
        true_positives = int(confusion[index, index])
        recall = true_positives / max(1, int(confusion[index].sum()))
        precision = true_positives / max(1, int(confusion[:, index].sum()))
        print(f"  {name:<10} precision {precision:.2%}  recall {recall:.2%}")


def choose_device(requested):
    if requested != "auto":
        return torch.device(requested)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def train(frames, epochs, batch_size, device):
    torch.manual_seed(85916)
    validation_count = max(1, len(frames) // 7)
    training = DataLoader(frames[:-validation_count], batch_size=batch_size, shuffle=True)
    validation = DataLoader(frames[-validation_count:], batch_size=batch_size)

    model = PixelCNN().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=.008)
    # Foreground pixels are rare, especially the thin pipe-cap highlights.
    loss_fn = nn.CrossEntropyLoss(weight=torch.tensor([.03, 1., 3.], device=device))
    print(f"Training on {device} with {len(training.dataset)} frames. Held out {validation_count}.")

    for epoch in range(epochs):
        model.train()
        total_loss = 0.
        for images in training:
            pixels, labels = prepare_batch(images, device)
            optimizer.zero_grad()
            loss = loss_fn(model(pixels), labels)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        print(f"Epoch {epoch + 1}/{epochs} mean loss {total_loss / len(training):.5f}", flush=True)

    print("Held-out bright-pixel results")
    validate(model, validation, device)
    return model


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frames", type=Path)
    parser.add_argument("model", type=Path)
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--device", choices=("auto", "cpu", "cuda", "mps"), default="auto")
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("--epochs and --batch-size must be positive")
    if args.model.exists():
        parser.error(f"{args.model} already exists. Choose a new path for the candidate weights.")
    model = train(load_frames(args.frames), args.epochs, args.batch_size, choose_device(args.device))
    with args.model.open("x", encoding="utf-8") as output:
        json.dump(model.browser_weights(), output, separators=(",", ":"))
        output.write("\n")
    print(f"Exported {args.model}")


if __name__ == "__main__":
    main()
