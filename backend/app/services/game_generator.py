import copy
import hashlib
import json
import random
import re
from functools import lru_cache
from typing import Any, Optional

from app.services.progress_service import local_today

FEEDBACK_PHRASES = [
    "Great job!",
    "You did it!",
    "Let's try another one!",
    "You're learning something new!",
    "Wonderful effort!",
]

_WEEK_KEY_RE = re.compile(r"^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$")

ALPHABET_BANK = [
    ("A", "🍎", "Apple"),
    ("B", "🐻", "Bear"),
    ("C", "🐱", "Cat"),
    ("D", "🐶", "Dog"),
    ("E", "🐘", "Elephant"),
    ("F", "🐸", "Frog"),
    ("G", "🍇", "Grapes"),
    ("H", "🏠", "House"),
    ("I", "🍦", "Ice Cream"),
    ("J", "🪼", "Jellyfish"),
    ("K", "🪁", "Kite"),
    ("L", "🦁", "Lion"),
    ("M", "🌙", "Moon"),
    ("N", "🪺", "Nest"),
    ("O", "🦉", "Owl"),
    ("P", "🐧", "Penguin"),
    ("Q", "👑", "Queen"),
    ("R", "🌈", "Rainbow"),
    ("S", "☀️", "Sun"),
    ("T", "🐯", "Tiger"),
    ("U", "☂️", "Umbrella"),
    ("V", "🎻", "Violin"),
    ("W", "🐳", "Whale"),
    ("X", "🎸", "Xylophone"),
    ("Y", "🪀", "Yo-Yo"),
    ("Z", "🦓", "Zebra"),
]

COUNTING_OBJECTS = [
    ("🍎", "red apples"),
    ("🥭", "sweet mangoes"),
    ("⭐", "shining stars"),
    ("🦆", "yellow ducks"),
    ("🍓", "sweet strawberries"),
    ("🎈", "bright balloons"),
    ("🍌", "sweet saging bananas"),
    ("🍊", "juicy oranges"),
    ("🌸", "sampaguita flowers"),
    ("🦋", "fluttering butterflies"),
    ("🐠", "friendly fish"),
    ("🍪", "yummy pandesal rolls"),
    ("🐥", "little chicks"),
    ("🍒", "sweet cherries"),
]

ADDITION_PROBLEMS = [
    (1, 1, "🍎", "apples"),
    (2, 1, "🍌", "bananas"),
    (1, 2, "🍓", "strawberries"),
    (2, 2, "🍊", "oranges"),
    (3, 1, "🎈", "balloons"),
    (1, 3, "⭐", "stars"),
    (2, 3, "🍉", "watermelon slices"),
    (3, 2, "🦆", "ducks"),
    (4, 1, "🍪", "cookies"),
    (3, 3, "🦋", "butterflies"),
    (4, 2, "🌸", "flowers"),
    (2, 4, "🍇", "grape bunches"),
    (5, 1, "🐠", "fish"),
    (4, 3, "🍒", "cherries"),
    (5, 2, "🐥", "chicks"),
    (4, 4, "🧸", "teddy bears"),
    (5, 3, "🚀", "rockets"),
    (6, 2, "🌈", "rainbows"),
]

COLOR_PALETTE = [
    ("red", "#FF6B6B", "Red"),
    ("blue", "#78C8F5", "Sky Blue"),
    ("yellow", "#FFE58A", "Sunshine Yellow"),
    ("green", "#9BE7C4", "Mint Green"),
    ("purple", "#B8A5F5", "Lavender Purple"),
    ("coral", "#FF9C8C", "Coral Peach"),
    ("orange", "#FFA94D", "Tangerine Orange"),
    ("pink", "#F783AC", "Rosy Pink"),
    ("teal", "#66D9E8", "Ocean Teal"),
    ("gold", "#FCC419", "Golden Sun"),
]

COLOR_NOUNS = ["balloon", "star", "crayon", "bubble", "ribbon", "paint splash"]

PATTERN_TOKENS = [
    ("red", "🔴", "Red Circle"),
    ("blue", "🔵", "Blue Circle"),
    ("yellow", "🟡", "Yellow Circle"),
    ("star", "⭐", "Star"),
    ("moon", "🌙", "Moon"),
    ("sun", "☀️", "Sun"),
    ("apple", "🍎", "Apple"),
    ("banana", "🍌", "Banana"),
    ("grape", "🍇", "Grapes"),
    ("flower", "🌸", "Flower"),
    ("leaf", "🍃", "Leaf"),
    ("tree", "🌳", "Tree"),
    ("heart", "💛", "Heart"),
    ("cloud", "☁️", "Cloud"),
    ("butterfly", "🦋", "Butterfly"),
    ("bee", "🐝", "Honeybee"),
]

ANIMAL_SOUND_BANK = [
    ("cow", "🐮", "Cow", "Moo moo!"),
    ("cat", "🐱", "Cat", "Meow meow!"),
    ("dog", "🐶", "Dog", "Woof woof!"),
    ("duck", "🦆", "Duck", "Quack quack!"),
    ("frog", "🐸", "Frog", "Ribbit ribbit!"),
    ("sheep", "🐑", "Sheep", "Baa baa!"),
    ("pig", "🐷", "Pig", "Oink oink!"),
    ("lion", "🦁", "Lion", "Roar!"),
    ("bird", "🐦", "Bird", "Tweet tweet!"),
    ("owl", "🦉", "Owl", "Hoo hoo!"),
    ("bee", "🐝", "Bee", "Buzz buzz!"),
    ("chick", "🐥", "Chick", "Cheep cheep!"),
    ("chicken", "🐔", "Chicken", "Cluck cluck!"),
    ("horse", "🐴", "Horse", "Neigh!"),
    ("goat", "🐐", "Goat", "Maa maa!"),
    ("elephant", "🐘", "Elephant", "Pawoo!"),
    ("rooster", "🐓", "Rooster", "Cock-a-doodle-doo!"),
    ("monkey", "🐵", "Monkey", "Ooh ooh aah aah!"),
]

