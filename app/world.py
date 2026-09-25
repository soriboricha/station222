"""Station 2 floor plan, in meters.

x grows east and z grows south, matching the drawn map (north/kitchen at the top, garden to the east).
Walls are segments with openings; the client derives geometry, collision and per-side wall
materials (from the rooms on either side) from this data.
"""

from math import pi
from typing import Any

WALL_HEIGHT = 3.0
FENCE_HEIGHT = 2.6

# Grid lines taken from the map.
A, B, C, D, E, F, G, HX = 0.0, 6.4, 9.6, 15.2, 18.2, 21.2, 27.6, 46.8
Z_KITCHEN, Z_ROW1, Z_ROW2, Z_DINING, Z_ROW3 = 0.0, 6.5, 13.0, 15.0, 20.2
Z_SMOKING, Z_NORTHPOLE, Z_DIAGONAL = 22.9, 24.8, 23.1
Z_LOUNGE, Z_ROW5, Z_THERAPY, Z_END = 27.5, 34.0, 40.3, 48.7

DOOR_WIDTHS = {"door": 1.1, "glass": 1.1, "double": 2.2, "double_glass": 2.2, "gate": 2.4, "window": 1.4}
DOOR_KINDS = {"door", "glass", "double", "double_glass", "gate"}


def rect(x0: float, z0: float, x1: float, z1: float) -> list[list[float]]:
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]


def opening(pos: float, kind: str = "door", *, into: str | None = None, label: str | None = None,
            width: float | None = None, locked: bool = False, sign: bool | None = None) -> dict[str, Any]:
    """`pos` is the absolute x (horizontal walls) or z (vertical walls), or a 0..1 fraction on diagonals."""
    return {
        "pos": pos,
        "kind": kind,
        "into": into,
        "label": label,
        "width": width or DOOR_WIDTHS.get(kind, 1.1),
        "locked": locked,
        "sign": (kind in DOOR_KINDS and label is not None) if sign is None else sign,
    }


def wall(a: tuple[float, float], b: tuple[float, float], *openings: dict[str, Any],
         material: str | None = None, height: float = WALL_HEIGHT) -> dict[str, Any]:
    (ax, az), (bx, bz) = a, b
    length = ((bx - ax) ** 2 + (bz - az) ** 2) ** 0.5
    converted = []
    for o in openings:
        if az == bz:
            at = abs(o["pos"] - ax)
        elif ax == bx:
            at = abs(o["pos"] - az)
        else:
            at = o["pos"] * length
        converted.append({k: v for k, v in o.items() if k != "pos"} | {"at": round(at, 3)})
    return {"a": [ax, az], "b": [bx, bz], "material": material, "height": height, "openings": converted}


def prop(kind: str, x: float, z: float, rot: float = 0.0, **extra: Any) -> dict[str, Any]:
    return {"type": kind, "x": x, "z": z, "rot": rot, **extra}


def beds_west(zs: list[float]) -> list[dict[str, Any]]:
    """Beds with the headboard against the west wall of the left-hand rooms."""
    return [prop("bed", A + 0.1 + 1.05, z, pi / 2) for z in zs]


def beds_north(z_wall: float, xs: list[float]) -> list[dict[str, Any]]:
    return [prop("bed", x, z_wall + 0.1 + 1.05, 0.0) for x in xs]


def beds_south(z_wall: float, xs: list[float]) -> list[dict[str, Any]]:
    return [prop("bed", x, z_wall - 0.1 - 1.05, pi) for x in xs]


def room(room_id: str, name: str, polygon: list[list[float]], *, floor: str = "tile", wall_style: str = "plaster",
         outdoor: bool = False, light: dict[str, Any] | None = None, npc_spot: list[float] | None = None,
         props: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "id": room_id,
        "name": name,
        "polygon": polygon,
        "floor": floor,
        "wall_style": wall_style,
        "outdoor": outdoor,
        "light": light,
        "npc_spot": npc_spot,
        "props": props or [],
    }


WARM = {"color": "#ffe3b8", "intensity": 7}
COOL = {"color": "#e4fff0", "intensity": 9}

NURSES_OFFICE = [
    [C, Z_DINING], [E, Z_DINING], [E, 17.1], [D, 17.1], [D, 19.5], [E, 19.5], [E, 23.2],
    [D, 23.2], [D, 25.5], [E, 25.5], [E, Z_LOUNGE], [B, Z_LOUNGE], [C, Z_DIAGONAL],
]
RIGHT_CORRIDOR = [
    [E, Z_DINING], [F, Z_DINING], [F, Z_LOUNGE], [E, Z_LOUNGE], [E, 25.5], [D, 25.5], [D, 23.2],
    [E, 23.2], [E, 19.5], [D, 19.5], [D, 17.1], [E, 17.1],
]

