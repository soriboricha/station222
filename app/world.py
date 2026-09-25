from dataclasses import dataclass, field


@dataclass(frozen=True)
class Station:
    id: int
    name: str
    # Odd room numbers line one side of the corridor, even numbers the other.
    first_room: int
    last_room: int
    spawns: dict[str, int] = field(default_factory=dict)

    def has_room(self, number: int) -> bool:
        return self.first_room <= number <= self.last_room


STATION = Station(
    id=2,
    name="Station 2",
    first_room=101,
    last_room=140,
    spawns={"player1": 116, "player2": 136},
)