VOCAB_BANK = [
    ("umbrella", "☂️", "Umbrella", "keeps us dry in the rain"),
    ("bicycle", "🚲", "Bicycle", "rolls happily on two wheels"),
    ("book", "📚", "Storybook", "is full of exciting pictures and tales"),
    ("rainbow", "🌈", "Rainbow", "shines with bright arcs in the sky"),
    ("butterfly", "🦋", "Butterfly", "flutters gently around garden flowers"),
    ("clock", "⏰", "Clock", "helps us tell morning and bedtime"),
    ("backpack", "🎒", "Backpack", "carries our crayons and snacks to school"),
    ("toothbrush", "🪥", "Toothbrush", "helps keep our teeth sparkling clean"),
    ("mango", "🥭", "Sweet Mango", "is our bright golden tropical fruit"),
    ("guitar", "🎸", "Guitar", "plays cheerful musical notes"),
    ("hat", "👒", "Sun Hat", "shades our face on sunny walks"),
    ("apple", "🍎", "Red Apple", "is a crunchy healthy fruit"),
    ("jeepney", "🚌", "School Jeepney", "takes neighbors safely around town"),
    ("flower", "🌸", "Sampaguita Flower", "blooms brightly in the morning garden"),
    ("cup", "🥛", "Milk Cup", "holds warm milk or cool water"),
    ("kite", "🪁", "Saranggola Kite", "flies high when the afternoon wind blows"),
    ("lantern", "🏮", "Parol Star Lantern", "glows warmly for family celebrations"),
    ("crayon", "🖍️", "Crayon", "draws colorful lines on paper"),
    ("sailboat", "⛵", "Bangka Boat", "floats smoothly across blue waters"),
    ("shoe", "👟", "Sneaker", "keeps our feet comfy when running"),
    ("drum", "🥁", "Drum", "goes boom-tap when we keep rhythm"),
    ("cloud", "☁️", "Fluffy Cloud", "drifts lazily across the blue sky"),
]

FEELINGS_SCENARIOS = [
    (
        "Tala earned a shiny gold star! How does she feel?",
        "Tala got a shiny star sticker! Which face shows how she feels?",
        "⭐",
        {"key": "happy", "emoji": "😊", "label": "Happy"},
        [
            {"key": "sleepy", "emoji": "😴", "label": "Sleepy"},
            {"key": "sad", "emoji": "😢", "label": "Sad"},
            {"key": "worried", "emoji": "😟", "label": "Worried"},
        ],
    ),
    (
        "Lito's sweet mango slice fell onto the grass. How might he feel?",
        "Oh no, Lito's mango dropped! How might he feel?",
        "🥭",
        {"key": "sad", "emoji": "😢", "label": "Sad"},
        [
            {"key": "excited", "emoji": "🤩", "label": "Excited"},
            {"key": "silly", "emoji": "😜", "label": "Silly"},
            {"key": "proud", "emoji": "😁", "label": "Proud"},
        ],
    ),
    (
        "Ana takes slow breaths like smelling a sampaguita flower. How does she feel?",
        "Ana breathes slowly in and out. How does she feel now?",
        "🌸",
        {"key": "calm", "emoji": "😌", "label": "Calm"},
        [
            {"key": "surprised", "emoji": "😮", "label": "Surprised"},
            {"key": "sleepy", "emoji": "😴", "label": "Sleepy"},
            {"key": "angry", "emoji": "😠", "label": "Grumpy"},
        ],
    ),
    (
        "Lola opens a surprise box of warm pandesal! Which face looks surprised?",
        "Pop! A surprise gift from Lola! Which face looks surprised?",
        "🎁",
        {"key": "surprised", "emoji": "😮", "label": "Surprised"},
        [
            {"key": "calm", "emoji": "😌", "label": "Calm"},
            {"key": "sleepy", "emoji": "😴", "label": "Sleepy"},
            {"key": "sad", "emoji": "😢", "label": "Sad"},
        ],
    ),
    (
        "A friend asks for a turn with the wooden blocks. What shows kindness?",
        "Your friend asks nicely for a turn with the blocks. What shows kindness?",
        "🧱",
        {"key": "share", "emoji": "🤝", "label": "Share & Take Turns"},
        [
            {"key": "hide", "emoji": "🙈", "label": "Hide the Toys"},
            {"key": "rush", "emoji": "🏃", "label": "Run Away"},
            {"key": "frown", "emoji": "😣", "label": "Say Never"},
        ],
    ),
    (
        "You helped Kuya tidy up all the crayons after art time! How might you feel?",
        "You put every crayon neatly back in the box! How might you feel?",
        "🖍️",
        {"key": "proud", "emoji": "😁", "label": "Proud"},
        [
            {"key": "scared", "emoji": "😨", "label": "Scared"},
            {"key": "sleepy", "emoji": "😴", "label": "Sleepy"},
            {"key": "sad", "emoji": "😢", "label": "Sad"},
        ],
    ),
    (
        "It is bedtime after reading a cozy story with Nanay. Which face looks sleepy?",
        "Time to snuggle into bed! Which face looks sleepy?",
        "🌙",
        {"key": "sleepy", "emoji": "😴", "label": "Sleepy"},
        [
            {"key": "excited", "emoji": "🤩", "label": "Wide Awake"},
            {"key": "surprised", "emoji": "😮", "label": "Surprised"},
            {"key": "happy", "emoji": "😊", "label": "Bouncy"},
        ],
    ),
    (
        "You see a classmate sitting alone at story circle. What is caring?",
        "A friend sits alone on their first day. What is a welcoming choice?",
        "💛",
        {"key": "invite", "emoji": "👋", "label": "Smile & Say Hi"},
        [
            {"key": "ignore", "emoji": "🙄", "label": "Turn Away"},
            {"key": "shout", "emoji": "📢", "label": "Shout Loudly"},
            {"key": "hide", "emoji": "🙈", "label": "Hide"},
        ],
    ),
    (
        "Tomorrow is our family trip to the park! How do the children feel?",
        "Hooray! Tomorrow is the family picnic! Which face shows excited?",
        "🧺",
        {"key": "excited", "emoji": "🤩", "label": "Excited"},
        [
            {"key": "bored", "emoji": "🥱", "label": "Bored"},
            {"key": "sad", "emoji": "😢", "label": "Sad"},
            {"key": "calm", "emoji": "😌", "label": "Sleepy"},
        ],
    ),
    (
        "When greeting Lolo and Lola at home, what shows respect and care?",
        "Lolo and Lola arrived! How do we greet our elders politely?",
        "🏡",
        {"key": "mano", "emoji": "🙏", "label": "Say Po & Mano"},
        [
            {"key": "push", "emoji": "💢", "label": "Ignore Them"},
            {"key": "yell", "emoji": "📢", "label": "Shout Loudly"},
            {"key": "rush", "emoji": "🏃", "label": "Run Past"},
        ],
    ),
    (
        "A friend accidentally bumps your block tower. What is a gentle response?",
        "Oops, a friend bumped your tower by mistake! What is a kind response?",
        "🗼",
        {"key": "rebuild", "emoji": "🫶", "label": "Rebuild Together"},
        [
            {"key": "stomp", "emoji": "🦶", "label": "Stomp Feet"},
            {"key": "frown", "emoji": "😠", "label": "Be Mean"},
            {"key": "throw", "emoji": "💥", "label": "Throw Blocks"},
        ],
    ),
    (
        "Before tasting a sweet new tropical fruit, how might a curious learner feel?",
        "What a colorful new fruit to explore! Which feeling fits curiosity?",
        "🍍",
        {"key": "curious", "emoji": "🧐", "label": "Curious"},
        [
            {"key": "sleepy", "emoji": "😴", "label": "Sleepy"},
            {"key": "sad", "emoji": "😢", "label": "Sad"},
            {"key": "angry", "emoji": "😠", "label": "Grumpy"},
        ],
    ),
    (
        "A stranger online asks for your home address. What is the safe rule?",
        "What should children always do instead of sharing personal info?",
        "🛡️",
        {"key": "ask_adult", "emoji": "🧑‍🏫", "label": "Tell a Grown-Up"},
        [
            {"key": "reply", "emoji": "💬", "label": "Answer Stranger"},
            {"key": "click", "emoji": "🔗", "label": "Click Unknown Link"},
            {"key": "secret", "emoji": "🤫", "label": "Keep It Secret"},
        ],
    ),
    (
        "Heavy rain and thunder arrive outside while you are safely inside. Who keeps you calm?",
        "Rain pours outside while you are safe indoors. What helps you feel calm?",
        "⛈️",
        {"key": "hug", "emoji": "🤗", "label": "Hug Family Indoors"},
        [
            {"key": "run_out", "emoji": "🚪", "label": "Go Outside Alone"},
            {"key": "worry", "emoji": "😟", "label": "Stay Worried"},
            {"key": "hide_far", "emoji": "🌑", "label": "Hide Far Away"},
        ],
    ),
    (
        "Someone shares their favorite crayon with you. What polite words do we say?",
        "A friend hands you a bright blue crayon! What do we say?",
        "🙏",
        {"key": "thanks", "emoji": "😊", "label": "Thank You! Po!"},
        [
            {"key": "grab", "emoji": "🤏", "label": "Grab Silently"},
            {"key": "nope", "emoji": "🙅", "label": "No Way"},
            {"key": "toss", "emoji": "💨", "label": "Walk Away"},
        ],
    ),
    (
        "Your puzzle piece doesn't fit on the first try. What helps us keep learning?",
        "Trying a puzzle piece that does not fit yet—what helps us succeed?",
        "🧩",
        {"key": "try_again", "emoji": "🌟", "label": "Try Another Spot"},
        [
            {"key": "quit", "emoji": "🙅", "label": "Give Up Forever"},
            {"key": "crumple", "emoji": "💢", "label": "Get Upset"},
            {"key": "hide", "emoji": "🙈", "label": "Hide the Board"},
        ],
    ),
]