GARDEN_TREES = [(31.0, 5.0), (38.0, 8.5), (44.0, 4.0), (33.5, 14.0), (42.0, 15.5), (30.5, 32.0),
                (37.0, 35.0), (44.0, 31.0), (33.0, 43.0), (41.0, 44.5), (45.0, 39.5)]

ROOMS: list[dict[str, Any]] = [
    room("kitchen", "Kitchen", rect(B, Z_KITCHEN, F, Z_ROW1), floor="checker", wall_style="tile", light=COOL, props=[
        prop("counter", 9.0, 0.45, w=4.0), prop("stove", 12.4, 0.45), prop("counter", 16.0, 0.45, w=4.0),
        prop("fridge", 20.3, 0.5), prop("counter", 13.8, 3.4, w=3.2, island=True),
    ]),
    room("dining", "Dining Hall", rect(B, Z_ROW1, F, Z_DINING), floor="checker", light=WARM, props=[
        prop("dining_table", x, z) for x in (9.8, 13.8, 17.8) for z in (9.6, 12.4)
    ]),
    room("136", "Room 136", rect(A, Z_ROW1, B, Z_ROW2), props=beds_west([7.6, 9.75, 11.9])),
    room("134", "Room 134", rect(A, Z_ROW2, B, Z_ROW3), props=beds_west([15.2, 18.0])),
    room("isolation", "Isolation", rect(A, Z_ROW3, B, Z_LOUNGE), floor="padded", wall_style="padded",
         light={"color": "#f2f6ff", "intensity": 6}, npc_spot=[3.6, 23.2],
         props=[prop("floor_mattress", 1.5, 23.6)]),
    room("116", "Room 116", rect(A, Z_LOUNGE, B, Z_ROW5), props=beds_west([28.65, 30.75, 32.85])),
    room("114", "Room 114", rect(A, Z_ROW5, B, Z_THERAPY), npc_spot=[4.2, 38.4], props=[
        *beds_west([35.8, 38.6]),
        prop("painting", 4.0, Z_ROW5 + 0.11, 0.0, w=1.4, h=0.9, art="map"),
    ]),
    room("leftcorr", "Side Corridor", [[B, Z_DINING], [C, Z_DINING], [C, Z_DIAGONAL], [B, Z_LOUNGE]], floor="corridor"),
    room("nurses", "Nurses' Office", NURSES_OFFICE, floor="linoleum", light=COOL, props=[
        prop("desk", 12.4, 17.4), prop("desk", 12.4, 20.6), prop("cabinet", C + 0.35, 18.2, pi / 2),
        prop("cabinet", C + 0.35, 19.3, pi / 2), prop("cabinet", E - 0.35, 21.3, -pi / 2),
    ]),
    room("corridor", "Corridor", RIGHT_CORRIDOR, floor="corridor", light=COOL, props=[
        prop("water_cooler", F - 0.35, 19.0, -pi / 2),
    ]),
    room("lounge", "Lounge", rect(B, Z_LOUNGE, F, Z_THERAPY), floor="carpet", wall_style="warm", light=WARM, props=[
        prop("tv", 12.1, Z_LOUNGE + 0.12), prop("sofa", 10.9, 31.4, pi), prop("sofa", 13.3, 31.4, pi),
        prop("coffee_table", 12.1, 29.9), prop("armchair", 16.0, 30.4, -pi / 2), prop("ping_pong", 13.8, 36.2),
        prop("plant", 7.0, 39.7), prop("plant", 20.6, 39.7),
    ]),
    room("therapy", "Therapy Room", rect(B, Z_THERAPY, F, Z_END), floor="wood", wall_style="warm", light=WARM, props=[
        prop("chair_circle", 13.8, 44.6, r=2.2, n=8), prop("big_plant", 20.4, 48.0),
        prop("whiteboard", 13.8, Z_END - 0.12, pi),
    ]),
    room("135", "Room 135", rect(F, Z_ROW1, G, Z_ROW2), props=beds_north(Z_ROW1, [23.0, 25.8])),
    room("133", "Room 133", rect(F, Z_ROW2, G, Z_ROW3), wall_style="wallpaper", light=WARM, npc_spot=[24.4, 16.6], props=[
        *beds_south(Z_ROW3, [23.0, 25.8]),
        *[prop("bookshelf", x, Z_ROW2 + 0.28) for x in (22.9, 24.15, 25.4, 26.65)],
        prop("book_pile", 26.9, 15.1), prop("book_pile", 21.8, 17.3), prop("book_pile", 26.8, 19.1),
        prop("book_pile", 24.4, 18.0), prop("gramophone", 21.75, 15.6),
        *[prop("painting", F + 0.11, z, pi / 2, w=0.9, h=1.1, art=f"obscure-{i}") for i, z in enumerate((15.9, 17.6, 19.2))],
        *[prop("painting", G - 0.11, z, -pi / 2, w=0.9, h=1.2, art=f"obscure-{i + 3}") for i, z in enumerate((14.3, 18.7))],
        prop("painting", 24.4, Z_ROW3 - 0.11, pi, w=1.3, h=0.9, art="drowned-choir"),
    ]),
    room("smoking", "Smoking Room", rect(F, Z_ROW3, G, Z_SMOKING), floor="dark", wall_style="stained",
         light={"color": "#ffd28a", "intensity": 4}, props=[
             prop("bench", 23.4, Z_ROW3 + 0.35, w=1.8), prop("bench", 25.9, Z_ROW3 + 0.35, w=1.8),
             prop("ashtray", 24.6, 22.2),
         ]),
    room("passage", "Garden Entrance", rect(F, Z_SMOKING, G, Z_NORTHPOLE), floor="corridor"),
    room("117", "Room 117", rect(F, Z_NORTHPOLE, G, Z_LOUNGE), npc_spot=[24.0, 26.2], props=[
        prop("bed", G - 0.1 - 1.05, 26.35, -pi / 2), prop("wheelchair", 24.0, 26.2, pi), prop("radio", 22.0, 27.1),
    ]),
    room("115", "Room 115", rect(F, Z_LOUNGE, G, Z_ROW5), props=beds_north(Z_LOUNGE, [23.0, 25.8])),
    room("113", "Room 113", rect(F, Z_ROW5, G, Z_THERAPY), npc_spot=[24.4, 38.7], props=[
        *beds_north(Z_ROW5, [23.0, 25.8]),
        prop("terminal", 24.4, Z_THERAPY - 0.45, pi), prop("rusty_key", 22.6, 37.9),
    ]),
    room("garden", "Garden", rect(G, Z_KITCHEN, HX, Z_END), floor="grass", outdoor=True, props=[
        prop("path", 37.2, 23.85, w=HX - G - 0.4, d=1.6),
        *[prop("tree", x, z) for x, z in GARDEN_TREES],
        prop("garden_bench", 34.0, 22.3), prop("garden_bench", 40.0, 25.4, pi),
        prop("lamp", 32.0, 25.3), prop("lamp", 42.0, 22.4), prop("keypad", HX - 0.13, 22.3, -pi / 2),
        *[prop("bush", 46.0, z) for z in (3.0, 9.0, 15.0, 32.0, 38.0, 45.0)],
    ]),
]

