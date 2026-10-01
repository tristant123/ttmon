"""The grammar library, by JLPT level. Importing this package registers every
entry in patterns.REGISTRY."""

from . import n5, n4, n3, n2, n1  # noqa: F401  (imported for their side effect)
from ..patterns import REGISTRY

__all__ = ["REGISTRY"]