WEATHER_SCENARIOS = [
    (
        "Tag-ulan! Raindrops are falling outside. What keeps us dry?",
        "It is raining outside! Tap what helps keep us dry.",
        "🌧️",
        {"key": "umbrella", "emoji": "☂️", "label": "Payong (Umbrella)"},
        [
            {"key": "sunglasses", "emoji": "🕶️", "label": "Sunglasses"},
            {"key": "kite", "emoji": "🪁", "label": "Paper Kite"},
            {"key": "book", "emoji": "📖", "label": "Open Book"},
        ],
    ),
    (
        "Tag-init! The bright midday sun warms our playground. What shades our eyes?",
        "It is a bright sunny day! What shades our eyes?",
        "☀️",
        {"key": "sunglasses", "emoji": "🕶️", "label": "Sunglasses"},
        [
            {"key": "boots", "emoji": "🥾", "label": "Rain Boots"},
            {"key": "raincoat", "emoji": "🧥", "label": "Raincoat"},
            {"key": "flashlight", "emoji": "🔦", "label": "Flashlight"},
        ],
    ),
    (
        "On a very warm sunny afternoon, what keeps our body cool and hydrated?",
        "Phew, it is hot today! Tap a healthy drink that cools us down.",
        "🌞",
        {"key": "water", "emoji": "💧", "label": "Cool Clean Water"},
        [
            {"key": "jacket", "emoji": "🧥", "label": "Rain Jacket"},
            {"key": "umbrella", "emoji": "☂️", "label": "Closed Umbrella"},
            {"key": "boots", "emoji": "🥾", "label": "Rain Boots"},
        ],
    ),
    (
        "Whoosh goes the afternoon breeze at the park! What flies high in the wind?",
        "It is windy outside! Which toy loves flying in the breeze?",
        "💨",
        {"key": "kite", "emoji": "🪁", "label": "Saranggola (Kite)"},
        [
            {"key": "pillow", "emoji": "🛏️", "label": "Pillow"},
            {"key": "bucket", "emoji": "🪣", "label": "Water Bucket"},
            {"key": "spoon", "emoji": "🥄", "label": "Spoon"},
        ],
    ),
    (
        "Sunshine peeks through soft rain clouds! What colorful arc appears in the sky?",
        "Sun and rain appear together! What colorful arc shines in the sky?",
        "🌦️",
        {"key": "rainbow", "emoji": "🌈", "label": "Bahaghari (Rainbow)"},
        [
            {"key": "flashlight", "emoji": "🔦", "label": "Flashlight"},
            {"key": "shoe", "emoji": "👟", "label": "Sneaker"},
            {"key": "anchor", "emoji": "⚓", "label": "Boat Anchor"},
        ],
    ),
    (
        "Puddles cover the street after afternoon rain. What keeps feet dry?",
        "Splash! There are puddles outside. What goes on our feet?",
        "💦",
        {"key": "boots", "emoji": "🥾", "label": "Bota (Rain Boots)"},
        [
            {"key": "slippers", "emoji": "🩴", "label": "Flip-Flops"},
            {"key": "socks", "emoji": "🧦", "label": "Cloth Socks"},
            {"key": "hat", "emoji": "🎩", "label": "Party Hat"},
        ],
    ),
    (
        "What do Bahay Kubo garden plants drink when rain clouds water the soil?",
        "Rain falls gently on the garden! What do plants drink to grow?",
        "🌱",
        {"key": "water", "emoji": "💧", "label": "Tubig (Fresh Water)"},
        [
            {"key": "sand", "emoji": "🏜️", "label": "Dry Sand"},
            {"key": "rock", "emoji": "🪨", "label": "Heavy Rocks"},
            {"key": "toy", "emoji": "🧸", "label": "Plush Toy"},
        ],
    ),
    (
        "On a sunny beach day with family, which juicy fruit helps refresh us?",
        "It is warm and sunny by the sea! Pick a refreshing tropical fruit!",
        "🏖️",
        {"key": "watermelon", "emoji": "🍉", "label": "Pakwan (Watermelon)"},
        [
            {"key": "raincoat", "emoji": "🧥", "label": "Raincoat"},
            {"key": "boots", "emoji": "🥾", "label": "Rain Boots"},
            {"key": "umbrella_wet", "emoji": "🥾", "label": "Muddy Boot"},
        ],
    ),
    (
        "When rain showers fall on the walk to school, what coat keeps clothes dry?",
        "Rain falls gently on your walk! Tap what keeps your uniform dry.",
        "☔",
        {"key": "raincoat", "emoji": "🧥", "label": "Kapote (Raincoat)"},
        [
            {"key": "sunglasses", "emoji": "🕶️", "label": "Sunglasses"},
            {"key": "sandals", "emoji": "🩴", "label": "Beach Sandals"},
            {"key": "kite", "emoji": "🪁", "label": "Kite"},
        ],
    ),
    (
        "Which coastal animal loves scuttling safely across sunny sandy beaches?",
        "Look near the waves on a sunny shore! Who walks sideways on sand?",
        "🌊",
        {"key": "crab", "emoji": "🦀", "label": "Alimango (Crab)"},
        [
            {"key": "owl", "emoji": "🦉", "label": "Night Owl"},
            {"key": "cow", "emoji": "🐮", "label": "Farm Cow"},
            {"key": "butterfly", "emoji": "🦋", "label": "Garden Butterfly"},
        ],
    ),
    (
        "At nighttime when the sky grows dark, what twinkles brightly above?",
        "Look up at the peaceful night sky! What twinkles beside the moon?",
        "🌌",
        {"key": "stars", "emoji": "⭐", "label": "Bituin (Stars)"},
        [
            {"key": "rainbow", "emoji": "🌈", "label": "Noon Sunbeam"},
            {"key": "flower", "emoji": "🌻", "label": "Sunflower"},
            {"key": "boat", "emoji": "⛵", "label": "Sailboat"},
        ],
    ),
    (
        "During a strong rainy evening indoors, what light helps if power blinks out?",
        "We stay cozy inside with family during rain! What tool gives bright safe light?",
        "⛈️",
        {"key": "flashlight", "emoji": "🔦", "label": "Flashlight"},
        [
            {"key": "kite", "emoji": "🪁", "label": "Paper Kite"},
            {"key": "sunglasses", "emoji": "🕶️", "label": "Sunglasses"},
            {"key": "sailboat", "emoji": "⛵", "label": "Toy Sailboat"},
        ],
    ),
    (
        "Before walking outside under bright sunshine, what shades your head and face?",
        "Don't forget sun protection! Tap what protects your head in bright sun.",
        "👒",
        {"key": "cap", "emoji": "👒", "label": "Sombrero (Sun Hat)"},
        [
            {"key": "boots", "emoji": "🥾", "label": "Rain Boots"},
            {"key": "flashlight", "emoji": "🔦", "label": "Flashlight"},
            {"key": "pillow", "emoji": "🛏️", "label": "Pillow"},
        ],
    ),
    (
        "On a humid afternoon at home, what gentle breeze-maker helps cool our face?",
        "Warm afternoon breeze! What traditional hand fan cools us safely?",
        "🪭",
        {"key": "fan", "emoji": "🪭", "label": "Pamaypay (Hand Fan)"},
        [
            {"key": "boots", "emoji": "🥾", "label": "Rain Boots"},
            {"key": "raincoat", "emoji": "🧥", "label": "Heavy Raincoat"},
            {"key": "drum", "emoji": "🥁", "label": "Drum"},
        ],
    ),
]

