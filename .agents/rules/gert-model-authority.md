---
trigger: always_on
---

# GERT Studio Specification Authority

For this workspace, the following specification hierarchy is mandatory.

1. `docs/MODEL.md` is the authoritative source for:
   - mathematical semantics
   - simulation semantics
   - item/resource behavior
   - activity execution
   - probability rules
   - concurrency and synchronization
   - cycles and deadlocks
   - stochastic behavior

2. `docs/PRODUCT.md` is the authoritative source for:
   - product goals
   - user-facing behavior
   - UX
   - feature scope
   - product terminology

3. If `PRODUCT.md` and `MODEL.md` disagree about mathematical or simulation
   behavior, `MODEL.md` takes precedence.

4. However, NEVER silently resolve a contradiction between the two documents.
   Report the contradiction to the user before implementing behavior affected
   by it.

5. Do not change the mathematical meaning of `docs/MODEL.md` without explicit
   user approval.

6. Do not modify `docs/MODEL.md` or `docs/PRODUCT.md` merely to make an
   implementation or test pass.

7. If implementation requirements are ambiguous, stop and ask rather than
   inventing new mathematical semantics.

8. Application code must conform to `docs/MODEL.md`; the frontend must not
   define independent simulation semantics.

Priority:

MODEL.md mathematical correctness
    >
PRODUCT.md product behavior
    >
implementation convenience
    >
UI convenience