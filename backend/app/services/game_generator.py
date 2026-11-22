import copy
import hashlib
import random
import re
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
    ("⭐", "shining stars"),
    ("🦆", "yellow ducks"),
    ("🍓", "sweet strawberries"),
    ("🎈", "bright balloons"),
    ("🍌", "yellow bananas"),
    ("🍊", "juicy oranges"),
    ("🌸", "spring flowers"),
    ("🦋", "fluttering butterflies"),
    ("🐠", "friendly fish"),
    ("🍪", "yummy cookies"),
    ("🐥", "little chicks"),
    ("🍒", "sweet cherries"),
    ("🍄", "forest mushrooms"),
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
    ("horse", "🐴", "Horse", "Neigh!"),
    ("goat", "🐐", "Goat", "Maa maa!"),
    ("elephant", "🐘", "Elephant", "Pawoo!"),
    ("rooster", "🐓", "Rooster", "Cock-a-doodle-doo!"),
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
    ("rocket", "🚀", "Rocket", "zooms high up toward the stars"),
    ("guitar", "🎸", "Guitar", "plays cheerful musical notes"),
    ("hat", "👒", "Sun Hat", "shades our face on sunny walks"),
    ("apple", "🍎", "Red Apple", "is a crunchy healthy fruit"),
    ("train", "🚂", "Train", "rides choo-choo along the tracks"),
    ("flower", "🌸", "Flower", "blooms brightly in the garden"),
    ("cup", "🥛", "Milk Cup", "holds warm milk or cool water"),
    ("kite", "🪁", "Kite", "flies high when the wind blows"),
    ("teddy", "🧸", "Teddy Bear", "is soft and cozy to hug"),
    ("crayon", "🖍️", "Crayon", "draws colorful lines on paper"),
    ("sailboat", "⛵", "Sailboat", "floats smoothly across the water"),
    ("shoe", "👟", "Sneaker", "keeps our feet comfy when running"),
    ("drum", "🥁", "Drum", "goes boom-tap when we keep rhythm"),
    ("cloud", "☁️", "Fluffy Cloud", "drifts lazily across the blue sky"),
]

FEELINGS_SCENARIOS = [
    (
        "Mia earned a shiny gold sticker! How does she feel?",
        "Mia got a shiny star sticker! Which face shows how she feels?",
        "⭐",
        {"key": "happy", "emoji": "😊", "label": "Happy"},
        [
            {"key": "sleepy", "emoji": "😴", "label": "Sleepy"},
            {"key": "sad", "emoji": "😢", "label": "Sad"},
            {"key": "worried", "emoji": "😟", "label": "Worried"},
        ],
    ),
    (
        "Leo's ice cream scoop fell onto the grass. How might he feel?",
        "Oh no, Leo's ice cream dropped! How might he feel?",
        "🍦",
        {"key": "sad", "emoji": "😢", "label": "Sad"},
        [
            {"key": "excited", "emoji": "🤩", "label": "Excited"},
            {"key": "silly", "emoji": "😜", "label": "Silly"},
            {"key": "proud", "emoji": "😁", "label": "Proud"},
        ],
    ),
    (
        "Sofia takes slow breaths like smelling a flower. How does she feel?",
        "Sofia breathes slowly in and out. How does she feel now?",
        "🌸",
        {"key": "calm", "emoji": "😌", "label": "Calm"},
        [
            {"key": "surprised", "emoji": "😮", "label": "Surprised"},
            {"key": "sleepy", "emoji": "😴", "label": "Sleepy"},
            {"key": "angry", "emoji": "😠", "label": "Grumpy"},
        ],
    ),
    (
        "A jack-in-the-box pops open with confetti! Which face looks surprised?",
        "Pop! Confetti jumps out! Which face looks surprised?",
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
        "You finished cleaning up all the art crayons! How might you feel?",
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
        "It is bedtime after reading a cozy story. Which face looks sleepy?",
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
        "Tomorrow is the kindergarten picnic! How do the children feel?",
        "Hooray! Tomorrow is the park picnic! Which face shows excited?",
        "🧺",
        {"key": "excited", "emoji": "🤩", "label": "Excited"},
        [
            {"key": "bored", "emoji": "🥱", "label": "Bored"},
            {"key": "sad", "emoji": "😢", "label": "Sad"},
            {"key": "calm", "emoji": "😌", "label": "Sleepy"},
        ],
    ),
    (
        "When the line moves slowly for hand-washing, what helps us wait?",
        "Everyone is waiting to wash hands before snack. What helps us stay patient?",
        "🧼",
        {"key": "patient", "emoji": "🫧", "label": "Wait Calmly"},
        [
            {"key": "push", "emoji": "💢", "label": "Push Forward"},
            {"key": "yell", "emoji": "📢", "label": "Yell"},
            {"key": "rush", "emoji": "🏃", "label": "Skip Ahead"},
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
        "Before tasting a mystery fruit snack, how might a curious learner feel?",
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
        "A stranger online asks for your real home address. What is the safe rule?",
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
        "You hear thunder outside while safely indoors with family. Who helps you feel safe?",
        "Boom goes thunder outside while you are cozy inside. What helps you feel safe?",
        "⛈️",
        {"key": "hug", "emoji": "🤗", "label": "Hug a Grown-Up"},
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
        {"key": "thanks", "emoji": "😊", "label": "Thank You!"},
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
            {"key": "crumple", "emoji": "💢", "label": "Get Upsets"},
            {"key": "hide", "emoji": "🙈", "label": "Hide the Board"},
        ],
    ),
]