SHAPE_SORT_POOL = {
    "circle": [
        {"id": "sh-c1", "label": "Coral Wheel", "shape": "circle", "color": "#FF9C8C", "bin": "circle"},
        {"id": "sh-c2", "label": "Mint Clock", "shape": "circle", "color": "#9BE7C4", "bin": "circle"},
        {"id": "sh-c3", "label": "Sunny Ball", "shape": "circle", "color": "#FFE58A", "bin": "circle"},
        {"id": "sh-c4", "label": "Sky Button", "shape": "circle", "color": "#78C8F5", "bin": "circle"},
        {"id": "sh-c5", "label": "Lavender Coin", "shape": "circle", "color": "#B8A5F5", "bin": "circle"},
        {"id": "sh-c6", "label": "Round Plate", "shape": "circle", "color": "#FF9C8C", "bin": "circle"},
    ],
    "square": [
        {"id": "sh-s1", "label": "Sky Window", "shape": "square", "color": "#78C8F5", "bin": "square"},
        {"id": "sh-s2", "label": "Lavender Block", "shape": "square", "color": "#B8A5F5", "bin": "square"},
        {"id": "sh-s3", "label": "Sunny Waffle", "shape": "square", "color": "#FFE58A", "bin": "square"},
        {"id": "sh-s4", "label": "Mint Cushion", "shape": "square", "color": "#9BE7C4", "bin": "square"},
        {"id": "sh-s5", "label": "Coral Tile", "shape": "square", "color": "#FF9C8C", "bin": "square"},
        {"id": "sh-s6", "label": "Gift Box", "shape": "square", "color": "#78C8F5", "bin": "square"},
    ],
    "triangle": [
        {"id": "sh-t1", "label": "Sunny Sail", "shape": "triangle", "color": "#FFE58A", "bin": "triangle"},
        {"id": "sh-t2", "label": "Party Hat", "shape": "triangle", "color": "#FF9C8C", "bin": "triangle"},
        {"id": "sh-t3", "label": "Mint Pine", "shape": "triangle", "color": "#9BE7C4", "bin": "triangle"},
        {"id": "sh-t4", "label": "Sky Pennant", "shape": "triangle", "color": "#78C8F5", "bin": "triangle"},
        {"id": "sh-t5", "label": "Lavender Tent", "shape": "triangle", "color": "#B8A5F5", "bin": "triangle"},
        {"id": "sh-t6", "label": "Melon Slice", "shape": "triangle", "color": "#FF9C8C", "bin": "triangle"},
    ],
}

OBJECT_SORT_POOL = {
    "toys": [
        {"id": "ob-t1", "label": "Teddy Bear", "emoji": "🧸", "bin": "toys"},
        {"id": "ob-t2", "label": "Toy Car", "emoji": "🚗", "bin": "toys"},
        {"id": "ob-t3", "label": "Wooden Blocks", "emoji": "🧱", "bin": "toys"},
        {"id": "ob-t4", "label": "Yo-Yo", "emoji": "🪀", "bin": "toys"},
        {"id": "ob-t5", "label": "Toy Train", "emoji": "🚂", "bin": "toys"},
        {"id": "ob-t6", "label": "Rubber Duck", "emoji": "🦆", "bin": "toys"},
    ],
    "books": [
        {"id": "ob-b1", "label": "Picture Book", "emoji": "📖", "bin": "books"},
        {"id": "ob-b2", "label": "Notebook", "emoji": "📓", "bin": "books"},
        {"id": "ob-b3", "label": "Story Stack", "emoji": "📚", "bin": "books"},
        {"id": "ob-b4", "label": "Sketch Pad", "emoji": "🗒️", "bin": "books"},
        {"id": "ob-b5", "label": "Blue Book", "emoji": "📘", "bin": "books"},
        {"id": "ob-b6", "label": "Green Book", "emoji": "📗", "bin": "books"},
    ],
    "snacks": [
        {"id": "ob-s1", "label": "Sweet Apple", "emoji": "🍎", "bin": "snacks"},
        {"id": "ob-s2", "label": "Yellow Banana", "emoji": "🍌", "bin": "snacks"},
        {"id": "ob-s3", "label": "Strawberry", "emoji": "🍓", "bin": "snacks"},
        {"id": "ob-s4", "label": "Fresh Carrot", "emoji": "🥕", "bin": "snacks"},
        {"id": "ob-s5", "label": "Juicy Orange", "emoji": "🍊", "bin": "snacks"},
        {"id": "ob-s6", "label": "Grapes", "emoji": "🍇", "bin": "snacks"},
    ],
}

