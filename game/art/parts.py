"""Part-building helpers for sprite authoring.

Hand-counting 64- or 80-character rows does not work: a single miscounted
dot bends a whole wing. These build silhouettes from outlines (spans,
ellipse, plume), sweep limbs and tails along paths (tube), mirror faces from
half-rows (sym), place parts by anchor (pin) and turn them (turn, rotate) -
which is also how poses are made: the same parts, moved.
"""

import math

from .shading import M

# The one shared material: the catch-light in an eye. Flat, because light
# must not bevel it.
GLINT = M((255, 255, 255), "gem", flat=True)


def canvas(w=64, h=64):
    """A blank grid to stamp parts onto.

    Placing wings, tails and limbs as separate pieces at chosen coordinates is
    far less error-prone than writing one 64-character line per row and
    counting dots, and it makes a part reusable between creatures."""
    return [["."] * w for _ in range(h)]


def stamp(cv, x, y, rows, onto=False):
    """Paint a part onto the canvas; '.' in the part leaves what was there.

    With `onto`, the part only paints where the canvas already has something:
    markings, rings and stripes can be drawn loosely and clip to the body."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == "." or not (0 <= y + j < len(cv)):
                continue
            if 0 <= x + i < len(cv[0]) and not (onto and cv[y + j][x + i] == "."):
                cv[y + j][x + i] = ch
    return cv


def spans(w, rows, fill, edge=None):
    """Build a part from per-row (start, end) inclusive spans.

    Organic silhouettes - wings, fins, tails, manes - are the one thing that
    is genuinely harder to author as literal rows than as an outline, because
    a single miscounted dot bends the whole curve. Giving the outline and
    letting this fill it keeps those shapes smooth. `edge` traces the first
    and last pixel of every run, which is where a membrane wants its rib.
    A width of None fits the part to its widest span.
    """
    if w is None:
        w = max(s[1] for s in rows if s is not None) + 1
    out = []
    for span in rows:
        line = ["."] * w
        if span is not None:
            x0, x1 = span
            for x in range(x0, x1 + 1):
                line[x] = fill
            if edge:
                line[x0] = line[x1] = edge
        out.append("".join(line))
    return out


def vein(rows, a, b, ch):
    """Draw a line onto a part, for wing ribs and similar tracery.

    Only paints where the part already has something, so a rib can be aimed
    past the rim without spilling into the transparent surround."""
    grid = [list(r) for r in rows]
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        t = i / n if n else 0.0
        x = round(x0 + (x1 - x0) * t)
        y = round(y0 + (y1 - y0) * t)
        if 0 <= y < len(grid) and 0 <= x < len(grid[y]) and grid[y][x] != ".":
            grid[y][x] = ch
    return ["".join(r) for r in grid]


def rows_of(w, *lines):
    """Literal rows for a part, checked for width so a miscount fails loudly
    at import instead of shearing the sprite."""
    for ln in lines:
        if len(ln) != w:
            raise ValueError("part row is %d wide, expected %d: %r" % (len(ln), w, ln))
    return list(lines)


def sym(*halves):
    """Rows mirrored about the centre: author the left half, get both.

    Faces and bodies are symmetric, and half the characters is half the
    chances to miscount. Anything that must not mirror - the glint in each
    eye sits on the same side, because the light does - is patched after."""
    return [h + h[::-1] for h in halves]


def plume(h, x0, x1, bow, w_max, w_base=2, w_tip=1, peak=0.55):
    """Spans for a curved plume - a tail, a feather, a flame - base at the
    bottom row and tip at the top.

    The centre line runs from x0 at the base to x1 at the tip and bows out by
    `bow`; the width swells from `w_base` to `w_max` at `peak` of the way up
    and closes to `w_tip`. Feed the result to spans()."""
    import math
    out = []
    for y in range(h):
        t = 1 - y / (h - 1)
        cx = x0 + (x1 - x0) * t + bow * math.sin(math.pi * t)
        if t < peak:
            w = w_base + (w_max - w_base) * math.sin(0.5 * math.pi * t / peak)
        else:
            w = w_tip + (w_max - w_tip) * math.cos(
                0.5 * math.pi * (t - peak) / (1 - peak))
        out.append((max(0, int(round(cx - w / 2))), int(round(cx + w / 2))))
    return out


def recolour(rows, band, frm, to):
    """Swap one material for another within a range of rows."""
    out = list(rows)
    for y in range(*band):
        if 0 <= y < len(out):
            out[y] = out[y].replace(frm, to)
    return out


def inset(rows, frm, to, by=1):
    """Recolour the interior of a region, leaving a border `by` pixels wide.

    Used for the inside of an ear, the belly of a shell, the pale core of a
    flame: anything that is the same shape as its container, but smaller."""
    grid = [list(r) for r in rows]
    h, w = len(grid), max(len(r) for r in grid)
    def at(x, y):
        return rows[y][x] if 0 <= y < h and 0 <= x < len(rows[y]) else "."
    for y in range(h):
        for x in range(len(grid[y])):
            if rows[y][x] != frm:
                continue
            if all(at(x + dx, y + dy) == frm
                   for dx in range(-by, by + 1) for dy in range(-by, by + 1)):
                grid[y][x] = to
    return ["".join(r) for r in grid]


def turn(rows):
    """Rotate a part a quarter-turn anticlockwise: what pointed up now points
    left. plume() only grows vertically; this lays one on its side."""
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, ".") for r in rows]
    return ["".join(rows[j][w - 1 - i] for j in range(len(rows)))
            for i in range(w)]


def pin(cv, rows, anchor, at, flip=False):
    """Stamp a part so that its `anchor` pixel lands on canvas point `at`.

    Composing by anchor - the base of a leaf goes on the crown, the root of a
    tail on the hip - survives resizing a part, and `flip` mirrors it with the
    anchor mirrored too, so a pair of limbs is one call each."""
    ax, ay = anchor
    if flip:
        rows = mirror(rows)
        ax = max(len(r) for r in rows) - 1 - ax
    return stamp(cv, at[0] - ax, at[1] - ay, rows)


def base_of(rows):
    """The anchor at the middle of a part's bottom row: where a plume grows
    from."""
    last = rows[-1]
    xs = [i for i, c in enumerate(last) if c != "."]
    return ((xs[0] + xs[-1]) // 2, len(rows) - 1)


def ellipse(w, h):
    """Spans filling a w x h ellipse: bodies, heads, shells, dishes."""
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    out = []
    for y in range(h):
        t = (y - cy) / (h / 2.0)
        half = (w / 2.0) * max(0.0, 1.0 - t * t) ** 0.5
        a, b = int(round(cx - half + 0.5)), int(round(cx + half - 0.5))
        out.append((a, b) if b >= a else None)
    return out


def tube(cv, path, fill, belly=None, steps=6):
    """Sweep a disc along a path of (x, y, radius) points: serpents, tails,
    tentacles, necks. The radius is interpolated between points, so a body
    can thicken and taper along its length.

    `belly` paints a narrower stripe offset toward the viewer - the pale
    underside of a snake - after the whole body is down, so a coil passing
    in front of itself keeps its underside on the near side."""
    pts = []
    for (x0, y0, r0), (x1, y1, r1) in zip(path, path[1:]):
        n = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) * steps / 4))
        for i in range(n):
            t = i / n
            pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t,
                        r0 + (r1 - r0) * t))
    pts.append(path[-1])

    def disc(cx, cy, r, ch, onto=False):
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if not (0 <= y < len(cv) and 0 <= x < len(cv[0])):
                    continue
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    if not onto or cv[y][x] != ".":
                        cv[y][x] = ch

    for cx, cy, r in pts:
        disc(cx, cy, r, fill)
    if belly:
        for cx, cy, r in pts:
            if r >= 2.5:
                disc(cx, cy + r * 0.5, r * 0.42, belly, onto=True)
    return cv


def scales(cv, frm, to, period=5, box=None):
    """Draw a diamond scale lattice over one material. Snakes really are
    patterned like this; it is drawn, not a shader texture, so it can be
    confined to the back and kept off the belly."""
    x0, y0, x1, y1 = box or (0, 0, len(cv[0]), len(cv))
    for y in range(y0, y1):
        for x in range(x0, x1):
            if cv[y][x] == frm and ((x + y) % period == 0 or (x - y) % period == 0):
                cv[y][x] = to
    return cv


def feather(length, width, fill, edge="N"):
    """A flight feather pointing right, for stacking into a wing. Its long
    edges are traced in `N`, the wing's crease colour."""
    sp = plume(length, 2, 3, 1, width, w_base=2, peak=0.6)
    return mirror(turn(spans(None, sp, fill, edge=edge)))


