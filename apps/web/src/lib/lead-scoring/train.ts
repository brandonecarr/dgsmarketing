/**
 * Pure-JS logistic regression with L2 regularization, trained by batch gradient
 * descent. No external ML deps — keeps cold-start lambda time low and lets us
 * train per-tenant in a single request.
 */

export interface TrainSample {
  x: number[];
  y: 0 | 1; // 1 = won, 0 = lost
}

export interface TrainOpts {
  dim: number;
  epochs?: number;
  lr?: number;
  l2?: number;
}

export interface TrainedModel {
  weights: number[];
  trainSize: number;
  positives: number;
  accuracy: number;
  trainedAt: string;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function train(samples: TrainSample[], opts: TrainOpts): TrainedModel {
  const dim = opts.dim;
  const epochs = opts.epochs ?? 200;
  const lr = opts.lr ?? 0.05;
  const l2 = opts.l2 ?? 0.01;
  const weights = new Array(dim).fill(0);

  if (samples.length === 0) {
    return { weights, trainSize: 0, positives: 0, accuracy: 0, trainedAt: new Date().toISOString() };
  }

  for (let epoch = 0; epoch < epochs; epoch++) {
    const grad = new Array(dim).fill(0);
    for (const s of samples) {
      let z = 0;
      for (let j = 0; j < dim; j++) z += (weights[j] ?? 0) * (s.x[j] ?? 0);
      const p = sigmoid(z);
      const err = p - s.y;
      for (let j = 0; j < dim; j++) grad[j] = (grad[j] ?? 0) + err * (s.x[j] ?? 0);
    }
    // Apply L2 penalty (skip intercept at index 0).
    for (let j = 1; j < dim; j++) grad[j] = (grad[j] ?? 0) + l2 * (weights[j] ?? 0);
    for (let j = 0; j < dim; j++)
      weights[j] = (weights[j] ?? 0) - (lr / samples.length) * (grad[j] ?? 0);
  }

  // Train accuracy at threshold 0.5.
  let correct = 0;
  let positives = 0;
  for (const s of samples) {
    if (s.y === 1) positives += 1;
    let z = 0;
    for (let j = 0; j < dim; j++) z += (weights[j] ?? 0) * (s.x[j] ?? 0);
    const pred = sigmoid(z) >= 0.5 ? 1 : 0;
    if (pred === s.y) correct += 1;
  }

  return {
    weights,
    trainSize: samples.length,
    positives,
    accuracy: correct / samples.length,
    trainedAt: new Date().toISOString(),
  };
}

export function predict(model: TrainedModel, x: number[]): number {
  let z = 0;
  for (let j = 0; j < model.weights.length; j++) z += (model.weights[j] ?? 0) * (x[j] ?? 0);
  return sigmoid(z);
}