HEALTHY_SORT_POOL = {
    "fruits": [
        {"id": "hf-f1", "label": "Sweet Mango (Mangga)", "emoji": "🥭", "bin": "fruits"},
        {"id": "hf-f2", "label": "Watermelon (Pakwan)", "emoji": "🍉", "bin": "fruits"},
        {"id": "hf-f3", "label": "Red Apple", "emoji": "🍎", "bin": "fruits"},
        {"id": "hf-f4", "label": "Banana (Saging)", "emoji": "🍌", "bin": "fruits"},
        {"id": "hf-f5", "label": "Sweet Grapes", "emoji": "🍇", "bin": "fruits"},
        {"id": "hf-f6", "label": "Fresh Pineapple", "emoji": "🍍", "bin": "fruits"},
    ],
    "veggies": [
        {"id": "hf-v1", "label": "Orange Carrot", "emoji": "🥕", "bin": "veggies"},
        {"id": "hf-v2", "label": "Eggplant (Talong)", "emoji": "🍆", "bin": "veggies"},
        {"id": "hf-v3", "label": "Sweet Corn (Mais)", "emoji": "🌽", "bin": "veggies"},
        {"id": "hf-v4", "label": "Cucumber (Pipino)", "emoji": "🥒", "bin": "veggies"},
        {"id": "hf-v5", "label": "Tomato (Kamatis)", "emoji": "🍅", "bin": "veggies"},
        {"id": "hf-v6", "label": "Leafy Greens (Pechay)", "emoji": "🥬", "bin": "veggies"},
    ],
    "drinks": [
        {"id": "hf-d1", "label": "Fresh Water (Tubig)", "emoji": "💧", "bin": "drinks"},
        {"id": "hf-d2", "label": "Warm Milk", "emoji": "🥛", "bin": "drinks"},
        {"id": "hf-d3", "label": "Buko Coconut Water", "emoji": "🥥", "bin": "drinks"},
        {"id": "hf-d4", "label": "Calamansi Juice", "emoji": "🍋", "bin": "drinks"},
        {"id": "hf-d5", "label": "Apple Juice", "emoji": "🧃", "bin": "drinks"},
        {"id": "hf-d6", "label": "Warm Tea Cup", "emoji": "🍵", "bin": "drinks"},
    ],
}

TRACE_PREWRITING_POOL = [
    {
        "key": "line-straight",
        "label": "Straight Bridge Line",
        "label_fil": "Tuwid na Linya",
        "speak": "Trace from the star all the way across the bridge!",
        "speak_fil": "I-trace mula sa bituin hanggang sa kabilang dulo!",
        "emoji": "🌉",
        "points": [[15, 50], [38, 50], [62, 50], [85, 50]],
    },
    {
        "key": "line-wave",
        "label": "Ocean Wave (Alon)",
        "label_fil": "Alon sa Dagat",
        "speak": "Follow the gentle ocean wave up and down!",
        "speak_fil": "Sundan ang alon sa dagat pataas at pababa!",
        "emoji": "🌊",
        "points": [[14, 58], [30, 34], [50, 66], [70, 34], [86, 58]],
    },
    {
        "key": "line-zigzag",
        "label": "Mountain Zigzag (Bundok)",
        "label_fil": "Bundok Zigzag",
        "speak": "Climb up and down the mountain peaks with your finger!",
        "speak_fil": "Umakyat at bumaba sa tuktok ng bundok gamit ang daliri!",
        "emoji": "⛰️",
        "points": [[15, 72], [35, 30], [52, 72], [70, 30], [86, 72]],
    },
    {
        "key": "shape-circle",
        "label": "Sunny Circle (Bilog)",
        "label_fil": "Bilog na Araw",
        "speak": "Trace all the way around the round sunny circle!",
        "speak_fil": "I-trace paikot ang bilog na araw!",
        "emoji": "☀️",
        "points": [[50, 20], [74, 30], [82, 52], [72, 74], [50, 82], [28, 74], [18, 52], [28, 30], [50, 20]],
    },
    {
        "key": "shape-triangle",
        "label": "Nipa Roof Triangle (Tatsulok)",
        "label_fil": "Tatsulok na Bubong",
        "speak": "Trace down, across, and back up to make a roof triangle!",
        "speak_fil": "I-trace ang tatsulok na bubong ng Bahay Kubo!",
        "emoji": "🏡",
        "points": [[50, 20], [80, 76], [20, 76], [50, 20]],
    },
    {
        "key": "line-rainbow",
        "label": "Rainbow Arch (Bahaghari)",
        "label_fil": "Arko ng Bahaghari",
        "speak": "Draw a tall smiling rainbow arch across the sky!",
        "speak_fil": "Gumuhit ng arko ng bahaghari sa langit!",
        "emoji": "🌈",
        "points": [[16, 72], [28, 38], [50, 24], [72, 38], [84, 72]],
    },
]

TRACE_LETTERS_POOL = [
    {
        "key": "letter-a",
        "label": "Big Letter A",
        "label_fil": "Malaking Titik A (Araw)",
        "speak": "Trace letter A for Araw! Left side, right side, and bridge!",
        "speak_fil": "I-trace ang titik A para sa Araw!",
        "emoji": "☀️",
        "points": [[50, 18], [26, 80], [50, 18], [74, 80], [34, 56], [66, 56]],
    },
    {
        "key": "letter-b",
        "label": "Letter B (Bola)",
        "label_fil": "Titik B (Bola)",
        "speak": "Trace straight down and add two bouncy bumps for letter B!",
        "speak_fil": "I-trace pababa at dalawang kurba para sa titik B!",
        "emoji": "⚽",
        "points": [[30, 20], [30, 80], [58, 22], [68, 34], [52, 49], [70, 64], [58, 80], [30, 80]],
    },
    {
        "key": "letter-k",
        "label": "Letter K (Kalabaw)",
        "label_fil": "Titik K (Kalabaw)",
        "speak": "Trace letter K for Kalabaw and Kubo!",
        "speak_fil": "I-trace ang titik K para sa Kalabaw at Kubo!",
        "emoji": "🏡",
        "points": [[30, 20], [30, 80], [72, 22], [32, 50], [74, 80]],
    },
    {
        "key": "letter-m",
        "label": "Letter M (Mangga)",
        "label_fil": "Titik M (Mangga)",
        "speak": "Trace up, down, up, and down for M like Mangga!",
        "speak_fil": "I-trace ang titik M para sa matamis na Mangga!",
        "emoji": "🥭",
        "points": [[20, 80], [20, 22], [50, 60], [80, 22], [80, 80]],
    },
    {
        "key": "num-1",
        "label": "Number 1 (Isa)",
        "label_fil": "Bilang 1 (Isa)",
        "speak": "Trace straight down to draw number 1!",
        "speak_fil": "I-trace pababa para sa bilang Isa!",
        "emoji": "1️⃣",
        "points": [[40, 30], [52, 20], [52, 80]],
    },
    {
        "key": "num-3",
        "label": "Number 3 (Tatlo)",
        "label_fil": "Bilang 3 (Tatlo)",
        "speak": "Trace two friendly hops around to make number 3!",
        "speak_fil": "Dalawang kurba para sa bilang Tatlo!",
        "emoji": "3️⃣",
        "points": [[30, 28], [58, 22], [68, 36], [48, 49], [70, 64], [56, 80], [28, 74]],
    },
]

