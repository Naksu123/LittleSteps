from typing import Any

from app.services.game_generator import FEEDBACK_PHRASES, build_weekly_game_config

GAME_SLUGS = [
    "letter-matching",
    "number-counting",
    "shape-sorting",
    "memory-matching",
    "animal-sounds",
    "picture-vocabulary",
    "puzzle-assembly",
    "color-recognition",
    "pattern-completion",
    "object-sorting",
    "fruit-addition",
    "feelings-detective",
    "healthy-snack-sorter",
    "weather-dress-up",
    "ocean-friends-memory",
    "space-explorer-puzzle",
]

GAME_CONFIGS: dict[str, dict[str, Any]] = {
    slug: build_weekly_game_config(slug, {}, week="2026-W01") for slug in GAME_SLUGS
}

LESSON_CONTENT: dict[str, dict[str, Any]] = {
    "alphabet-letter-b": {
        "skill": "Phonics & Initial Sounds",
        "slides": [
            {
                "title": "Meet Letter B!",
                "text": "Big B and little b make the bouncy /b/ sound, just like a bouncing ball!",
                "emoji": "🅱️",
                "narration": "Say hello to letter B! B makes the bouncy b sound like ball and bear.",
            },
            {
                "title": "Benny the Bear",
                "text": "B is for Bear! Benny loves blue berries and big balloons.",
                "emoji": "🐻",
                "narration": "B is for bear! Benny Bear loves blueberries and big balloons.",
            },
            {
                "title": "Spot the /b/ Words",
                "text": "Listen closely: Boat, Banana, and Butterfly all begin with B!",
                "emoji": "🦋",
                "narration": "Boat, banana, and butterfly all start with the letter B sound!",
            },
        ],
        "activity": {
            "engine": "choice",
            "skill": "Phonics & Initial Sounds",
            "feedback": FEEDBACK_PHRASES,
            "rounds": [
                {
                    "prompt": "Which picture starts with the /b/ sound?",
                    "speak": "Tap the picture that starts with the letter B sound!",
                    "visual": {"kind": "emoji", "value": "🅱️"},
                    "choices": [
                        {"key": "ball", "emoji": "⚽", "label": "Ball"},
                        {"key": "apple", "emoji": "🍎", "label": "Apple"},
                        {"key": "sun", "emoji": "☀️", "label": "Sun"},
                    ],
                    "answer": "ball",
                },
                {
                    "prompt": "Find the letter B!",
                    "speak": "Tap the big letter B!",
                    "visual": {"kind": "emoji", "value": "🐻"},
                    "choices": [
                        {"key": "M", "text": "M"},
                        {"key": "B", "text": "B"},
                        {"key": "R", "text": "R"},
                    ],
                    "answer": "B",
                },
            ],
        },
    },
    "counting-fruits-1-10": {
        "skill": "Counting 1-10",
        "slides": [
            {
                "title": "Touch & Count Gently",
                "text": "When we count objects, we point to one item for each number we say!",
                "emoji": "🍎",
                "narration": "Point to one fruit at a time as we count together: one, two, three!",
            },
            {
                "title": "Counting to Five",
                "text": "Look at one hand—you have 5 helpful fingers for counting up to 5!",
                "emoji": "🖐️",
                "narration": "Hold up five fingers and wiggle them as we count one, two, three, four, five!",
            },
            {
                "title": "Counting to Ten",
                "text": "Put both hands together and we can count all the way to 10 yummy fruits!",
                "emoji": "🍓",
                "narration": "Both hands together give us ten! Let's practice counting in our mini game.",
            },
        ],
        "activity": {
            "engine": "choice",
            "skill": "Counting 1-10",
            "feedback": FEEDBACK_PHRASES,
            "rounds": [
                {
                    "prompt": "Count the yellow bananas!",
                    "speak": "How many yellow bananas do you see?",
                    "visual": {"kind": "count", "emoji": "🍌", "count": 4},
                    "choices": [
                        {"key": "3", "text": "3"},
                        {"key": "4", "text": "4"},
                        {"key": "6", "text": "6"},
                    ],
                    "answer": "4",
                },
                {
                    "prompt": "Count the juicy oranges!",
                    "speak": "How many juicy oranges are there?",
                    "visual": {"kind": "count", "emoji": "🍊", "count": 6},
                    "choices": [
                        {"key": "5", "text": "5"},
                        {"key": "6", "text": "6"},
                        {"key": "7", "text": "7"},
                    ],
                    "answer": "6",
                },
            ],
        },
    },
    "animal-habitats-explorer": {
        "skill": "Animal Habitats",
        "slides": [
            {
                "title": "Cozy Homes in Nature",
                "text": "Just like people live in houses, animal friends have special habitats in nature!",
                "emoji": "🌳",
                "narration": "Every animal has a special cozy home in nature called a habitat.",
            },
            {
                "title": "High in the Treetops",
                "text": "Birds weave soft twigs and leaves into round nests high up in branches.",
                "emoji": "🐦",
                "narration": "Little birds build cozy nests high in leafy trees.",
            },
            {
                "title": "Splish Splash in the Pond",
                "text": "Fish and playful frogs love cool water and shady lily pads!",
                "emoji": "🐸",
                "narration": "Frogs and fish live happily in cool ponds and lakes.",
            },
        ],
        "activity": {
            "engine": "choice",
            "skill": "Animal Habitats",
            "feedback": FEEDBACK_PHRASES,
            "rounds": [
                {
                    "prompt": "Where does a little bird sleep?",
                    "speak": "Tap the cozy home where a bird sleeps!",
                    "visual": {"kind": "emoji", "value": "🐦"},
                    "choices": [
                        {"key": "nest", "emoji": "🪺", "label": "Tree Nest"},
                        {"key": "ocean", "emoji": "🌊", "label": "Deep Ocean"},
                        {"key": "igloo", "emoji": "🧊", "label": "Ice Cave"},
                    ],
                    "answer": "nest",
                },
                {
                    "prompt": "Which friend lives under the water?",
                    "speak": "Tap the friend that swims underwater!",
                    "visual": {"kind": "emoji", "value": "🌊"},
                    "choices": [
                        {"key": "bunny", "emoji": "🐰", "label": "Bunny"},
                        {"key": "fish", "emoji": "🐟", "label": "Fish"},
                        {"key": "owl", "emoji": "🦉", "label": "Owl"},
                    ],
                    "answer": "fish",
                },
            ],
        },
    },
    "feelings-rainbow": {
        "skill": "Emotional Awareness",
        "slides": [
            {
                "title": "All Feelings Are Welcome",
                "text": "Sometimes we feel sunny and happy, and sometimes we feel quiet, sad, or frustrated.",
                "emoji": "🌈",
                "narration": "All our feelings are okay! Naming how we feel helps grown-ups understand us.",
            },
            {
                "title": "Smell the Flower, Blow the Candle",
                "text": "When big feelings arrive, breathe in gently like smelling a flower, then blow out slowly!",
                "emoji": "🌸",
                "narration": "Try a calm breath: smell the flower slowly, then blow out the birthday candle.",
            },
            {
                "title": "Kindness for Friends",
                "text": "If a friend looks sad, we can share a smile or ask if they want to play.",
                "emoji": "💛",
                "narration": "Kind words and gentle smiles help our friends feel cared for.",
            },
        ],
        "activity": {
            "engine": "choice",
            "skill": "Emotional Awareness",
            "feedback": FEEDBACK_PHRASES,
            "rounds": [
                {
                    "prompt": "Which face shows feeling Happy?",
                    "speak": "Tap the smiling, happy face!",
                    "visual": None,
                    "choices": [
                        {"key": "happy", "emoji": "😊", "label": "Happy"},
                        {"key": "sleepy", "emoji": "😴", "label": "Sleepy"},
                        {"key": "surprised", "emoji": "😮", "label": "Surprised"},
                    ],
                    "answer": "happy",
                },
                {
                    "prompt": "What helps us calm down when upset?",
                    "speak": "Tap a gentle way to feel calm!",
                    "visual": None,
                    "choices": [
                        {"key": "breathe", "emoji": "🌸", "label": "Slow Deep Breath"},
                        {"key": "yell", "emoji": "📢", "label": "Loud Yelling"},
                        {"key": "rush", "emoji": "🏃", "label": "Running Fast"},
                    ],
                    "answer": "breathe",
                },
            ],
        },
    },
    "primary-colors-studio": {
        "skill": "Color Recognition",
        "slides": [
            {
                "title": "Meet the Three Primary Colors",
                "text": "Red, Yellow, and Blue are special primary colors that help paint the whole world!",
                "emoji": "🎨",
                "narration": "Red, yellow, and blue are the three bright primary colors!",
            },
            {
                "title": "Bright Red & Sunshine Yellow",
                "text": "Red shines in sweet strawberries and fire trucks. Yellow glows in bananas and the sun!",
                "emoji": "🍓",
                "narration": "Strawberries are red, and sunshine bananas are bright yellow!",
            },
            {
                "title": "Calm Sky Blue",
                "text": "Look up at a clear morning sky or deep ocean waves—that peaceful color is blue!",
                "emoji": "🌊",
                "narration": "The clear sky and ocean shimmer with peaceful blue!",
            },
        ],
        "activity": {
            "engine": "choice",
            "skill": "Color Recognition",
            "feedback": FEEDBACK_PHRASES,
            "rounds": [
                {
                    "prompt": "Tap the Bright Red color!",
                    "speak": "Can you tap the bright red circle?",
                    "visual": None,
                    "choices": [
                        {"key": "red", "hex": "#FF6B6B", "label": "Red"},
                        {"key": "blue", "hex": "#78C8F5", "label": "Blue"},
                        {"key": "yellow", "hex": "#FFE58A", "label": "Yellow"},
                    ],
                    "answer": "red",
                },
                {
                    "prompt": "Tap the Sunshine Yellow color!",
                    "speak": "Now tap the sunshine yellow circle!",
                    "visual": None,
                    "choices": [
                        {"key": "blue", "hex": "#78C8F5", "label": "Blue"},
                        {"key": "yellow", "hex": "#FFE58A", "label": "Yellow"},
                        {"key": "mint", "hex": "#9BE7C4", "label": "Green"},
                    ],
                    "answer": "yellow",
                },
            ],
        },
    },
    "sunny-morning-routine": {
        "skill": "Healthy Daily Routines",
        "slides": [
            {
                "title": "Wake Up & Smile!",
                "text": "Every morning starts with stretching our arms tall and washing our hands with soap!",
                "emoji": "🧼",
                "narration": "Good morning! Washing our hands with bubbly soap keeps germs away.",
            },
            {
                "title": "Brush Those Pearly Teeth",
                "text": "Brush gently up, down, and in little circles so our teeth stay shiny and strong.",
                "emoji": "🪥",
                "narration": "Brush gently in little circles for clean, bright teeth!",
            },
            {
                "title": "Yummy Healthy Breakfast",
                "text": "Colorful fruits, whole grains, and fresh water give our bodies energy to learn and play!",
                "emoji": "🥗",
                "narration": "Healthy food and water give us energy for kindergarten adventures!",
            },
        ],
        "activity": {
            "engine": "choice",
            "skill": "Healthy Daily Routines",
            "feedback": FEEDBACK_PHRASES,
            "rounds": [
                {
                    "prompt": "What do we use to brush our teeth?",
                    "speak": "Tap what helps keep our teeth clean and shiny!",
                    "visual": None,
                    "choices": [
                        {"key": "toothbrush", "emoji": "🪥", "label": "Toothbrush"},
                        {"key": "crayon", "emoji": "🖍️", "label": "Crayon"},
                        {"key": "shoe", "emoji": "👟", "label": "Shoe"},
                    ],
                    "answer": "toothbrush",
                },
                {
                    "prompt": "Pick a healthy colorful snack!",
                    "speak": "Tap a fresh healthy snack!",
                    "visual": None,
                    "choices": [
                        {"key": "apple", "emoji": "🍎", "label": "Fresh Apple"},
                        {"key": "sock", "emoji": "🧦", "label": "Clean Sock"},
                        {"key": "ball", "emoji": "⚽", "label": "Soccer Ball"},
                    ],
                    "answer": "apple",
                },
            ],
        },
    },
}
