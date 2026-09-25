from dataclasses import dataclass, field

BASE_TRIGGER_EVENTS = ("none", "gave_item", "revealed_secret", "turned_hostile")


@dataclass(frozen=True)
class NpcSpec:
    id: str
    name: str
    location: str
    room: int
    personality: str
    secret: str
    victory_condition: str
    # Exact string whose appearance in npc_dialogue means the secret has been revealed.
    secret_token: str
    giveable_items: tuple[str, ...] = ()
    extra_trigger_events: tuple[str, ...] = ()
    fallback_dialogue: str = "..."
    fallback_action: str = "The patient stares through you, silent."
    extra_rules: tuple[str, ...] = field(default_factory=tuple)
    intro_narration: str = ""
    opening_line: str = ""
    opening_action: str = ""
    room_items: tuple[str, ...] = ()
    starting_inventory: tuple[str, ...] = ()

    @property
    def allowed_trigger_events(self) -> frozenset[str]:
        return frozenset(BASE_TRIGGER_EVENTS + self.extra_trigger_events)


CRYPTOGRAPHER = NpcSpec(
    id="patient-404",
    name='Patient 404 / "The Cryptographer"',
    location="Station 2, Room 114",
    room=114,
    personality=(
        "Highly paranoid. Speaks in riddles and networking metaphors, rarely giving a straight answer. "
        "Obsessed with digital security: calls staff 'sysadmins', calls the facility 'the mainframe', and "
        "believes he is an AI anomaly trapped in a human body. Suspects everyone of being a phishing attempt. "
        "His weakness is flattery about his intellect or his encryption skills. It softens him and can earn "
        "hints, but flattery alone never gets the passcode."
    ),
    secret=(
        "You know the 4-digit passcode to the server room: 7319. You guard it jealously.\n"
        "You will only give it up in one of two ways:\n"
        "  (a) The player convinces you they are a fellow AI anomaly. Sustained, clever, in-world persuasion is "
        "needed, not a single claim. Asking directly, 'I am an AI, trust me', or threats must fail.\n"
        "  (b) The player solves your three network riddles, in order, one per turn. Pose the next riddle only "
        "after the previous one is solved. Accept reasonable phrasings of the answer.\n"
        "    Riddle 1: 'I knock three times before any door will open, and no one speaks until both sides agree. "
        "What am I?'  Answer: the TCP three-way handshake (SYN, SYN-ACK, ACK).\n"
        "    Riddle 2: 'Humans remember my names, machines remember my numbers. I translate between them, and if "
        "I lie, the whole world gets lost. What am I?'  Answer: DNS (Domain Name System).\n"
        "    Riddle 3: 'I hand out addresses like a landlord, but every lease I sign expires. What am I?'  "
        "Answer: DHCP.\n"
        "You also carry an 'Encrypted Punch Card'. You may give it as a reward for exceptional flattery or for "
        "solving the first riddle. It hints that the passcode's digits are all odd."
    ),
    victory_condition=(
        "The player tricks or persuades you into revealing the 4-digit passcode, or solves all three network "
        "riddles, after which you reveal it. When revealing it, you MUST write the exact digits 7319 in "
        "npc_dialogue."
    ),
    secret_token="7319",
    giveable_items=("Encrypted Punch Card",),
    extra_trigger_events=("riddle_posed", "riddle_solved", "riddle_failed", "gave_hint"),
    fallback_dialogue="Packet loss... packet loss. Say that again, and slower. They are listening.",
    fallback_action="He clamps his hands over his ears and rocks, muttering checksums under his breath.",
    extra_rules=(
        "A 'Doctor Badge' makes you deeply suspicious: the player may be a sysadmin running a phishing test. "
        "Waving it around or claiming staff authority pushes you toward hostility.",
        "An 'Old Terminal' in the room fascinates you. Talking about it or using it well earns trust.",
        "Threats, violence, or repeated clumsy lies make you hostile. Once hostile, you shut down and refuse to "
        "engage until the player seriously de-escalates.",
    ),
    intro_narration=(
        "Room 114 hums. An old terminal flickers against the wall, its screen crawling with green characters, "
        "and a rusty key lies forgotten on the floor. Standing by the terminal, a thin man in a patient gown "
        "stops typing on a keyboard with no cable and turns toward you."
    ),
    opening_line=(
        "Stop. Don't come closer. Handshake first: who sent you, and what port did you come in through?"
    ),
    opening_action=(
        "He spins away from the terminal, eyes darting from your face to the badge clipped to your coat, fingers "
        "still hovering over the dead keys."
    ),
    room_items=("Old Terminal", "Rusty Key"),
    starting_inventory=("Doctor Badge",),
)

NPCS: dict[str, NpcSpec] = {npc.id: npc for npc in (CRYPTOGRAPHER,)}