MEMORY_NATURE_POOL = [
    {"key": "apple", "emoji": "🍎", "label": "Red Apple"},
    {"key": "banana", "emoji": "🍌", "label": "Yellow Banana"},
    {"key": "blueberry", "emoji": "🫐", "label": "Blue Berry"},
    {"key": "pear", "emoji": "🍏", "label": "Green Pear"},
    {"key": "sunflower", "emoji": "🌻", "label": "Sunflower"},
    {"key": "butterfly", "emoji": "🦋", "label": "Butterfly"},
    {"key": "rainbow", "emoji": "🌈", "label": "Rainbow"},
    {"key": "strawberry", "emoji": "🍓", "label": "Strawberry"},
    {"key": "ladybug", "emoji": "🐞", "label": "Ladybug"},
    {"key": "star", "emoji": "⭐", "label": "Golden Star"},
    {"key": "mushroom", "emoji": "🍄", "label": "Forest Mushroom"},
    {"key": "bee", "emoji": "🐝", "label": "Honeybee"},
]

MEMORY_OCEAN_POOL = [
    {"key": "whale", "emoji": "🐳", "label": "Gentle Whale"},
    {"key": "dolphin", "emoji": "🐬", "label": "Happy Dolphin"},
    {"key": "octopus", "emoji": "🐙", "label": "Wiggly Octopus"},
    {"key": "turtle", "emoji": "🐢", "label": "Sea Turtle"},
    {"key": "crab", "emoji": "🦀", "label": "Sunny Crab"},
    {"key": "jellyfish", "emoji": "🪼", "label": "Glowing Jelly"},
    {"key": "fish", "emoji": "🐠", "label": "Coral Fish"},
    {"key": "seal", "emoji": "🦭", "label": "Playful Seal"},
    {"key": "shell", "emoji": "🐚", "label": "Pink Shell"},
    {"key": "shrimp", "emoji": "🦐", "label": "Little Shrimp"},
]

PUZZLE_NATURE_POOL = [
    {"emoji": "🦁", "label": "Friendly Lion", "bg": "#FFE58A"},
    {"emoji": "🦋", "label": "Garden Butterfly", "bg": "#DCF2FD"},
    {"emoji": "🌈", "label": "Bright Rainbow", "bg": "#FFE3DE"},
    {"emoji": "🌻", "label": "Happy Sunflower", "bg": "#FFF5CF"},
    {"emoji": "🐼", "label": "Cuddly Panda", "bg": "#DDF8EC"},
    {"emoji": "🐢", "label": "Gentle Turtle", "bg": "#DCF2FD"},
    {"emoji": "🦉", "label": "Pip the Owl", "bg": "#EDE7FE"},
    {"emoji": "🐘", "label": "Baby Elephant", "bg": "#DCF2FD"},
    {"emoji": "🍓", "label": "Sweet Strawberry", "bg": "#FFE3DE"},
    {"emoji": "🐳", "label": "Ocean Whale", "bg": "#DCF2FD"},
]

PUZZLE_SPACE_POOL = [
    {"emoji": "🚀", "label": "Zooming Rocket", "bg": "#DCF2FD"},
    {"emoji": "🪐", "label": "Ringed Planet", "bg": "#EBE5FC"},
    {"emoji": "🌙", "label": "Golden Moon", "bg": "#FFF5CF"},
    {"emoji": "⭐", "label": "Twinkling Star", "bg": "#FFE58A"},
    {"emoji": "🛸", "label": "Friendly Saucer", "bg": "#DDF8EC"},
    {"emoji": "🌍", "label": "Our Planet Earth", "bg": "#DCF2FD"},
    {"emoji": "☄️", "label": "Bright Comet", "bg": "#FFE3DE"},
    {"emoji": "☀️", "label": "Warm Sun", "bg": "#FFF5CF"},
    {"emoji": "🌌", "label": "Starry Galaxy", "bg": "#EBE5FC"},
]


def current_week_key() -> tuple[str, int]:
    """Return current ISO week identifier (e.g., ('2026-W47', 47)) in app timezone."""
    iso = local_today().isocalendar()
    return f"{iso.year}-W{iso.week:02d}", iso.week


def parse_week_key(week: Optional[str]) -> tuple[str, int]:
    """Validate optional YYYY-Www query value or fall back to the active week."""
    if week:
        m = _WEEK_KEY_RE.match(week.strip())
        if m:
            year = int(m.group(1))
            wk = int(m.group(2))
            return f"{year}-W{wk:02d}", wk
    return current_week_key()


def _week_rng(slug: str, week_key: str) -> random.Random:
    digest = hashlib.sha256(f"littlesteps:{slug}:{week_key}".encode("utf-8")).hexdigest()
    return random.Random(int(digest[:16], 16))


def _pick_distractors(
    rng: random.Random,
    pool: list[Any],
    exclude_key: Any,
    key_fn,
    count: int = 3,
) -> list[Any]:
    candidates = [item for item in pool if key_fn(item) != exclude_key]
    rng.shuffle(candidates)
    chosen: list[Any] = []
    seen_keys = {exclude_key}
    for item in candidates:
        k = key_fn(item)
        if k not in seen_keys:
            seen_keys.add(k)
            chosen.append(item)
        if len(chosen) >= count:
            break
    return chosen


