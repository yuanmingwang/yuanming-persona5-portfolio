// Match the project IDs shared by the local and published résumé CSVs.
const pageCounts = [
  ['comparative-tree-indexing-for-big-data', 7],
  ['data-driven-forecasting-of-newly-released-car-msrp', 7],
  ['end-to-end-synthetic-song-detection-with-transformer-based-models', 10],
  ['fairness-aware-loan-default-prediction', 13],
  ['intelligent-customer-support-ticket-triage', 15],
  ['mnist-digit-classification-with-pca-and-cnn', 12],
  ['multi-stage-iot-network-intrusion-detection', 9],
  ['tim-hortons-queueing-network-simulation', 19],
] as const

export const projectPapers: ReadonlyMap<string, { pages: number; path: string }> = new Map(
  pageCounts.map(([id, pages]) => [id, {
    pages,
    path: `documents/project-papers/${id.replaceAll('-', '_')}.pdf`,
  }]),
)