WALLS: list[dict[str, Any]] = [
    # Kitchen shell
    wall((B, Z_KITCHEN), (F, Z_KITCHEN)),
    wall((B, Z_KITCHEN), (B, Z_ROW1)),
    wall((F, Z_KITCHEN), (F, Z_ROW1)),
    # Row z = 6.5: north walls of 136 / 135 and the kitchen doors
    wall((A, Z_ROW1), (B, Z_ROW1)),
    wall((B, Z_ROW1), (F, Z_ROW1), opening(13.8, "double", into="kitchen", label="Kitchen")),
    wall((F, Z_ROW1), (G, Z_ROW1)),
    # West facade with windows
    wall((A, Z_ROW1), (A, Z_THERAPY),
         opening(9.75, "window"), opening(16.6, "window"), opening(30.75, "window"), opening(37.15, "window")),
    # Left room dividers
    *[wall((A, z), (B, z)) for z in (Z_ROW2, Z_ROW3, Z_LOUNGE, Z_ROW5, Z_THERAPY)],
    # Centre-west wall: left rooms open onto dining hall, side corridor and lounge
    wall((B, Z_ROW1), (B, Z_THERAPY),
         opening(9.75, into="136", label="136"), opening(14.0, into="134", label="134"),
         opening(24.9, into="isolation", label="Isolation"), opening(30.75, into="116", label="116"),
         opening(37.15, into="114", label="114")),
    # Dining hall south wall with the door to the side corridor
    wall((B, Z_DINING), (E, Z_DINING), opening(7.8, into="leftcorr", label="Side Corridor", sign=False)),
    # Nurses' office
    wall((C, Z_DINING), (C, Z_DIAGONAL)),
    wall((C, Z_DIAGONAL), (B, Z_LOUNGE), opening(0.5, "glass", into="nurses", label="Nurses' Office", sign=False)),
    wall((B, Z_LOUNGE), (E, Z_LOUNGE)),
    wall((E, Z_DINING), (E, 17.1)),
    wall((E, 17.1), (D, 17.1)),
    wall((D, 17.1), (D, 19.5), opening(18.3, into="nurses", label="Nurses' Office")),
    wall((D, 19.5), (E, 19.5)),
    wall((E, 19.5), (E, 23.2)),
    wall((E, 23.2), (D, 23.2)),
    wall((D, 23.2), (D, 25.5), opening(24.35, into="nurses", label="Nurses' Office")),
    wall((D, 25.5), (E, 25.5)),
    wall((E, 25.5), (E, Z_LOUNGE)),
    # Centre-east wall: right rooms, the open passage to the garden entrance
    wall((F, Z_ROW1), (F, Z_THERAPY),
         opening(9.75, into="135", label="135"), opening(13.9, into="133", label="133"),
         opening(23.85, "open", width=Z_NORTHPOLE - Z_SMOKING), opening(30.75, into="115", label="115"),
         opening(37.15, into="113", label="113")),
    # Right room dividers
    wall((F, Z_ROW2), (G, Z_ROW2)),
    wall((F, Z_ROW3), (G, Z_ROW3)),
    wall((F, Z_SMOKING), (G, Z_SMOKING), opening(22.6, into="smoking", label="Smoking Room")),
    wall((F, Z_NORTHPOLE), (G, Z_NORTHPOLE), opening(22.6, into="117", label="117")),
    wall((F, Z_LOUNGE), (G, Z_LOUNGE)),
    wall((F, Z_ROW5), (G, Z_ROW5)),
    wall((F, Z_THERAPY), (G, Z_THERAPY)),
    # East facade: glass doors from the right rooms into the garden
    wall((G, Z_ROW1), (G, Z_THERAPY),
         opening(9.75, "glass", into="135", label="Garden Door"), opening(16.6, "glass", into="133", label="Garden Door"),
         opening(21.55, "window"), opening(23.85, "glass", into="passage", label="Garden Door"),
         opening(26.15, "window"), opening(30.75, "glass", into="115", label="Garden Door"),
         opening(37.15, "glass", into="113", label="Garden Door")),
    # Lounge / therapy
    wall((B, Z_THERAPY), (F, Z_THERAPY), opening(13.8, "double_glass", into="therapy", label="Therapy Room")),
    wall((B, Z_THERAPY), (B, Z_END)),
    wall((F, Z_THERAPY), (F, Z_END)),
    wall((B, Z_END), (F, Z_END)),
    # Garden wall with the locked gate
    wall((G, Z_KITCHEN), (HX, Z_KITCHEN), material="brick", height=FENCE_HEIGHT),
    wall((HX, Z_KITCHEN), (HX, Z_END), opening(23.85, "gate", into="garden", label="Garden Gate", locked=True),
         material="brick", height=FENCE_HEIGHT),
    wall((G, Z_END), (HX, Z_END), material="brick", height=FENCE_HEIGHT),
    wall((G, Z_KITCHEN), (G, Z_ROW1), material="brick", height=FENCE_HEIGHT),
    wall((G, Z_THERAPY), (G, Z_END), material="brick", height=FENCE_HEIGHT),
]

for _wall_index, _wall in enumerate(WALLS):
    for _opening_index, _opening in enumerate(_wall["openings"]):
        _opening["id"] = f"w{_wall_index}o{_opening_index}"

SPAWNS: dict[str, dict[str, Any]] = {
    # Facing the door on the east wall (camera looks down -Z at yaw 0, so yaw -pi/2 looks east).
    "player1": {"room": "116", "x": 4.3, "z": 30.75, "yaw": -pi / 2},
    "player2": {"room": "136", "x": 4.3, "z": 9.75, "yaw": -pi / 2},
}

STATION: dict[str, Any] = {
    "station_id": 2,
    "station_name": "Station 2",
    "wall_height": WALL_HEIGHT,
    "spawns": SPAWNS,
    "rooms": ROOMS,
    "walls": WALLS,
}

ROOM_IDS = {r["id"] for r in ROOMS}