def _gen_letter_matching(rng: random.Random) -> list[dict[str, Any]]:
    selected = rng.sample(ALPHABET_BANK, 12)
    rounds: list[dict[str, Any]] = []
    for idx, (upper, emoji, word) in enumerate(selected):
        if idx % 2 == 0:
            distractors = _pick_distractors(rng, ALPHABET_BANK, upper, lambda x: x[0], 3)
            choices = [{"key": upper, "text": upper}] + [
                {"key": d[0], "text": d[0]} for d in distractors
            ]
            rng.shuffle(choices)
            rounds.append(
                {
                    "prompt": f"Find the letter {upper} for {word}!",
                    "speak": f"Can you tap the letter {upper} for {word}?",
                    "visual": {"kind": "emoji", "value": emoji},
                    "choices": choices,
                    "answer": upper,
                }
            )
        else:
            lower = upper.lower()
            distractors = _pick_distractors(rng, ALPHABET_BANK, upper, lambda x: x[0], 3)
            choices = [{"key": lower, "text": lower}] + [
                {"key": d[0].lower(), "text": d[0].lower()} for d in distractors
            ]
            rng.shuffle(choices)
            rounds.append(
                {
                    "prompt": f"Match uppercase {upper} to lowercase {lower}!",
                    "speak": f"Which lowercase letter matches big {upper}?",
                    "visual": {"kind": "emoji", "value": emoji},
                    "choices": choices,
                    "answer": lower,
                }
            )
    return rounds


def _gen_number_counting(rng: random.Random) -> list[dict[str, Any]]:
    counts = list(range(1, 13))
    rng.shuffle(counts)
    objects = rng.sample(COUNTING_OBJECTS, 12)
    all_nums = list(range(1, 13))

    rounds: list[dict[str, Any]] = []
    for count_val, (emoji, noun) in zip(counts, objects):
        nearby = [n for n in all_nums if n != count_val and abs(n - count_val) <= 3]
        if len(nearby) < 3:
            nearby = [n for n in all_nums if n != count_val]
        distractors = rng.sample(nearby, 3)
        option_nums = sorted([count_val] + distractors)
        choices = [{"key": str(n), "text": str(n)} for n in option_nums]
        rounds.append(
            {
                "prompt": f"How many {noun} do you see?",
                "speak": f"Count the {noun} carefully, then tap the matching number!",
                "visual": {"kind": "count", "emoji": emoji, "count": count_val},
                "choices": choices,
                "answer": str(count_val),
            }
        )
    return rounds


def _gen_fruit_addition(rng: random.Random) -> list[dict[str, Any]]:
    chosen = rng.sample(ADDITION_PROBLEMS, 12)
    all_totals = list(range(1, 11))
    rounds: list[dict[str, Any]] = []
    for a, b, emoji, noun in chosen:
        total = a + b
        nearby = [n for n in all_totals if n != total and abs(n - total) <= 3]
        distractors = rng.sample(nearby, 3)
        option_nums = sorted([total] + distractors)
        choices = [{"key": str(n), "text": str(n)} for n in option_nums]
        items = ([emoji] * a) + ["➕"] + ([emoji] * b)
        rounds.append(
            {
                "prompt": f"{a} {noun} plus {b} {noun} makes how many?",
                "speak": f"Count together! {a} {noun} plus {b} more makes how many?",
                "visual": {"kind": "sequence", "items": items},
                "choices": choices,
                "answer": str(total),
            }
        )
    return rounds


def _gen_color_recognition(rng: random.Random) -> list[dict[str, Any]]:
    combos = [(c, n) for c in COLOR_PALETTE for n in COLOR_NOUNS]
    picked = rng.sample(combos, 12)
    rounds: list[dict[str, Any]] = []
    for (key, hex_val, label), noun in picked:
        distractors = _pick_distractors(rng, COLOR_PALETTE, key, lambda c: c[0], 3)
        choices = [{"key": key, "hex": hex_val, "label": label}] + [
            {"key": d[0], "hex": d[1], "label": d[2]} for d in distractors
        ]
        rng.shuffle(choices)
        rounds.append(
            {
                "prompt": f"Tap the {label} {noun}!",
                "speak": f"Can you find the bright {label} {noun}?",
                "visual": None,
                "choices": choices,
                "answer": key,
            }
        )
    return rounds


def _gen_pattern_completion(rng: random.Random) -> list[dict[str, Any]]:
    rounds: list[dict[str, Any]] = []
    for idx in range(12):
        pair = rng.sample(PATTERN_TOKENS, 2)
        t_a, t_b = pair[0], pair[1]
        kind = idx % 3
        if kind == 0:
            # ABAB -> A
            seq = [t_a[1], t_b[1], t_a[1], t_b[1]]
            ans = t_a
        elif kind == 1:
            # AABAAB -> missing B
            seq = [t_a[1], t_a[1], t_b[1], t_a[1], t_a[1]]
            ans = t_b
        else:
            # ABBA or AABB -> next
            seq = [t_a[1], t_b[1], t_b[1], t_a[1], t_b[1]]
            ans = t_b

        distractors = _pick_distractors(rng, PATTERN_TOKENS, ans[0], lambda x: x[0], 3)
        choices = [{"key": ans[0], "emoji": ans[1], "label": ans[2]}] + [
            {"key": d[0], "emoji": d[1], "label": d[2]} for d in distractors
        ]
        rng.shuffle(choices)
        rounds.append(
            {
                "prompt": "What comes next in this friendly pattern?",
                "speak": "Look closely at the picture pattern! Which picture comes next?",
                "visual": {"kind": "sequence", "items": seq},
                "choices": choices,
                "answer": ans[0],
            }
        )
    return rounds


def _gen_animal_sounds(rng: random.Random) -> list[dict[str, Any]]:
    picked = rng.sample(ANIMAL_SOUND_BANK, 12)
    rounds: list[dict[str, Any]] = []
    for key, emoji, label, sound in picked:
        distractors = _pick_distractors(rng, ANIMAL_SOUND_BANK, key, lambda a: a[0], 3)
        choices = [{"key": key, "emoji": emoji, "label": label}] + [
            {"key": d[0], "emoji": d[1], "label": d[2]} for d in distractors
        ]
        rng.shuffle(choices)
        rounds.append(
            {
                "prompt": "Listen! Which animal friend makes this sound?",
                "speak": "Listen to this animal sound! Which animal friend makes that sound?",
                "visual": {
                    "kind": "sound",
                    "text": sound,
                    "animal": key,
                    "label": label,
                },
                "choices": choices,
                "answer": key,
            }
        )
    return rounds


def _gen_picture_vocabulary(rng: random.Random) -> list[dict[str, Any]]:
    picked = rng.sample(VOCAB_BANK, 12)
    rounds: list[dict[str, Any]] = []
    for key, emoji, label, clue in picked:
        distractors = _pick_distractors(rng, VOCAB_BANK, key, lambda v: v[0], 3)
        choices = [{"key": key, "emoji": emoji, "label": label}] + [
            {"key": d[0], "emoji": d[1], "label": d[2]} for d in distractors
        ]
        rng.shuffle(choices)
        rounds.append(
            {
                "prompt": f"Tap the {label}!",
                "speak": f"Can you find the {label} that {clue}?",
                "visual": None,
                "choices": choices,
                "answer": key,
            }
        )
    return rounds


