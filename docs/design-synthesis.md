# Design arena synthesis

## Rubric and scores

The cross-judge used five criteria: complete camera workflows; local privacy; state ownership; smallest maintainable POC; and model packaging for localhost or HTTPS.

| Candidate | Workflows | Privacy | State model | POC scope | Packaging | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 5 | 5 | 4 | 4 | 5 | 23/25 |
| B | 4 | 5 | 3 | 4 | 4 | 20/25 |
| C | 4 | 5 | 3 | 3 | 4 | 19/25 |

The independent cross-judge selected A. Candidate A keeps camera and enrollment policy in one controller, with a model adapter and a clear tagged session state. The runner and judge both identified the sample-consistency and atomic unique-name checks as required before implementation.

## Grafts and rejections

- From B, use a small-face enrollment check and tagged outcomes for no face, multiple faces, duplicate names, and storage errors.
- From C, parse stored descriptors at the storage boundary, reject inconsistent enrollment samples, and normalize duplicate-name checks.
- Use React for the view so UI updates do not require manual DOM replacement. The `FaceDemo` controller remains the single owner of session state.
- Use localStorage for this small profile list. IndexedDB transactions and cross-tab synchronization do not earn their added lifecycle code in this POC.
- Reject the UI-owned camera loop from C. Reject B's independent camera, recognition, and busy fields. Keep inference scheduling in the controller.
- Defer workers and liveness checks. The POC has no evidence that they are needed, and it must state that a match is not identity proof.

## Verification

No candidate code was used directly. The implementation was reviewed against the selected state and privacy boundaries. `npm run build` succeeds and emits all six model assets. The local preview showed both tabs and reached the model-ready state; each model asset returned HTTP 200 from the same origin, and the browser console had no warnings or errors. Camera capture, saved enrollment, and a real recognition result were not exercised because camera permission was not granted during review.
