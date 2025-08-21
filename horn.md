I want to add **optional mounting features** to the horn:

* **Driver Mount (at the throat)**
* **Horn Mount (at the mouth)**

### Driver Mount (throat side)

* Always round.
* User defines:

  * Outer diameter
  * Bolt hole diameter
  * Bolt circle diameter (pattern)
* The mount connects its outer diameter to the throat shape (which can be any shape).
* Bolt holes are subtracted from the mount surface.
* Nothing should be explicitly defined for the throat itself within the mount function

### Horn Mount (mouth side)

* User defines an additional **mouth width extension**.

  * This extends the horn’s mouth size while keeping its shape.
* Bolt holes are defined by:

  * Maximum spacing between bolts
  * Bolts placed centered on the width, equally spaced along that width
* The horn mount is parallel to the horn mouth.

### General Rules

* Both mounts are **optional**.
* Both should be planar and parallel to the horn mouth/throat.
* Do not implement thickness to the mesh, it should remain a surface mesh only.
* Create new functions for the mounts, this should be modular and portable code.
* There should be one mesh that is created from three functions (driver mount, horn mount, and horn surface)
* Add UI support in the side bar and ensure clean and clear UX.