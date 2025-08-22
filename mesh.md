**Goal:**
Update the horn mesher to support **driver mount** and **horn mount** as optional features. When present, they are always integrated into the horn body as **one watertight solid** suitable for STL export. No separate shells.

---

#### **Requirements**

1. **Offset-Based Horn Redefinition**

   * When a mount is present, the horn profile must be recalculated starting from (or ending at) the mount’s **offset plane**.
   * Example:

     * Driver mount thickness = `10 mm`
     * Wall thickness = `4 mm`
     * Horn profile must be recomputed so its *true starting point* is `10 mm` downstream of the mount face.
     * Throat radius at this point must be recalculated according to horn expansion + wall thickness.
   * Same logic applies at the horn mouth if a horn mount is defined.

2. **Interpolation at Mount Offsets**

   * Mount planes may fall **between existing horn sample points**.
   * Implement linear (or curve-based) interpolation to compute the horn’s radius at the exact offset location.
   * This ensures seamless continuation of the horn wall profile.

3. **Mount Geometry**

   * Mounts can be **rectangular, ellipse, or circle**.
   * The mount cutout must match the horn wall’s inner profile at the offset point.
   * The mount body thickness is extruded **outward** from the horn wall by the user-defined thickness.

4. **Solid Integration**

   * Horn mesh and mount mesh must be **stitched at their shared offset plane**.
   * Shared vertices must be welded — no overlap, no gaps.
   * The output is **always one continuous watertight solid**.

5. **Optional Mounts**

   * If no driver mount is defined → horn begins at throat as normal.
   * If no horn mount is defined → horn ends at mouth as normal.
   * Either or both may be present, but final output must still be one solid.

6. **Export**

   * Always output a **single manifold STL** (or equivalent mesh).
   * No option for `"separate"` shells.

---

#### **Acceptance Criteria**

* ✅ A mount at the throat shifts the horn’s start downstream by `mountThickness`.
* ✅ A mount at the mouth shifts the horn’s end upstream by `mountThickness`.
* ✅ Mount cutouts always match horn cross-section at the interface.
* ✅ Horn and mounts always export as **1 STL solid**.
* ✅ No overlaps, no duplicate shells, no gaps.
