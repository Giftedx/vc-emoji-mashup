## 2024-07-26 - [kitchen.ts Caching]
**Learning:** Initializing object graphs from string-based attributes repeatedly can be extremely costly. Pre-computing values such as search keys or mapping references heavily optimizes search queries that span over multiple properties for elements like emojis.
**Action:** Always verify if complex computations that iterate over a set can have intermediate states cached to prevent repeated operations across multiple function calls.