def wing(lengths, tones, gap=3, edge="N"):
    """Feathers stacked top to bottom, all rooted at the left edge. The lower
    feather is laid over the one above, and neighbours alternate tone, so
    each one reads on its own instead of the wing fusing into a paddle."""
    cv = canvas(max(lengths) + 2, gap * len(lengths) + 6)
    for i, n in enumerate(lengths):
        fill, tip = tones[i % len(tones)]
        f = feather(n, 6, fill, edge)
        f = [r[:n - 5] + r[n - 5:].replace(fill, tip) for r in f]
        stamp(cv, 0, i * gap, f)
    return finish(cv)


def mirror(rows):
    return ["".join(reversed(r)) for r in rows]


def finish(cv):
    return ["".join(r) for r in cv]


def rotate(rows, degrees, pivot=None):
    """Turn a part by any angle about `pivot` (default: its centre), for
    poses - a sword mid-swing, an arm thrown up. Nearest-neighbour, into a
    canvas big enough to hold the result; the pivot keeps its position, so
    pin() the result by the same anchor as the unrotated part."""
    h = len(rows)
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, ".") for r in rows]
    px, py = pivot if pivot else ((w - 1) / 2.0, (h - 1) / 2.0)
    a = math.radians(degrees)
    ca, sa = math.cos(a), math.sin(a)
    # the rotated part's bounds, relative to the pivot
    corners = [(x - px, y - py) for x in (0, w - 1) for y in (0, h - 1)]
    xs = [cx * ca - cy * sa for cx, cy in corners]
    ys = [cx * sa + cy * ca for cx, cy in corners]
    x0, y0 = int(math.floor(min(xs))) - 1, int(math.floor(min(ys))) - 1
    x1, y1 = int(math.ceil(max(xs))) + 1, int(math.ceil(max(ys))) + 1
    out = []
    for oy in range(y0, y1 + 1):
        line = []
        for ox in range(x0, x1 + 1):
            # inverse-map each output pixel into the source
            sx = ox * ca + oy * sa + px
            sy = -ox * sa + oy * ca + py
            ix, iy = int(round(sx)), int(round(sy))
            if 0 <= ix < w and 0 <= iy < h:
                line.append(rows[iy][ix])
            else:
                line.append(".")
        out.append("".join(line))
    # where the pivot now sits in the output
    return out, (-x0, -y0)


def pin_rotated(cv, rows, anchor, at, degrees, flip=False):
    """Rotate a part about its anchor and stamp it so the anchor lands on
    `at`: an arm swung from the shoulder, a blade from the hilt."""
    if flip:
        rows = mirror(rows)
        anchor = (max(len(r) for r in rows) - 1 - anchor[0], anchor[1])
        degrees = -degrees
    out, piv = rotate(rows, degrees, anchor)
    return stamp(cv, at[0] - piv[0], at[1] - piv[1], out)