WEATHER_SCENARIOS = [
    (
        "Raindrops are falling outside! What keeps us dry?",
        "It is raining outside! Tap what helps keep us dry.",
        "🌧️",
        {"key": "umbrella", "emoji": "☂️", "label": "Umbrella"},
        [
            {"key": "sunglasses", "emoji": "🕶️", "label": "Sunglasses"},
            {"key": "scarf", "emoji": "🧣", "label": "Snow Scarf"},
            {"key": "sandals", "emoji": "🩴", "label": "Flip-Flops"},
        ],
    ),
    (
        "The bright sunshine warms the park! What protects our eyes?",
        "It is a bright sunny day! What shades our eyes?",
        "☀️",
        {"key": "sunglasses", "emoji": "🕶️", "label": "Sunglasses"},
        [
            {"key": "boots", "emoji": "🥾", "label": "Rain Boots"},
            {"key": "gloves", "emoji": "🧤", "label": "Snow Gloves"},
            {"key": "coat", "emoji": "🧥", "label": "Heavy Coat"},
        ],
    ),
    (
        "Snowflakes are drifting gently down! What keeps hands cozy?",
        "Brrr, it is snowy! What keeps our hands warm?",
        "❄️",
        {"key": "gloves", "emoji": "🧤", "label": "Warm Gloves"},
        [
            {"key": "sandals", "emoji": "🩴", "label": "Sandals"},
            {"key": "cap", "emoji": "🧢", "label": "Sun Cap"},
            {"key": "fan", "emoji": "🪭", "label": "Paper Fan"},
        ],
    ),
    (
        "Whoosh goes the afternoon breeze! What flies high in the wind?",
        "It is windy at the park! Which toy loves flying in the breeze?",
        "💨",
        {"key": "kite", "emoji": "🪁", "label": "Colorful Kite"},
        [
            {"key": "sled", "emoji": "🛷", "label": "Snow Sled"},
            {"key": "bucket", "emoji": "🪣", "label": "Sand Bucket"},
            {"key": "pillow", "emoji": "🛏️", "label": "Pillow"},
        ],
    ),
    (
        "Sunshine peeks through rain clouds! What arches across the sky?",
        "Sun and rain appear together! What colorful arc shines in the sky?",
        "🌦️",
        {"key": "rainbow", "emoji": "🌈", "label": "Rainbow"},
        [
            {"key": "snowman", "emoji": "⛄", "label": "Snowman"},
            {"key": "flashlight", "emoji": "🔦", "label": "Flashlight"},
            {"key": "anchor", "emoji": "⚓", "label": "Anchor"},
        ],
    ),
    (
        "Puddles cover the sidewalk after rain. What keeps feet dry?",
        "Splash! There are puddles outside. What goes on our feet?",
        "💦",
        {"key": "boots", "emoji": "🥾", "label": "Rain Boots"},
        [
            {"key": "slippers", "emoji": "🩴", "label": "Open Sandals"},
            {"key": "mittens", "emoji": "🧤", "label": "Mittens"},
            {"key": "hat", "emoji": "🎩", "label": "Party Hat"},
        ],
    ),
    (
        "What do green garden plants drink when rain clouds water the soil?",
        "Rain falls gently on the garden! What do plants drink to grow?",
        "🌱",
        {"key": "water", "emoji": "💧", "label": "Fresh Water"},
        [
            {"key": "snow", "emoji": "🧊", "label": "Ice Cubes"},
            {"key": "sand", "emoji": "🏜️", "label": "Dry Sand"},
            {"key": "rock", "emoji": "🪨", "label": "Rocks"},
        ],
    ),
    (
        "On a hot summer beach day, what cools us off as a healthy treat?",
        "It is warm and sunny at the beach! Pick a refreshing fruit!",
        "🏖️",
        {"key": "watermelon", "emoji": "🍉", "label": "Watermelon"},
        [
            {"key": "scarf", "emoji": "🧣", "label": "Wool Scarf"},
            {"key": "coat", "emoji": "🧥", "label": "Puffer Jacket"},
            {"key": "boots", "emoji": "🥾", "label": "Snow Boots"},
        ],
    ),
    (
        "In autumn, red and golden leaves drift down from what?",
        "Crunch crunch! Where do colorful autumn leaves fall from?",
        "🍂",
        {"key": "tree", "emoji": "🌳", "label": "Tall Trees"},
        [
            {"key": "ocean", "emoji": "🌊", "label": "Ocean Waves"},
            {"key": "cloud", "emoji": "☁️", "label": "Clouds"},
            {"key": "moon", "emoji": "🌙", "label": "Moon"},
        ],
    ),
    (
        "At nighttime when the sky grows dark, what twinkles brightly above?",
        "Look up at the peaceful night sky! What twinkles with the moon?",
        "🌌",
        {"key": "stars", "emoji": "⭐", "label": "Twinkling Stars"},
        [
            {"key": "rainbow", "emoji": "🌈", "label": "Noon Sunbeam"},
            {"key": "flower", "emoji": "🌻", "label": "Sunflower"},
            {"key": "boat", "emoji": "⛵", "label": "Sailboat"},
        ],
    ),
    (
        "When frosty winter snow covers the yard, what can kids build together?",
        "White snow covers the ground! What friendly figure can we build?",
        "🌨️",
        {"key": "snowman", "emoji": "⛄", "label": "Snowman"},
        [
            {"key": "sandcastle", "emoji": "🏖️", "label": "Sandcastle"},
            {"key": "flowerbed", "emoji": "🌷", "label": "Spring Garden"},
            {"key": "butterfly", "emoji": "🦋", "label": "Butterfly"},
        ],
    ),
    (
        "Which season brings fresh blossoms, buzzing bees, and baby birds?",
        "Flowers open and bees buzz! Which gentle creature visits blooms?",
        "🌼",
        {"key": "bee", "emoji": "🐝", "label": "Honeybee"},
        [
            {"key": "penguin", "emoji": "🐧", "label": "Snow Penguin"},
            {"key": "crab", "emoji": "🦀", "label": "Beach Crab"},
            {"key": "owl", "emoji": "🦉", "label": "Night Owl"},
        ],
    ),
    (
        "On a cloudy morning, what covers the bright blue sky like fluffy pillows?",
        "Look up! Soft white shapes float across the morning sky.",
        "⛅",
        {"key": "clouds", "emoji": "☁️", "label": "Fluffy Clouds"},
        [
            {"key": "shells", "emoji": "🐚", "label": "Seashells"},
            {"key": "acorns", "emoji": "🌰", "label": "Acorns"},
            {"key": "bricks", "emoji": "🧱", "label": "Bricks"},
        ],
    ),
    (
        "Before walking in bright sunshine, what keeps our heads cool and shaded?",
        "Don't forget sun safety! Tap what protects your head in the sun.",
        "🌞",
        {"key": "cap", "emoji": "👒", "label": "Sun Hat"},
        [
            {"key": "mittens", "emoji": "🧤", "label": "Winter Mittens"},
            {"key": "scarf", "emoji": "🧣", "label": "Wool Scarf"},
            {"key": "umbrella_snow", "emoji": "🛷", "label": "Snow Sled"},
        ],
    ),
    (
        "Which cozy wrap goes around your neck on chilly winter mornings?",
        "Brrr! Keep your neck warm before stepping outside in cold weather.",
        "🌬️",
        {"key": "scarf", "emoji": "🧣", "label": "Cozy Scarf"},
        [
            {"key": "sunglasses", "emoji": "🕶️", "label": "Sunglasses"},
            {"key": "swim_goggles", "emoji": "🥽", "label": "Swim Goggles"},
            {"key": "sandals", "emoji": "🩴", "label": "Sandals"},
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
        {"id": "hf-f1", "label": "Sweet Grapes", "emoji": "🍇", "bin": "fruits"},
        {"id": "hf-f2", "label": "Watermelon", "emoji": "🍉", "bin": "fruits"},
        {"id": "hf-f3", "label": "Red Apple", "emoji": "🍎", "bin": "fruits"},
        {"id": "hf-f4", "label": "Banana", "emoji": "🍌", "bin": "fruits"},
        {"id": "hf-f5", "label": "Strawberry", "emoji": "🍓", "bin": "fruits"},
        {"id": "hf-f6", "label": "Fresh Pear", "emoji": "🍐", "bin": "fruits"},
    ],
    "veggies": [
        {"id": "hf-v1", "label": "Orange Carrot", "emoji": "🥕", "bin": "veggies"},
        {"id": "hf-v2", "label": "Broccoli", "emoji": "🥦", "bin": "veggies"},
        {"id": "hf-v3", "label": "Sweet Corn", "emoji": "🌽", "bin": "veggies"},
        {"id": "hf-v4", "label": "Cucumber", "emoji": "🥒", "bin": "veggies"},
        {"id": "hf-v5", "label": "Tomato", "emoji": "🍅", "bin": "veggies"},
        {"id": "hf-v6", "label": "Green Lettuce", "emoji": "🥬", "bin": "veggies"},
    ],
    "drinks": [
        {"id": "hf-d1", "label": "Fresh Water", "emoji": "💧", "bin": "drinks"},
        {"id": "hf-d2", "label": "Warm Milk", "emoji": "🥛", "bin": "drinks"},
        {"id": "hf-d3", "label": "Coconut Water", "emoji": "🥥", "bin": "drinks"},
        {"id": "hf-d4", "label": "Apple Juice", "emoji": "🧃", "bin": "drinks"},
        {"id": "hf-d5", "label": "Lemon Water", "emoji": "🍋", "bin": "drinks"},
        {"id": "hf-d6", "label": "Warm Tea Cup", "emoji": "🍵", "bin": "drinks"},
    ],
}

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
                "prompt": f"Who says '{sound}'?",
                "speak": f"Listen closely: {sound} Which animal friend makes that sound?",
                "visual": {"kind": "sound", "text": sound},
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


def build_weekly_game_config(
    slug: str,
    base_config: dict[str, Any],
    week: Optional[str] = None,
) -> dict[str, Any]:
    """Return a deterministic weekly-rotating 12-question/item config for a game slug."""
    week_key, iso_week = parse_week_key(week)
    weekly_label = f"Week {iso_week} Fresh Mix"
    rng = _week_rng(slug, week_key)

    meta = {"weekly_key": week_key, "weekly_label": weekly_label}

    if slug == "letter-matching":
        return {
            "engine": "choice",
            "skill": "Phonics & Initial Sounds",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_letter_matching(rng),
            **meta,
        }
    if slug == "number-counting":
        return {
            "engine": "choice",
            "skill": "Counting 1-12",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_number_counting(rng),
            **meta,
        }
    if slug == "fruit-addition":
        return {
            "engine": "choice",
            "skill": "Visual Addition",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_fruit_addition(rng),
            **meta,
        }
    if slug == "color-recognition":
        return {
            "engine": "choice",
            "skill": "Color Recognition",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_color_recognition(rng),
            **meta,
        }
    if slug == "pattern-completion":
        return {
            "engine": "choice",
            "skill": "Number Sense & Patterns",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_pattern_completion(rng),
            **meta,
        }
    if slug == "animal-sounds":
        return {
            "engine": "choice",
            "skill": "Animal Listening",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_animal_sounds(rng),
            **meta,
        }
    if slug == "picture-vocabulary":
        return {
            "engine": "choice",
            "skill": "Everyday Vocabulary",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_picture_vocabulary(rng),
            **meta,
        }
    if slug == "feelings-detective":
        return {
            "engine": "choice",
            "skill": "Emotional Awareness",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_curated_scenarios(rng, FEELINGS_SCENARIOS),
            **meta,
        }
    if slug == "weather-dress-up":
        return {
            "engine": "choice",
            "skill": "Weather & Seasons",
            "feedback": FEEDBACK_PHRASES,
            "rounds": _gen_curated_scenarios(rng, WEATHER_SCENARIOS),
            **meta,
        }
    if slug == "shape-sorting":
        return {
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
    if slug == "object-sorting":
        return {
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
    if slug == "healthy-snack-sorter":
        return {
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
    if slug == "memory-matching":
        return {
            "engine": "memory",
            "skill": "Visual Memory & Colors",
            "feedback": FEEDBACK_PHRASES,
            "pairs": copy.deepcopy(rng.sample(MEMORY_NATURE_POOL, 6)),
            **meta,
        }
    if slug == "ocean-friends-memory":
        return {
            "engine": "memory",
            "skill": "Ocean Life Memory",
            "feedback": FEEDBACK_PHRASES,
            "pairs": copy.deepcopy(rng.sample(MEMORY_OCEAN_POOL, 6)),
            **meta,
        }
    if slug == "puzzle-assembly":
        return {
            "engine": "puzzle",
            "skill": "Spatial Puzzle Assembly",
            "feedback": FEEDBACK_PHRASES,
            "grid": 2,
            "pictures": copy.deepcopy(rng.sample(PUZZLE_NATURE_POOL, 3)),
            **meta,
        }
    if slug == "space-explorer-puzzle":
        return {
            "engine": "puzzle",
            "skill": "Space Spatial Puzzles",
            "feedback": FEEDBACK_PHRASES,
            "grid": 2,
            "pictures": copy.deepcopy(rng.sample(PUZZLE_SPACE_POOL, 3)),
            **meta,
        }

    cfg = copy.deepcopy(base_config or {})
    cfg.setdefault("weekly_key", week_key)
    cfg.setdefault("weekly_label", weekly_label)
    return cfg