def _gen_curated_scenarios(rng: random.Random, bank: list[tuple]) -> list[dict[str, Any]]:
    picked = rng.sample(bank, 12)
    rounds: list[dict[str, Any]] = []
    for prompt, speak_txt, visual_emoji, ans_choice, distractors in picked:
        choices = [dict(ans_choice)] + [dict(d) for d in distractors[:3]]
        rng.shuffle(choices)
        rounds.append(
            {
                "prompt": prompt,
                "speak": speak_txt,
                "visual": {"kind": "emoji", "value": visual_emoji},
                "choices": choices,
                "answer": ans_choice["key"],
            }
        )
    return rounds


def _gen_balanced_sort_items(
    rng: random.Random, pool: dict[str, list[dict[str, Any]]]
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for bin_items in pool.values():
        selected.extend(copy.deepcopy(rng.sample(bin_items, 4)))
    rng.shuffle(selected)
    return selected


@lru_cache(maxsize=256)
def _build_known_weekly_game_json(slug: str, week_key: str, iso_week: int) -> Optional[str]:
    """Generate and memoize compact JSON for built-in weekly game configurations."""
    weekly_label = f"Week {iso_week} Fresh Mix"
    rng = _week_rng(slug, week_key)
    meta = {"weekly_key": week_key, "weekly_label": weekly_label}

    cfg: Optional[dict[str, Any]] = None
    if slug == "letter-matching":
        cfg = {
            "engine": "choice",
            "skill": "Phonics & Initial Sounds",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_letter_matching(rng),
            **meta,
        }
    elif slug == "number-counting":
        cfg = {
            "engine": "choice",
            "skill": "Counting 1-12",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_number_counting(rng),
            **meta,
        }
    elif slug == "fruit-addition":
        cfg = {
            "engine": "choice",
            "skill": "Visual Addition",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_fruit_addition(rng),
            **meta,
        }
    elif slug == "color-recognition":
        cfg = {
            "engine": "choice",
            "skill": "Color Recognition",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_color_recognition(rng),
            **meta,
        }
    elif slug == "pattern-completion":
        cfg = {
            "engine": "choice",
            "skill": "Number Sense & Patterns",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_pattern_completion(rng),
            **meta,
        }
    elif slug == "animal-sounds":
        cfg = {
            "engine": "choice",
            "skill": "Animal Listening",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_animal_sounds(rng),
            **meta,
        }
    elif slug == "picture-vocabulary":
        cfg = {
            "engine": "choice",
            "skill": "Everyday Vocabulary",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_picture_vocabulary(rng),
            **meta,
        }
    elif slug == "feelings-detective":
        cfg = {
            "engine": "choice",
            "skill": "Emotional Awareness",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_curated_scenarios(rng, FEELINGS_SCENARIOS),
            **meta,
        }
    elif slug == "weather-dress-up":
        cfg = {
            "engine": "choice",
            "skill": "Weather & Seasons",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_curated_scenarios(rng, WEATHER_SCENARIOS),
            **meta,
        }
    elif slug == "shape-sorting":
        cfg = {
            "engine": "sort",
            "skill": "Shape Recognition",
            "feedback": FEEDBACK_PHRASES,
            "bins": [
                {"key": "circle", "label": "Circle", "shape": "circle"},
                {"key": "square", "label": "Square", "shape": "square"},
                {"key": "triangle", "label": "Triangle", "shape": "triangle"},
            ],
            "items": _gen_balanced_sort_items(rng, SHAPE_SORT_POOL),
            **meta,
        }
    elif slug == "object-sorting":
        cfg = {
            "engine": "sort",
            "skill": "Daily Routines & Tidying",
            "feedback": FEEDBACK_PHRASES,
            "bins": [
                {"key": "toys", "label": "Toy Box", "emoji": "🧺"},
                {"key": "books", "label": "Bookshelf", "emoji": "📚"},
                {"key": "snacks", "label": "Snack Plate", "emoji": "🍽️"},
            ],
            "items": _gen_balanced_sort_items(rng, OBJECT_SORT_POOL),
            **meta,
        }
    elif slug == "healthy-snack-sorter":
        cfg = {
            "engine": "sort",
            "skill": "Healthy Food Choices",
            "feedback": FEEDBACK_PHRASES,
            "bins": [
                {"key": "fruits", "label": "Sweet Fruits", "emoji": "🍓"},
                {"key": "veggies", "label": "Crunchy Veggies", "emoji": "🥕"},
                {"key": "drinks", "label": "Healthy Drinks", "emoji": "🥛"},
            ],
            "items": _gen_balanced_sort_items(rng, HEALTHY_SORT_POOL),
            **meta,
        }
    elif slug == "memory-matching":
        cfg = {
            "engine": "memory",
            "skill": "Visual Memory & Colors",
            "feedback": FEEDBACK_PHRASES,
            "pairs": rng.sample(MEMORY_NATURE_POOL, 6),
            **meta,
        }
    elif slug == "ocean-friends-memory":
        cfg = {
            "engine": "memory",
            "skill": "Ocean Life Memory",
            "feedback": FEEDBACK_PHRASES,
            "pairs": rng.sample(MEMORY_OCEAN_POOL, 6),
            **meta,
        }
    elif slug == "puzzle-assembly":
        cfg = {
            "engine": "puzzle",
            "skill": "Spatial Puzzle Assembly",
            "feedback": FEEDBACK_PHRASES,
            "grid": 2,
            "pictures": rng.sample(PUZZLE_NATURE_POOL, 3),
            **meta,
        }
    elif slug == "space-explorer-puzzle":
        cfg = {
            "engine": "puzzle",
            "skill": "Space Spatial Puzzles",
            "feedback": FEEDBACK_PHRASES,
            "grid": 2,
            "pictures": rng.sample(PUZZLE_SPACE_POOL, 3),
            **meta,
        }
    elif slug == "prewriting-strokes":
        cfg = {
            "engine": "trace",
            "skill": "Pre-Writing & Fine Motor",
            "feedback": FEEDBACK_PHRASES,
            "prompts": rng.sample(TRACE_PREWRITING_POOL, 4),
            **meta,
        }
    elif slug == "letter-number-tracing":
        cfg = {
            "engine": "trace",
            "skill": "Letter & Number Tracing",
            "feedback": FEEDBACK_PHRASES,
            "prompts": rng.sample(TRACE_LETTERS_POOL, 4),
            **meta,
        }

    if cfg is None:
        return None
    return json.dumps(cfg, separators=(",", ":"))


def build_weekly_game_config(
    slug: str,
    base_config: dict[str, Any],
    week: Optional[str] = None,
) -> dict[str, Any]:
    """Return a deterministic weekly-rotating 12-question/item config for a game slug."""
    week_key, iso_week = parse_week_key(week)
    cached_json = _build_known_weekly_game_json(slug, week_key, iso_week)
    if cached_json is not None:
        return json.loads(cached_json)

    cfg = copy.deepcopy(base_config or {})
    cfg.setdefault("weekly_key", week_key)
    cfg.setdefault("weekly_label", f"Week {iso_week} Fresh Mix")
    return cfg
