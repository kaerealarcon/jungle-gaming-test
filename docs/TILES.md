# Numbered tile map

All 96 tiles appear in [the contact sheet](tile-catalog.png). IDs refer to tile_N.png in both resolutions; runtime crops the shared sheet. Tiles 81–86 have square sand backgrounds rather than transparent props.

| IDs | Appearance / potential use |
| --- | --- |
| 1–3, 17–19, 33–35 | Bare-sand outer corners, edges and fill |
| 4–5, 20–21 | Additional sand fill/corner pieces |
| 6–9, 22, 25, 38, 41, 54–57 | Current compatible sand/grass coast family |
| 23 | Current grass fill and mirrored outer ground |
| 24, 39–40 | Flowers/plants on grass |
| 36–37, 52–53 | Sand/grass inner corners |
| 10–12, 26–28, 42–44 | Gray terrain corners/edges/fill |
| 58–59, 74–75 | Gray terrain inner corners |
| 13–14, 29–30, 45–46, 61–62, 77–78, 93–94 | Round stone platforms/junctions |
| 15–16 | Vertical/horizontal stone walkway |
| 31–32, 47–48 | Walkway with mounted cannons |
| 49–51 | Transparent rock props |
| 60, 76 | Wooden crossings on stone walkway |
| 63–64, 79–80 | Rounded walkway ends |
| 65–67 | Transparent mossy rocks |
| 68–69 | Speckled sand/beach fill |
| 70–72 | Transparent foliage/trees |
| 73 | Playable water |
| 81–82 | Boat on sand, optional grass transition |
| 83–84 | Cannon/debris on sand, optional grass transition |
| 85–86 | Rock/plants on sand, optional grass transition |
| 87–88 | Small transparent plant clusters |
| 89–92 | Damaged stone walkways |
| 95–96 | Widened stone walkways |

Current island grid: `[[6,7,8,9],[22,23,24,25],[38,39,40,41],[54,55,56,57]]`. Decorative props add no collision geometry; rounded island bounds remain the navigation/collision shape. Alternatives are preserved without changing the accepted design.
