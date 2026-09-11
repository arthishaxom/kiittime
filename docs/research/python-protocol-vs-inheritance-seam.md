# Research: Python `typing.Protocol` vs Strict Inheritance for Compute Seams

## Primary Sources
1. **Python Official PEP 544**: [PEP 544 – Protocols: Structural subtyping (static duck typing)](https://peps.python.org/pep-0544/) (Levkivskyi, Lehtosalo, Langa)
2. **Python Official `typing` Module Documentation**: [`typing.Protocol`](https://docs.python.org/3/library/typing.html#typing.Protocol)
3. **Python Official PEP 484**: [PEP 484 – Type Hints](https://peps.python.org/pep-0484/) (Guido van Rossum, Jukka Lehtosalo, Łukasz Langa)
4. **Martin Fowler / Clean Code**: *Refactoring: Improving the Design of Existing Code* (Code Smells: Refused Bequest, Middle Man)
5. **Java SE Language Specification**: Chapter 9 Interfaces (Nominal typing in Java vs Structural typing in Go/Python PEP 544)

---

## 1. What Exact Problem Does `typing.Protocol` Solve?

### The Python Dichotomy Problem (PEP 544 Motivation)
Before PEP 544 (Python 3.8+), Python developers faced an architectural contradiction:
1. **Dynamic Duck Typing (Runtime)**: Python philosophy has always been *"If it walks like a duck and quacks like a duck, it's a duck."* Functions did not care about class hierarchy, only available methods.
2. **Nominal Typing (Static Analysis with PEP 484 `ABC`)**: Type checkers (MyPy, Pyright) required explicit inheritance: `def fn(x: BaseReader): ...` would reject any object that wasn't an explicit subclass of `BaseReader`, completely breaking Python's native duck-typing philosophy for static analysis.

### The Solution: Static Duck Typing
PEP 544 introduced **Structural Subtyping** (`Protocol`):
- A class satisfies a `Protocol` if and only if its public interface (method names, parameter types, return types) matches the protocol definition.
- **No inheritance required**. Type checkers inspect the structure of the class at compile/lint time.

---

## 2. Why Are We Not Using Strict Inheritance (`class BaseReader(ABC)`) Here?

In our codebase, the compute seam has two distinct concrete implementations:
- `LocalAnalyticsReader`: Reads Delta tables from local disk/R2 via PyArrow and runs DuckDB queries locally.
- `MotherDuckAnalyticsReader`: Connects to MotherDuck cloud over SSL, authenticates with a server token, and executes SQL over `delta_scan()`.

### The 4 Technical Reasons Strict Inheritance Breaks Down:

### Reason 1: The "Refused Bequest" & Fragile Base Class Problem
*(Source: Fowler, Refactoring)*
When classes inherit from an ABC or shared base class, base classes inevitably accumulate helper state or methods (e.g. `_load_pyarrow_table()`, `_setup_local_storage()`).
- `LocalAnalyticsReader` needs local storage options, PyArrow table references, and local DuckDB connection setups.
- `MotherDuckAnalyticsReader` requires cloud secrets, statement timeout configurations, remote authentication tokens, and remote retry loops.
- If `MotherDuckAnalyticsReader` inherits `LocalAnalyticsReader` or a shared concrete base, it inherits methods and state variables it explicitly refuses to use (*Refused Bequest*), creating latent `AttributeError` bugs if any shared method assumes local storage paths exist.

### Reason 2: Strict Decorator Composition (`_FallbackReader`)
`_FallbackReader` is a **decorator** (Wrapper) that implements the exact same interface:
```python
class _FallbackReader:
    def __init__(self, primary: AnalyticsReader):
        self._primary = primary
    def dashboard(self, days: int) -> DashboardData:
        ...
```
With `Protocol`:
- `_FallbackReader` takes *any* reader (`LocalAnalyticsReader`, `MotherDuckAnalyticsReader`, or a third-party mock), and itself *is* an `AnalyticsReader`.
- With strict ABCs, the decorator must artificially inherit `BaseAnalyticsReader` even though it delegates all work to an inner instance.

### Reason 3: Zero-Import Seam Decoupling (Dependency Inversion Principle)
*(Source: Clean Architecture, Robert C. Martin)*
- The consumer (`backend.api.routers.analytics`) needs to know only the *contract* (`AnalyticsReader`).
- The implementations (`LocalAnalyticsReader`, `MotherDuckAnalyticsReader`) do **not** need to import the protocol or any base class from the router.
- This prevents circular import graphs and enables swapping readers via configuration without module entanglement.

### Reason 4: Zero-Boilerplate Unit Testing & Mocking
With strict ABC:
- Every test mock must import `BaseAnalyticsReader` and execute its `__init__` chain.
With `Protocol`:
- A test mock is a 3-line isolated class:
```python
class MockReader:
    def dashboard(self, days: int) -> DashboardData:
        return DashboardData(...)
```

---

## 3. How Does `Protocol` Compare to Interfaces in Java, Go, and TypeScript?

| Language | Feature | Typing System | Inheritance Required? |
| :--- | :--- | :--- | :--- |
| **Java** | `interface` | **Nominal** (Name-based) | **YES** (`class Foo implements Bar`) |
| **TypeScript**| `interface` / `type` | **Structural** (Shape-based) | **NO** (Shape matching only) |
| **Go** | `type Bar interface` | **Structural** (Shape-based) | **NO** (Implicit implementation) |
| **Python** | `class Bar(Protocol)` | **Structural** (PEP 544) | **NO** (Implicit implementation) |

### Is Python `Protocol` like Java's `interface`?
- **Conceptually**: Yes—both define pure behavioral contracts with no implementation.
- **Mechanically**: **No, Python `Protocol` is identical to Go / TypeScript interfaces, not Java.**
  - In **Java**, you *must* explicitly type `class MyReader implements ReaderInterface`. If you forget `implements`, Java rejects the class even if all methods are identical.
  - In **Python (PEP 544)** and **Go**, you do *not* write `implements`. The compiler/type checker automatically verifies that the class satisfies the protocol by examining its method shapes.

---

## 4. Verification & Standards Summary

1. **PEP 544 Compliance**: `AnalyticsReader` defines the structural shape for any analytics engine.
2. **Compile-Time Verification**: `basedpyright` and `mypy` statically enforce that all implementations match `def dashboard(self, days: int) -> DashboardData`.
3. **Zero Runtime Overhead**: At runtime, standard Python dynamic method invocation executes without base class metadata traversal overhead.
