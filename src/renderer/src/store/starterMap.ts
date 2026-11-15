import {
  CameraBookmark,
  CampaignSnapshot,
  CanvasTheme,
  ConnectionPreset,
  CustomEntityType,
  DndEdge,
  DndNode
} from '../types'
import {
  ARKENSTONE_TOKEN_ART,
  BILBO_TOKEN_ART,
  EREBOR_BANNER_ART,
  GANDALF_TOKEN_ART,
  SMAUG_BANNER_ART,
  THORIN_TOKEN_ART
} from './hobbitArt'

export const STARTER_CAMPAIGN_TITLE = 'The Hobbit: Eve of Five Armies'

export const STARTER_CANVAS_THEME: CanvasTheme = 'parchment'

/**
 * Showcases Custom Entity Categories right out of the box:
 * In DM View, Legend shows `Army / Host — 5` (all Five Armies!).
 * Toggling Player View drops the count to `3` (hiding the Goblins & Wild Wargs)!
 */
export const STARTER_CUSTOM_ENTITY_TYPES: CustomEntityType[] = [
  {
    label: 'Army / Host',
    color: '#b91c1c',
    icon: 'Flag',
    borderStyle: 'solid',
    archetype: 'organization'
  }
]

export const STARTER_CAMERA_BOOKMARKS: CameraBookmark[] = [
  {
    id: 'bm-shire-rivendell',
    label: 'The Shire & Rivendell',
    centerX: 440,
    centerY: 495,
    zoom: 0.88,
    playerVisible: true
  },
  {
    id: 'bm-misty-beorn',
    label: 'Misty Mts & Beorn',
    centerX: 1365,
    centerY: 540,
    zoom: 0.76,
    playerVisible: true
  },
  {
    id: 'bm-mirkwood-laketown',
    label: 'Mirkwood & Lake-town',
    centerX: 2070,
    centerY: 690,
    zoom: 0.68,
    playerVisible: true
  },
  {
    id: 'bm-siege-erebor',
    label: 'Siege of Erebor',
    centerX: 3335,
    centerY: 660,
    zoom: 0.64,
    playerVisible: true
  }
]

export const STARTER_CONNECTION_PRESETS: ConnectionPreset[] = [
  { label: 'Allied', color: '#10b981', lineStyle: 'solid', thickness: 2, direction: 'none' },
  { label: 'Commands', color: '#ef4444', lineStyle: 'solid', thickness: 3, direction: 'forward' },
  {
    label: 'Enemies / Siege',
    color: '#ef4444',
    lineStyle: 'dashed',
    thickness: 2,
    direction: 'bidirectional'
  },
  { label: 'Secret', color: '#8b5cf6', lineStyle: 'dashed', thickness: 2, direction: 'forward' },
  {
    label: 'Seeking / Claiming',
    color: '#3b82f6',
    lineStyle: 'solid',
    thickness: 2,
    direction: 'forward'
  },
  {
    label: 'Journey / Trail',
    color: '#eab308',
    lineStyle: 'dotted',
    thickness: 2,
    direction: 'forward'
  },
  {
    label: 'Possesses / Lore',
    color: '#64748b',
    lineStyle: 'solid',
    thickness: 2,
    direction: 'forward'
  }
]

export const STARTER_NODES: DndNode[] = [
  // ============================================================================
  // COLUMN 1 (x = 80) — THE SHIRE (FAR WEST — LEAVES BOTTOM-LEFT LEGEND COVE OPEN)
  // ============================================================================
  {
    id: 'node-map',
    type: 'entity',
    position: { x: 80, y: 290 },
    data: {
      label: "Thrór's Map & Silver Key",
      entityType: 'Item',
      shape: 'sticky',
      statusIcons: ['Key', 'Scroll'],
      publicNotes:
        'Ancient parchment map of [[The Lonely Mountain (Erebor)]] paired with a small silver key, passed by [[Gandalf the Grey]] to [[Thorin Oakenshield]] at [[Bag End (The Shire)]]. [[Elrond]] revealed its Moon-letters pointing to the secret western door.',
      partyNotes:
        "Saved our lives when the thrush knocked on the cliffside at sunset on Durin's Day!",
      dmNotes:
        "Gandalf recovered both map and key from Thorin's dying father Thráin II in the dungeons of [[The Necromancer (Dol Guldur)]]—proof that southern Mirkwood is tied to Erebor's fate.",
      dndFields: {
        rarity: 'Rare',
        attunement: false,
        holder: 'Thorin Oakenshield'
      }
    }
  },
  {
    id: 'node-bag-end',
    type: 'entity',
    position: { x: 80, y: 610 },
    data: {
      label: 'Bag End (The Shire)',
      entityType: 'Location',
      shape: 'arch',
      statusIcons: ['Sun'],
      publicNotes:
        'Comfortable, smoke-ringed hobbit-hole under the Hill in Hobbiton where [[Gandalf the Grey]] and [[Thorin & Company]] held their Unexpected Party and recruited [[Bilbo Baggins]].',
      partyNotes:
        'Bilbo still daydreams about his kettle, armchairs, and second breakfast whenever the cold mountain wind howls.',
      dmNotes:
        'Because Bilbo has been gone over a year, his Sackville-Baggins cousins already assume him dead and are measuring his rooms for auction.',
      dndFields: {
        region: 'The Shire (Eriador)',
        locationType: 'Hobbit-hole Homestead',
        dangerTier: 'Safe Haven'
      }
    }
  },

  // ============================================================================
  // COLUMN 2 (x = 535) — RIVENDELL
  // ============================================================================
  {
    id: 'node-elrond',
    type: 'entity',
    position: { x: 535, y: 290 },
    data: {
      label: 'Elrond',
      entityType: 'NPC',
      shape: 'pill',
      aliases: ['Lord Elrond', 'Master of Rivendell'],
      tags: ['white-council'],
      stats: 'AC 18 | HP 165',
      statusIcons: ['Moon', 'Book'],
      publicNotes:
        "Wise Half-elven master of [[Rivendell (Last Homely House)]], lore-master who named Gondolin blades *Orcrist* and *Glamdring* and read the Moon-letters upon [[Thrór's Map & Silver Key]].",
      dmNotes:
        'Member of the White Council alongside [[Gandalf the Grey]]; privately aided the assault to drive [[The Necromancer (Dol Guldur)]] from southern Mirkwood.',
      dndFields: {
        ancestry: 'Half-elven',
        classOrRole: 'Lord of Rivendell / Lore-master',
        alignment: 'Neutral Good',
        faction: 'High Elves & White Council',
        disposition: 'Allied',
        ac: '18',
        hp: '165',
        voiceCue: 'Clear, ageless baritone; warm as starlight over water'
      }
    }
  },
  {
    id: 'node-rivendell',
    type: 'entity',
    position: { x: 535, y: 610 },
    data: {
      label: 'Rivendell (Last Homely House)',
      entityType: 'Location',
      shape: 'arch',
      statusIcons: ['Sparkles'],
      publicNotes:
        'Hidden valley sanctuary of [[Elrond]] West of the Misty Mountains where [[Thorin & Company]] rested, healed, and resupplied in Midsummer.',
      dmNotes:
        'Safe waypoint for the return journey once the crisis at [[The Lonely Mountain (Erebor)]] concludes.',
      dndFields: {
        region: 'Foothills of the Misty Mountains',
        locationType: 'Hidden Elven Refuge',
        dangerTier: 'Sanctuary'
      }
    }
  },

  // ============================================================================
  // COLUMN 3 (x = 1005) — THE MISTY MOUNTAINS
  // ============================================================================
  {
    id: 'node-eagles',
    type: 'entity',
    position: { x: 1005, y: 40 },
    data: {
      label: 'The Great Eagles',
      entityType: 'Organization',
      shape: 'box',
      statusIcons: ['Feather', 'Crown'],
      publicNotes:
        'Proud, ancient eagles of the northern crags ruled by the Lord of the Eagles. Rescued [[Bilbo Baggins]], [[Gandalf the Grey]], and [[Thorin & Company]] from burning fir trees and bore them east toward [[Beorn]].',
      dmNotes:
        'Eagle scouts high above the passes have spotted [[Goblins of the North]] and [[Wild Wargs of the North]] mustering in secret! A great host of Eagles is already taking wing toward [[The Lonely Mountain (Erebor)]] and will arrive at the height of battle.',
      dndFields: {
        influence: 'Northern Misty Mountains',
        alignment: 'Neutral Good',
        headquarters: 'Eyries of the Misty Mountains',
        goal: 'Watch the mountain passes and thwart goblin cruelty'
      }
    }
  },
  {
    id: 'node-great-goblin',
    type: 'entity',
    position: { x: 1005, y: 310 },
    data: {
      label: 'The Great Goblin',
      entityType: 'NPC',
      shape: 'box',
      stats: 'AC 15 | HP 68',
      statusIcons: ['Skull'],
      publicNotes:
        'Massive-headed chieftain of [[Goblin-town (Misty Mountains)]] who interrogated [[Thorin & Company]], raged upon seeing the blade *Orcrist*, and was slain in a flash by [[Gandalf the Grey]].',
      dmNotes:
        "His death enraged every goblin tribe from Mount Gundabad to Moria—fueling [[Bolg of the North]]'s secret march of vengeance against [[Thorin Oakenshield]].",
      dndFields: {
        ancestry: 'Goblin',
        classOrRole: 'Under-mountain Tyrant',
        alignment: 'Chaotic Evil',
        faction: 'Goblins of the Misty Mountains',
        disposition: 'Deceased',
        ac: '15',
        hp: '68',
        voiceCue: 'Gnashing, booming snarl echoing off stone'
      }
    }
  },
  {
    id: 'node-goblin-town',
    type: 'entity',
    position: { x: 1005, y: 615 },
    data: {
      label: 'Goblin-town (Misty Mountains)',
      entityType: 'Location',
      shape: 'oval',
      statusIcons: ['Mountain'],
      publicNotes:
        "Labyrinth of cavern halls and pitch-black abysses beneath the High Pass where goblins ambushed the Company's cave camp and [[Bilbo Baggins]] tumbled into the dark.",
      dmNotes:
        'Northern tunnels now stand emptied of warriors—nearly their entire fighting strength has joined [[Goblins of the North]].',
      dndFields: {
        region: 'High Pass, Misty Mountains',
        locationType: 'Subterranean Goblin Stronghold',
        dangerTier: 'High (Swarming Tunnels)'
      }
    }
  },
  {
    id: 'node-gollum',
    type: 'entity',
    position: { x: 1005, y: 950 },
    data: {
      label: 'Gollum',
      entityType: 'NPC',
      shape: 'pill',
      aliases: ['Smeagol', 'Sméagol'],
      tags: ['ring-lore'],
      stats: 'AC 14 | HP 38',
      statusIcons: ['Eye'],
      publicNotes:
        'Pale, lamp-eyed creature paddling an underground lake beneath [[Goblin-town (Misty Mountains)]]. Played a deadly riddle-game with [[Bilbo Baggins]] before discovering his "Birthday Present" ([[Bilbo\'s "Magic" Ring]]) was missing.',
      partyNotes:
        "Bilbo originally told us Gollum promised him a present and apologized when he couldn't find it... why did Bilbo look so guilty telling that part?",
      dmNotes:
        'Obsessed with reclaiming [[Bilbo\'s "Magic" Ring]]. Remember the name he shrieked into the dark—"Thief! Baggins! Shire!"—a long-term hook if Sauron ever captures him.',
      dndFields: {
        ancestry: 'Stoor (Corrupted Hobbit-kin)',
        classOrRole: 'Subterranean Stalker',
        alignment: 'Neutral Evil',
        disposition: 'Hostile',
        ac: '14',
        hp: '38',
        voiceCue: 'Wet, sibilant whisper punctuated by "gollum!" throat-swallows'
      }
    }
  },

  // ============================================================================
  // COLUMN 4 (x = 1455) — WILDERLAND, MIRKWOOD & SOUTHERN SHADOW
  // ============================================================================
  {
    id: 'node-beorn',
    type: 'entity',
    position: { x: 1455, y: 230 },
    data: {
      label: 'Beorn',
      entityType: 'NPC',
      shape: 'box',
      stats: 'AC 16 | HP 148',
      statusIcons: ['Heart', 'Shield'],
      publicNotes:
        "Towering skin-changer who dwells in an oak hall between the Carrock and [[Mirkwood & Elvenking's Halls]], served by intelligent beasts. Sheltered the party and lent ponies to the forest gate.",
      partyNotes:
        'Fiercely hates goblins and wargs; warned us never to stray from the elf-path or drink the enchanted black stream in Mirkwood.',
      dmNotes:
        "Learned from captured goblin stragglers that [[Bolg of the North]] is marching on [[The Lonely Mountain (Erebor)]]! Already traveling east in giant bear-form and will crash into Bolg's bodyguard to turn the tide.",
      dndFields: {
        ancestry: 'Human Skin-changer',
        classOrRole: 'Berserker Warden',
        alignment: 'Chaotic Good',
        disposition: 'Allied',
        ac: '16',
        hp: '148',
        voiceCue: 'Deep, gruff rumble like distant thunder; abrupt but hospitable'
      }
    }
  },
  {
    id: 'node-mirkwood',
    type: 'entity',
    position: { x: 1455, y: 590 },
    data: {
      label: "Mirkwood & Elvenking's Halls",
      entityType: 'Location',
      shape: 'arch',
      statusIcons: ['TreePine', 'Lock'],
      publicNotes:
        'Vast, spider-choked woodland east of the Anduin and the subterranean river-palace where [[Thranduil (Elvenking)]] imprisoned [[Thorin & Company]] until [[Bilbo Baggins]] smuggled them out in empty wine-barrels.',
      dmNotes:
        'Though [[The Necromancer (Dol Guldur)]] was just driven from the southern fortress, giant spiders and dark enchantments still linger under the canopy.',
      dndFields: {
        region: 'Wilderland (Rhovanion)',
        locationType: 'Enchanted Forest & Elven Cavern Fortress',
        dangerTier: 'High (Spiders & Enchanted Waters)'
      }
    }
  },
  {
    id: 'node-theory-gandalf',
    type: 'entity',
    position: { x: 1455, y: 950 },
    data: {
      label: 'Where Did Gandalf Vanish To?',
      entityType: 'Event',
      shape: 'sticky',
      isPlayerCreated: true,
      statusIcons: ['HelpCircle'],
      publicNotes:
        'Gandalf abandoned us right at the gloomy border of [[Mirkwood & Elvenking\'s Halls]] muttering about "pressing business in the South," and only just reappeared in Dale tonight looking travel-worn.',
      partyNotes:
        "Party Theory: Back at [[Bag End (The Shire)]], [[Gandalf the Grey]] mentioned a shadowy Necromancer in southern Mirkwood where Thorin's father vanished. Did he ride south with [[Elrond]] to confront him—and what else did he learn on the road back?",
      dndFields: {
        questStatus: 'Active',
        sessionDate: 'Player Theory Pin'
      }
    }
  },
  {
    id: 'node-necromancer',
    type: 'entity',
    position: { x: 1455, y: 1330 },
    data: {
      label: 'The Necromancer (Dol Guldur)',
      entityType: 'NPC',
      shape: 'leaf',
      isHidden: true,
      aliases: ['Sauron', 'The Necromancer', 'Dol Guldur'],
      tags: ['white-council', 'ring-lore'],
      stats: 'AC 22 | HP 350',
      statusIcons: ['Eye', 'Flame'],
      publicNotes:
        'Dread sorcerer rumored in old tales to haunt the dark southern fastness of Mirkwood.',
      dmNotes:
        'DM SECRET: No mere mortal sorcerer, but **Sauron** himself! [[Gandalf the Grey]] and the White Council just stormed Dol Guldur, forcing him to feign retreat toward Mordor—yet [[Bilbo\'s "Magic" Ring]] is secretly his Ruling Ring.',
      dndFields: {
        ancestry: 'Maia (Dark Lord)',
        classOrRole: 'Shadow of Dol Guldur',
        alignment: 'Lawful Evil',
        headquarters: 'Dol Guldur (Southern Mirkwood)',
        disposition: 'Hostile',
        ac: '22',
        hp: '350',
        voiceCue: 'Ice-cold iron whisper felt behind the eyes rather than heard'
      }
    }
  },

  // ============================================================================
  // COLUMN 5 (x = 1915) — SMAUG (CARD BANNER!) & LAKE-TOWN
  // ============================================================================
  {
    id: 'node-wood-elves',
    type: 'entity',
    position: { x: 1915, y: 40 },
    data: {
      label: 'Wood-elves of Mirkwood',
      entityType: 'Army / Host',
      shape: 'box',
      tags: ['five-armies', 'dale-parley'],
      statusIcons: ['TreePine', 'Flag'],
      publicNotes:
        "**Army #1 of the Five Armies** — Swift spearmen and deadly bowmen of [[Mirkwood & Elvenking's Halls]] led by [[Thranduil (Elvenking)]], who diverted their march to feed and shelter starving Lake-men.",
      dmNotes:
        'Roughly 1,000 elven warriors encamped in Dale; Thranduil is reluctant to spill blood over gold alone if [[Bard the Bowman]] can broker terms.',
      dndFields: {
        influence: 'Northern Mirkwood & Dale Camp',
        alignment: 'Chaotic Good',
        headquarters: "Elvenking's Halls",
        goal: 'Aid Lake-town survivors and claim ancient elven gems'
      }
    }
  },
  {
    id: 'node-smaug',
    type: 'entity',
    position: { x: 1915, y: 250 },
    data: {
      label: 'Smaug the Golden',
      entityType: 'NPC',
      shape: 'default',
      aliases: ['Smaug', 'Smaug the Magnificent'],
      tags: ['dragon-hoard'],
      portrait: SMAUG_BANNER_ART,
      portraitMode: 'card',
      stats: 'AC 22 | HP 546',
      statusIcons: ['Skull', 'Flame'],
      publicNotes:
        "Greatest fire-drake of the Third Age who usurped [[The Lonely Mountain (Erebor)]]. Enraged after [[Bilbo Baggins]] stole a two-handled cup and spotted the bare patch over his left breast, Smaug burned [[Ruins of Lake-town (Esgaroth)]] before falling to [[Bard the Bowman]]'s Black Arrow.",
      partyNotes:
        "Thank goodness the old thrush overheard Bilbo talking about that hollow spot in Smaug's diamond waistcoat!",
      dmNotes:
        'His jeweled skeleton glows beneath the shallows of the Long Lake—no boatman dares row over where he fell. His sudden death triggered a gold rush across all Wilderland.',
      dndFields: {
        ancestry: 'Great Winged Fire-drake',
        classOrRole: 'Chiefest Calamity of the Age',
        alignment: 'Chaotic Evil',
        disposition: 'Deceased',
        ac: '22',
        hp: '546',
        voiceCue: 'Velvet, hypnotic purr backed by the roar of a furnace'
      }
    }
  },
  {
    id: 'node-men-laketown',
    type: 'entity',
    position: { x: 1915, y: 650 },
    data: {
      label: 'Men of Lake-town',
      entityType: 'Army / Host',
      shape: 'box',
      tags: ['five-armies', 'dale-parley'],
      statusIcons: ['Flag', 'Sword'],
      publicNotes:
        "**Army #2 of the Five Armies** — Able-bodied survivors of [[Ruins of Lake-town (Esgaroth)]] rallied by [[Bard the Bowman]], marching alongside [[Wood-elves of Mirkwood]] to seek winter relief from Smaug's hoard.",
      dmNotes:
        'Several hundred desperate militia armed with longbows, boat-hooks, and spears; fighting to keep their families from freezing before winter.',
      dndFields: {
        influence: 'Long Lake & Ruins of Dale',
        alignment: 'Lawful Neutral',
        headquarters: 'Siege Camp in Ruined Dale',
        goal: "Recover Girion's wealth to rebuild Esgaroth and Dale"
      }
    }
  },
  {
    id: 'node-laketown',
    type: 'entity',
    position: { x: 1915, y: 970 },
    data: {
      label: 'Ruins of Lake-town (Esgaroth)',
      entityType: 'Location',
      shape: 'oval',
      aliases: ['Lake-town', 'Esgaroth'],
      tags: ['dale-parley'],
      statusIcons: ['Flame', 'Anchor'],
      publicNotes:
        'Once a bustling timber trading town built on stilts over the Long Lake; reduced to charred pilings by [[Smaug the Golden]]. Elderly folk, women, and children huddle in lakeside tents aided by [[Wood-elves of Mirkwood]].',
      dmNotes:
        'Elven carpenters are already framing new huts on the shore while [[Master of Lake-town]] hoards emergency provisions for himself.',
      dndFields: {
        region: 'The Long Lake (Celduin)',
        locationType: 'Burned Lake Settlement',
        dangerTier: 'Harsh (Approaching Winter)'
      }
    }
  },
  {
    id: 'node-master-laketown',
    type: 'entity',
    position: { x: 1915, y: 1280 },
    data: {
      label: 'Master of Lake-town',
      entityType: 'NPC',
      shape: 'pill',
      stats: 'AC 11 | HP 22',
      statusIcons: ['Coins'],
      publicNotes:
        "Calculating merchant-magistrate of [[Ruins of Lake-town (Esgaroth)]]. Tried to flee in his gilded boat during [[Smaug the Golden]]'s attack, then redirected the crowd's anger toward [[Thorin & Company]] to save his own skin.",
      partyNotes:
        "Do NOT let any chest of gold pass directly into this man's hands—he only cares about tolls and saving his title from [[Bard the Bowman]].",
      dmNotes:
        'Already succumbing to dragon-sickness from afar; if given reconstruction gold after the battle, he will abscond into the wild and perish of starvation.',
      dndFields: {
        ancestry: 'Human (Lake-man)',
        classOrRole: 'Elected Magistrate',
        alignment: 'Neutral Evil',
        faction: 'Men of Lake-town',
        disposition: 'Suspicious',
        ac: '11',
        hp: '22',
        voiceCue: "Oily, politician's cadence; quick to flatter or shift blame"
      }
    }
  },

  // ============================================================================
  // COLUMN 6 (x = 2415) — DALE SIEGE CAMP & BILBO'S MIDNIGHT GAMBIT
  // ============================================================================
  {
    id: 'node-thranduil',
    type: 'entity',
    position: { x: 2415, y: 40 },
    data: {
      label: 'Thranduil (Elvenking)',
      entityType: 'NPC',
      shape: 'pill',
      aliases: ['Thranduil', 'Elvenking'],
      tags: ['dale-parley', 'five-armies'],
      stats: 'AC 18 | HP 152',
      statusIcons: ['Crown', 'TreePine'],
      publicNotes:
        "Golden-haired King of [[Wood-elves of Mirkwood]], crowned with autumn berries and red leaves. Aided [[Ruins of Lake-town (Esgaroth)]] in its hour of ruin and now commands the elven host alongside [[Bard the Bowman]], marveling at [[Bilbo Baggins]]'s midnight offer of [[The Arkenstone of Thráin]].",
      partyNotes:
        "Stern and fond of white gems, yet surprisingly gracious to Bilbo tonight—warned him gently not to return to Thorin's wrath.",
      dmNotes:
        'Despite ancient grudges over dwarven treasure, Thranduil states plainly: *"Long will I tarry, ere I begin this war for gold."* Will immediately pivot to fight [[Bolg of the North]] once Gandalf sounds the alarm.',
      dndFields: {
        ancestry: 'Sindarin Elf',
        classOrRole: 'King of the Woodland Realm',
        alignment: 'Chaotic Neutral',
        faction: 'Wood-elves of Mirkwood',
        disposition: 'Suspicious',
        ac: '18',
        hp: '152',
        voiceCue: 'Regal, cool, and musical; slow to anger over mere gold'
      }
    }
  },
  {
    id: 'node-bard',
    type: 'entity',
    position: { x: 2415, y: 330 },
    data: {
      label: 'Bard the Bowman',
      entityType: 'NPC',
      shape: 'box',
      aliases: ['Bard', 'Heir of Girion'],
      tags: ['dale-parley', 'five-armies'],
      baseScale: 1.06,
      stats: 'AC 17 | HP 92',
      statusIcons: ['Crosshair', 'Crown'],
      publicNotes:
        'Grim-voiced heir of Girion, Lord of Dale, who stood fast when others fled and slew [[Smaug the Golden]] with his ancestral Black Arrow. Leads [[Men of Lake-town]] at [[Siege of the Lonely Mountain]], demanding one-twelfth of the hoard—and now holds [[The Arkenstone of Thráin]] thanks to [[Bilbo Baggins]].',
      partyNotes:
        'Fair-minded and honorable; promised Bilbo the Arkenstone would be used strictly to bargain for peace rather than bloodshed.',
      dmNotes:
        "At dawn's parley, Bard will hold aloft [[The Arkenstone of Thráin]], forcing [[Thorin Oakenshield]] to promise a fourteenth share before [[Dáin Ironfoot]]'s arrival complicates the truce.",
      dndFields: {
        ancestry: 'Human (Heir of Dale)',
        classOrRole: 'Dragon-slayer & Captain',
        alignment: 'Lawful Good',
        faction: 'Men of Lake-town',
        disposition: 'Neutral',
        ac: '17',
        hp: '92',
        voiceCue: 'Somber, resonant bass; speaks plainly without boast'
      }
    }
  },
  {
    id: 'node-arkenstone',
    type: 'entity',
    position: { x: 2415, y: 650 },
    data: {
      label: 'The Arkenstone of Thráin',
      entityType: 'Item',
      shape: 'sticky',
      aliases: ['Arkenstone', 'Heart of the Mountain'],
      tags: ['dragon-hoard', 'dale-parley'],
      portrait: ARKENSTONE_TOKEN_ART,
      portraitMode: 'token',
      statusIcons: ['Gem', 'Sparkles'],
      publicNotes:
        '*The Heart of the Mountain* — Great globe-like multifaceted jewel shining with inner white fire dimmed by crimson and silver light. Secretly pocketed by [[Bilbo Baggins]] as his "fourteenth share" and handed at midnight to [[Bard the Bowman]] and [[Thranduil (Elvenking)]] to avert war.',
      partyNotes:
        'Thorin swore upon his beard to avenge anyone withholding this stone... morning parley at the Gate is going to be explosive!',
      dmNotes:
        "Ultimate diplomatic lever at [[Siege of the Lonely Mountain]]. Will eventually be laid upon [[Thorin Oakenshield]]'s breast in his tomb deep under [[The Lonely Mountain (Erebor)]].",
      dndFields: {
        rarity: 'Artifact',
        attunement: false,
        holder: 'Bard & Thranduil (Bargaining Chip)'
      }
    }
  },
  {
    id: 'node-bilbo',
    type: 'entity',
    position: { x: 2415, y: 1005 },
    data: {
      label: 'Bilbo Baggins',
      entityType: 'PC',
      shape: 'pill',
      aliases: ['Bilbo', 'Burglar', 'Ring-winner'],
      tags: ['thorins-company', 'dale-parley', 'ring-lore'],
      portrait: BILBO_TOKEN_ART,
      portraitMode: 'token',
      baseScale: 1.08,
      stats: 'AC 17 | HP 35',
      statusIcons: ['Footprints', 'Key'],
      publicNotes:
        'Resourceful Hobbit "Burglar" of [[Thorin & Company]]. Rescued his friends from spiders and elven dungeons, uncovered [[Smaug the Golden]]\'s weak spot, and crept down from [[The Lonely Mountain (Erebor)]] tonight wearing [[Bilbo\'s "Magic" Ring]] to trade [[The Arkenstone of Thráin]] for peace—earning praise from the newly returned [[Gandalf the Grey]].',
      partyNotes:
        "Climbed back up the rope to relieve Bombur's watch so [[Balin]] and the dwarves won't know what he did until morning!",
      dmNotes:
        'AC 17 reflects [[Sting & Mithril Mail-Coat]]. When [[Thorin Oakenshield]] discovers Bilbo gave away the Arkenstone, Thorin will nearly hurl him from the wall until [[Gandalf the Grey]] intervenes in full wizardly majesty.',
      dndFields: {
        ancestry: 'Hobbit (Baggins & Took)',
        classOrRole: 'Expert Burglar (Rogue 5)',
        alignment: 'Neutral Good',
        faction: 'Thorin & Company',
        disposition: 'Allied',
        ac: '17',
        hp: '35',
        voiceCue: 'Polite Westron manners mixed with plucky Tookish wit'
      }
    }
  },
  {
    id: 'node-ring',
    type: 'entity',
    position: { x: 2415, y: 1345 },
    data: {
      label: 'Bilbo\'s "Magic" Ring',
      entityType: 'Item',
      shape: 'sticky',
      aliases: ['Magic Ring', 'My Precious'],
      tags: ['ring-lore'],
      statusIcons: ['Eye', 'Sparkles'],
      publicNotes:
        "Plain golden ring found on the cold tunnel floor near [[Gollum]]'s lake, rendering [[Bilbo Baggins]] completely invisible save for a faint shadow in full noon sun.",
      partyNotes:
        'Kept secret from the dwarves until Mirkwood! Seems harmless enough, though Bilbo keeps fingering it inside his waistcoat pocket.',
      dmNotes:
        "DM SECRET: Truly **The One Ring** forged by [[The Necromancer (Dol Guldur)]] (Sauron)! [[Gandalf the Grey]] already harbors quiet unease about Bilbo's changing story of how [[Gollum]] parted with it.",
      dndFields: {
        rarity: 'Artifact',
        attunement: true,
        holder: 'Bilbo Baggins'
      }
    }
  },

  // ============================================================================
  // COLUMN 7 (x = 2925) — BEFORE THE GATE & NORTHERN THREAT
  // ============================================================================
  {
    id: 'node-bolg',
    type: 'entity',
    position: { x: 2925, y: -110 },
    data: {
      label: 'Bolg of the North',
      entityType: 'NPC',
      shape: 'box',
      isHidden: true,
      aliases: ['Bolg', 'Son of Azog'],
      tags: ['five-armies'],
      stats: 'AC 18 | HP 142',
      statusIcons: ['Skull', 'Sword'],
      publicNotes: 'Dread goblin warlord of Mount Gundabad in the far North.',
      dmNotes:
        'DM SECRET: Son of Azog; marching forced-march by night at the head of [[Goblins of the North]] and [[Wild Wargs of the North]] to avenge [[The Great Goblin]] and seize [[The Lonely Mountain (Erebor)]]. Surrounded by a bodyguard of huge steel-scimitared goblins.',
      dndFields: {
        ancestry: 'Great Northern Goblin',
        classOrRole: 'Warlord of Gundabad',
        alignment: 'Chaotic Evil',
        faction: 'Goblins of the North',
        disposition: 'Hostile',
        ac: '18',
        hp: '142',
        voiceCue: 'Iron-throated war-cry over clashing shields'
      }
    }
  },
  {
    id: 'node-siege',
    type: 'entity',
    position: { x: 2925, y: 260 },
    data: {
      label: 'Siege of the Lonely Mountain',
      entityType: 'Event',
      shape: 'box',
      tags: ['dale-parley', 'five-armies'],
      baseScale: 1.08,
      statusIcons: ['AlertTriangle', 'Scale'],
      publicNotes:
        'Bitter standoff before the walled-up Front Gate of [[The Lonely Mountain (Erebor)]]: [[Bard the Bowman]] and [[Thranduil (Elvenking)]] blockade the valley demanding aid for [[Ruins of Lake-town (Esgaroth)]], while [[Thorin Oakenshield]] refuses parley under arms and awaits [[Dáin Ironfoot]].',
      partyNotes:
        'Dawn parley is our last chance to prevent Elves, Men, and Dwarves from slaughtering one another at the gate!',
      dmNotes:
        'Just as [[Dáin Ironfoot]] prepares to attack the blockade to reach [[Thorin Oakenshield]], the sky will blacken with bats and [[Gandalf the Grey]] will halt the battle-lines: *"Halt! Dread has come upon you all! The Goblins are upon you!"*',
      dndFields: {
        questStatus: 'Active',
        sessionDate: 'Late Autumn — Eve of Battle'
      }
    }
  },
  {
    id: 'node-roac',
    type: 'entity',
    position: { x: 2925, y: 640 },
    data: {
      label: 'Roäc the Raven',
      entityType: 'NPC',
      shape: 'pill',
      stats: 'AC 13 | HP 18',
      statusIcons: ['Feather'],
      publicNotes:
        "153-year-old chief raven of Ravenhill (son of Carc), slow of wing and bald-headed, able to speak Westron with [[Thorin & Company]]. Brought first word of [[Smaug the Golden]]'s death, urged [[Thorin Oakenshield]] to trust [[Bard the Bowman]], and sent swift ravens to summon [[Dáin Ironfoot]].",
      dmNotes:
        'Wise voice of conscience: warned Thorin *"Treasure is likely to be your death, though the dragon is no more!"*',
      dndFields: {
        ancestry: 'Ancient Talking Raven',
        classOrRole: 'Chief Messenger of Ravenhill',
        alignment: 'Lawful Good',
        faction: 'Ravens of Ravenhill',
        disposition: 'Allied',
        ac: '13',
        hp: '18',
        voiceCue: 'Croaking, dignified, ancient courtly cadence'
      }
    }
  },
  {
    id: 'node-gandalf',
    type: 'entity',
    position: { x: 2925, y: 1005 },
    data: {
      label: 'Gandalf the Grey',
      entityType: 'NPC',
      shape: 'pill',
      aliases: ['Gandalf', 'Mithrandir', 'The Grey Pilgrim'],
      tags: ['thorins-company', 'white-council', 'five-armies'],
      portrait: GANDALF_TOKEN_ART,
      portraitMode: 'token',
      baseScale: 1.06,
      stats: 'AC 17 | HP 165',
      statusIcons: ['Wand2', 'Sparkles'],
      publicNotes:
        "Wandering Grey Pilgrim who launched the quest at [[Bag End (The Shire)]] and wields the elven blade *Glamdring*. Just revealed himself inside the Dale camp tonight, praising [[Bilbo Baggins]]'s courage with [[The Arkenstone of Thráin]] and hinting darkly that unpleasant news approaches.",
      partyNotes:
        'Finally back! Look at [[Where Did Gandalf Vanish To?]]—he told Bilbo *"There is an unpleasant time just in front of you"* with a very grave face.',
      dmNotes:
        "Returned from the White Council's expulsion of [[The Necromancer (Dol Guldur)]] and already suspects [[Bolg of the North]]'s northern muster. Will mediate between [[Thorin Oakenshield]], [[Bard the Bowman]], [[Thranduil (Elvenking)]], and [[Dáin Ironfoot]] the instant goblin horns sound.",
      dndFields: {
        ancestry: 'Istari (Wizard)',
        classOrRole: 'Grey Pilgrim & Strategist',
        alignment: 'Neutral Good',
        faction: 'White Council',
        disposition: 'Allied',
        ac: '17',
        hp: '165',
        voiceCue: 'Crackling authority softened by sudden, fond amusement'
      }
    }
  },
  {
    id: 'node-sting',
    type: 'entity',
    position: { x: 2925, y: 1345 },
    data: {
      label: 'Sting & Mithril Mail-Coat',
      entityType: 'Item',
      shape: 'sticky',
      aliases: ['Sting', 'Mithril Coat'],
      tags: ['dragon-hoard', 'thorins-company'],
      statusIcons: ['Sword', 'Shield'],
      publicNotes:
        'Gondolin-forged elven short-blade that shines cold blue whenever goblins draw near, paired with the corset of silvered *mithril* rings [[Thorin Oakenshield]] gifted [[Bilbo Baggins]] as first payment from [[The Lonely Mountain (Erebor)]].',
      partyNotes:
        "Keep an eye on Sting's blade—if it starts glowing blue near the Mountain, goblins are close!",
      dmNotes:
        "Foreshadowing cue! Have *Sting* flare bright blue inside Bilbo's scabbard moments before [[Goblins of the North]] round the northern spurs of Erebor.",
      dndFields: {
        rarity: 'Very Rare',
        attunement: false,
        holder: 'Bilbo Baggins'
      }
    }
  },

  // ============================================================================
  // COLUMN 8 (x = 3455) — THE LONELY MOUNTAIN (CARD BANNER!) & GOBLIN HOST
  // ============================================================================
  {
    id: 'node-goblins-north',
    type: 'entity',
    position: { x: 3455, y: -110 },
    data: {
      label: 'Goblins of the North',
      entityType: 'Army / Host',
      shape: 'box',
      isHidden: true,
      tags: ['five-armies'],
      statusIcons: ['AlertTriangle', 'Skull'],
      publicNotes: 'Unseen goblin legions gathering at Mount Gundabad.',
      dmNotes:
        'DM SECRET: **Army #4 of the Five Armies** — Countless Goblins of Mount Gundabad, the Grey Mountains, and the Misty Mountains marching beneath a sun-blotting cloud of giant bats under [[Bolg of the North]]!',
      dndFields: {
        influence: 'Mount Gundabad & Grey Mountains',
        alignment: 'Chaotic Evil',
        headquarters: 'Mount Gundabad',
        goal: "Avenge the Great Goblin and conquer Erebor's halls"
      }
    }
  },
  {
    id: 'node-thorin',
    type: 'entity',
    position: { x: 3455, y: 250 },
    data: {
      label: 'Thorin Oakenshield',
      entityType: 'PC',
      shape: 'box',
      aliases: ['Thorin', 'King under the Mountain'],
      tags: ['thorins-company', 'dragon-hoard', 'five-armies'],
      portrait: THORIN_TOKEN_ART,
      portraitMode: 'token',
      baseScale: 1.08,
      stats: 'AC 19 | HP 112',
      statusIcons: ['Crown', 'Coins'],
      publicNotes:
        'Self-proclaimed King under the Mountain, grandson of Thrór. Clad in royal mail inside [[The Lonely Mountain (Erebor)]], consumed by fierce dragon-sickness over the hoard and searching obsessively for [[The Arkenstone of Thráin]] while awaiting [[Dáin Ironfoot]].',
      partyNotes:
        'Refuses to part with a single coin while armed hosts camp in Dale; even [[Balin]] and [[Fíli & Kíli]] walk on eggshells around him right now.',
      dmNotes:
        'Though blinded by gold-lust tonight, the sight of [[Goblins of the North]] and [[Wild Wargs of the North]] overrunning Dale will break his madness—he will charge forth crying *"To me! O my kinsfolk!"* in a heroic final stand.',
      dndFields: {
        ancestry: 'Longbeard Dwarf',
        classOrRole: 'King under the Mountain (Fighter 9)',
        alignment: 'Lawful Neutral',
        faction: 'Thorin & Company',
        disposition: 'Suspicious',
        ac: '19',
        hp: '112',
        voiceCue: 'Haughty, resonant royal formality strained by sleepless obsession'
      }
    }
  },
  {
    id: 'node-erebor',
    type: 'entity',
    position: { x: 3455, y: 580 },
    data: {
      label: 'The Lonely Mountain (Erebor)',
      entityType: 'Location',
      shape: 'arch',
      aliases: ['Erebor', 'Lonely Mountain', 'The Lonely Mountain'],
      tags: ['dragon-hoard', 'five-armies'],
      portrait: EREBOR_BANNER_ART,
      portraitMode: 'card',
      baseScale: 1.06,
      statusIcons: ['Mountain', 'Castle'],
      publicNotes:
        "Isolated peak rising above Wilderland and the ruined valley of Dale, housing the vast halls of Thrór and [[Smaug the Golden]]'s uncounted golden hoard. [[Thorin & Company]] have masoned a dry-stone wall across the Great Gate with a water-channel defense.",
      dmNotes:
        'Two great rocky spurs extend south framing the valley of Dale—key high ground (especially Ravenhill on the southwest spur) for the coming Battle of Five Armies.',
      dndFields: {
        region: 'Northeast Wilderland',
        locationType: 'Dwarven Kingdom & Dragon Hoard',
        dangerTier: 'Extreme (Imminent Five-Army Battleground)'
      }
    }
  },
  {
    id: 'node-company',
    type: 'entity',
    position: { x: 3455, y: 1005 },
    data: {
      label: 'Thorin & Company',
      entityType: 'Organization',
      shape: 'box',
      tags: ['thorins-company', 'five-armies'],
      statusIcons: ['Shield', 'Users'],
      publicNotes:
        'The thirteen dwarven companions (*Thorin, Balin, Dwalin, Fíli, Kíli, Dori, Nori, Ori, Óin, Glóin, Bifur, Bofur, and Bombur*) fortified inside [[The Lonely Mountain (Erebor)]] alongside their burglar [[Bilbo Baggins]].',
      partyNotes:
        'Bombur was happy to let Bilbo take the chilly midnight watch on the gate-wall for a warm nap!',
      dmNotes:
        "Equipped in fine ancestral war-gear from Erebor's armories; several dwarves secretly wish Thorin would settle fairly with [[Bard the Bowman]] but will never betray their oath to Durin's heir.",
      dndFields: {
        influence: 'Gatehouse of Erebor',
        alignment: 'Lawful Good',
        headquarters: 'The Lonely Mountain (Erebor)',
        goal: 'Restore the Kingdom under the Mountain'
      }
    }
  },
  {
    id: 'node-balin',
    type: 'entity',
    position: { x: 3455, y: 1345 },
    data: {
      label: 'Balin',
      entityType: 'NPC',
      shape: 'pill',
      tags: ['thorins-company'],
      stats: 'AC 17 | HP 65',
      statusIcons: ['Users', 'Book'],
      publicNotes:
        'White-bearded elder statesman and keen-eyed lookout of [[Thorin & Company]]. Was the only dwarf willing to accompany [[Bilbo Baggins]] partway down the dark tunnel toward [[Smaug the Golden]].',
      partyNotes:
        "Bilbo's truest friend among the dwarves—quietly worried sick about [[Thorin Oakenshield]]'s mood.",
      dmNotes:
        'Will remain affectionate toward Bilbo no matter how angry Thorin grows tomorrow morning, and years later visits [[Bag End (The Shire)]] with Gandalf.',
      dndFields: {
        ancestry: 'Longbeard Dwarf',
        classOrRole: 'Elder Counselor & Watchman',
        alignment: 'Lawful Good',
        faction: 'Thorin & Company',
        disposition: 'Allied',
        ac: '17',
        hp: '65',
        voiceCue: 'Kindly, grandfatherly burr; thoughtful sigh before hard truths'
      }
    }
  },

  // ============================================================================
  // COLUMN 9 (x = 3985) — EASTERN FLANK, IRON HILLS & WILD WARGS
  // ============================================================================
  {
    id: 'node-wargs-north',
    type: 'entity',
    position: { x: 3985, y: -110 },
    data: {
      label: 'Wild Wargs of the North',
      entityType: 'Army / Host',
      shape: 'box',
      isHidden: true,
      tags: ['five-armies'],
      statusIcons: ['AlertTriangle', 'Flame'],
      publicNotes: 'Ferocious demonic wolf-packs of the northern wastes.',
      dmNotes:
        'DM SECRET: **Army #5 of the Five Armies** — Savage grey Wild Wolves allied with [[Goblins of the North]] under [[Bolg of the North]], bearing goblin riders and pack-leaders into the valley of Dale!',
      dndFields: {
        influence: 'Wilderland & Northern Wastes',
        alignment: 'Chaotic Evil',
        headquarters: 'Foothills of Gundabad',
        goal: 'Hunt down fleeing Men, Elves, and Dwarves alongside the goblins'
      }
    }
  },
  {
    id: 'node-dain',
    type: 'entity',
    position: { x: 3985, y: 250 },
    data: {
      label: 'Dáin Ironfoot',
      entityType: 'NPC',
      shape: 'box',
      aliases: ['Dain', 'Dain Ironfoot', 'Lord of the Iron Hills'],
      tags: ['five-armies'],
      stats: 'AC 19 | HP 135',
      statusIcons: ['Shield', 'Crown'],
      publicNotes:
        "Grim, veteran Lord of the Iron Hills and second cousin to [[Thorin Oakenshield]]. Answered [[Roäc the Raven]]'s summons at breakneck speed at the head of [[Dwarves of the Iron Hills]]—now less than a morning's march from [[The Lonely Mountain (Erebor)]].",
      dmNotes:
        "Fiery in war yet honorable and wise in peace: once [[Thorin Oakenshield]] falls, Dáin becomes King under the Mountain and honors Bilbo's fourteenth-share bargain with [[Bard the Bowman]].",
      dndFields: {
        ancestry: 'Longbeard Dwarf',
        classOrRole: 'Lord of the Iron Hills',
        alignment: 'Lawful Good',
        faction: 'Dwarves of the Iron Hills',
        disposition: 'Suspicious',
        ac: '19',
        hp: '135',
        voiceCue: "Blunt, ironclad soldier's bark; fiercely loyal to kin"
      }
    }
  },
  {
    id: 'node-iron-hills',
    type: 'entity',
    position: { x: 3985, y: 640 },
    data: {
      label: 'Dwarves of the Iron Hills',
      entityType: 'Army / Host',
      shape: 'box',
      tags: ['five-armies'],
      statusIcons: ['Shield', 'Sword'],
      publicNotes:
        '**Army #3 of the Five Armies** — Five hundred veteran dwarven heavy infantry led by [[Dáin Ironfoot]], clad in knee-length steel hauberks and bearing two-handed mattocks and broadswords after a forced march from the east.',
      dmNotes:
        'Arrive just after dawn parley; poised to clash with [[Men of Lake-town]] and [[Wood-elves of Mirkwood]] until [[Gandalf the Grey]] reveals [[Goblins of the North]] and [[Wild Wargs of the North]].',
      dndFields: {
        influence: 'Eastern Approaches to Erebor',
        alignment: 'Lawful Neutral',
        headquarters: 'The Iron Hills',
        goal: 'Break the siege and reinforce Thorin Oakenshield'
      }
    }
  },
  {
    id: 'node-fili-kili',
    type: 'entity',
    position: { x: 3985, y: 1005 },
    data: {
      label: 'Fíli & Kíli',
      entityType: 'NPC',
      shape: 'pill',
      aliases: ['Fili and Kili', 'Fili & Kili'],
      tags: ['thorins-company'],
      stats: 'AC 17 | HP 58',
      statusIcons: ['Sword'],
      publicNotes:
        'Youngest, sharpest-eyed nephews of [[Thorin Oakenshield]] in [[Thorin & Company]], golden-bearded violin players who scouted Ravenhill and helped [[Bilbo Baggins]] locate the hidden western door.',
      partyNotes: 'Always upbeat even in spider-webs or barrels—fiercely devoted to Uncle Thorin.',
      dmNotes:
        "Heirs presumptive to Thorin; during the climax against [[Bolg of the North]]'s bodyguard, both brothers will fight valiantly defending their fallen uncle with shield and body.",
      dndFields: {
        ancestry: 'Longbeard Dwarves',
        classOrRole: 'Royal Nephews & Outriders',
        alignment: 'Lawful Good',
        faction: 'Thorin & Company',
        disposition: 'Allied',
        ac: '17',
        hp: '58',
        voiceCue: 'Eager, energetic banter; quick laughter and fierce loyalty'
      }
    }
  }
]

export const STARTER_EDGES: DndEdge[] = [
  // ============================================================================
  // A. WEST-TO-EAST EXPEDITION JOURNEY TRAIL (Dotted Gold)
  // ============================================================================
  {
    id: 'edge-trail-1',
    type: 'dndEdge',
    source: 'node-bag-end',
    target: 'node-rivendell',
    sourceHandle: 'r',
    targetHandle: 'l',
    data: {
      label: 'East Road',
      preset: 'Journey / Trail',
      color: '#eab308',
      lineStyle: 'dotted',
      thickness: 2,
      direction: 'forward',
      publicNotes: 'First leg of the expedition from Hobbiton through the Trollshaws.'
    }
  },
  {
    id: 'edge-trail-2',
    type: 'dndEdge',
    source: 'node-rivendell',
    target: 'node-goblin-town',
    sourceHandle: 'r',
    targetHandle: 'l',
    data: {
      label: 'High Pass Storm',
      preset: 'Journey / Trail',
      color: '#eab308',
      lineStyle: 'dotted',
      thickness: 2,
      direction: 'forward',
      publicNotes: "Stone-giants in the thunder drove the Company into the goblins' front porch."
    }
  },
  {
    id: 'edge-trail-3',
    type: 'dndEdge',
    source: 'node-goblin-town',
    target: 'node-beorn',
    sourceHandle: 'tr',
    targetHandle: 'bl',
    data: {
      label: 'Carrock Crossing',
      preset: 'Journey / Trail',
      color: '#eab308',
      lineStyle: 'dotted',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-trail-4',
    type: 'dndEdge',
    source: 'node-beorn',
    target: 'node-mirkwood',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'To Forest Gate',
      preset: 'Journey / Trail',
      color: '#eab308',
      lineStyle: 'dotted',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-trail-5',
    type: 'dndEdge',
    source: 'node-mirkwood',
    target: 'node-laketown',
    sourceHandle: 'br',
    targetHandle: 'tl',
    data: {
      label: 'Barrels Out of Bond',
      preset: 'Journey / Trail',
      color: '#eab308',
      lineStyle: 'dotted',
      thickness: 2,
      direction: 'forward',
      publicNotes: 'Bilbo floated the dwarves down the Forest River into the Long Lake.',
      waypoints: [{ id: 'wp-trail-5', x: 1755, y: 865 }]
    }
  },
  {
    id: 'edge-trail-6',
    type: 'dndEdge',
    source: 'node-laketown',
    target: 'node-erebor',
    sourceHandle: 'tr',
    targetHandle: 'bl',
    data: {
      label: 'Up Running River',
      preset: 'Journey / Trail',
      color: '#eab308',
      lineStyle: 'dotted',
      thickness: 2,
      direction: 'forward',
      waypoints: [
        { id: 'wp-trail-6a', x: 2275, y: 855 },
        { id: 'wp-trail-6b', x: 2790, y: 830 },
        { id: 'wp-trail-6c', x: 3255, y: 780 }
      ],
      labelPos: { x: 42, y: -6 }
    }
  },

  // ============================================================================
  // B. SHIRE, RIVENDELL & MISTY MOUNTAINS
  // ============================================================================
  {
    id: 'edge-map-bagend',
    type: 'dndEdge',
    source: 'node-map',
    target: 'node-bag-end',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Unfurled at Party',
      preset: 'Possesses / Lore',
      color: '#64748b',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-elrond-map',
    type: 'dndEdge',
    source: 'node-elrond',
    target: 'node-map',
    sourceHandle: 'l',
    targetHandle: 'r',
    data: {
      label: 'Read Moon-letters',
      preset: 'Possesses / Lore',
      color: '#64748b',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward',
      publicNotes: '"Stand by the grey stone when the thrush knocks..."'
    }
  },
  {
    id: 'edge-elrond-rivendell',
    type: 'dndEdge',
    source: 'node-elrond',
    target: 'node-rivendell',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Master of',
      preset: 'Commands',
      color: '#ef4444',
      lineStyle: 'solid',
      thickness: 3,
      direction: 'forward'
    }
  },
  {
    id: 'edge-gg-goblintown',
    type: 'dndEdge',
    source: 'node-great-goblin',
    target: 'node-goblin-town',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Ruled (Slain)',
      preset: 'Commands',
      color: '#ef4444',
      lineStyle: 'solid',
      thickness: 3,
      direction: 'forward'
    }
  },
  {
    id: 'edge-gollum-goblintown',
    type: 'dndEdge',
    source: 'node-gollum',
    target: 'node-goblin-town',
    sourceHandle: 't',
    targetHandle: 'b',
    data: {
      label: 'Dark lake beneath',
      preset: 'Possesses / Lore',
      color: '#64748b',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-eagles-beorn',
    type: 'dndEdge',
    source: 'node-eagles',
    target: 'node-beorn',
    sourceHandle: 'r',
    targetHandle: 'tl',
    data: {
      label: 'Bore Company toward',
      preset: 'Allied',
      color: '#10b981',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-gollum-ring',
    type: 'dndEdge',
    source: 'node-gollum',
    target: 'node-ring',
    sourceHandle: 'b',
    targetHandle: 'bl',
    data: {
      label: "Lost 'My Precious'",
      preset: 'Seeking / Claiming',
      color: '#3b82f6',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward',
      publicNotes: 'Outwitted in the riddle-game beneath the Misty Mountains.',
      partyNotes: 'Gollum screamed "Thief! Baggins! We hates it forever!" as Bilbo fled invisible.',
      waypoints: [
        { id: 'wp-gollum-ring-1', x: 1240, y: 1535 },
        { id: 'wp-gollum-ring-2', x: 2150, y: 1535 }
      ],
      labelPos: { x: 235, y: 0 }
    }
  },

  // ============================================================================
  // C. MIRKWOOD, PLAYER THEORY & NECROMANCER SECRETS
  // ============================================================================
  {
    id: 'edge-mirkwood-elves',
    type: 'dndEdge',
    source: 'node-mirkwood',
    target: 'node-wood-elves',
    sourceHandle: 'tr',
    targetHandle: 'bl',
    data: {
      label: 'Home realm of',
      preset: 'Possesses / Lore',
      color: '#64748b',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward',
      waypoints: [{ id: 'wp-mirkwood-elves', x: 1755, y: 245 }]
    }
  },
  {
    id: 'edge-theory-mirkwood',
    type: 'dndEdge',
    source: 'node-theory-gandalf',
    target: 'node-mirkwood',
    sourceHandle: 't',
    targetHandle: 'b',
    data: {
      label: 'Parted ways at border',
      preset: 'Secret',
      color: '#8b5cf6',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      isPlayerCreated: true,
      partyNotes: 'Why ride south right when we needed our wizard most?'
    }
  },
  {
    id: 'edge-ring-necromancer',
    type: 'dndEdge',
    source: 'node-ring',
    target: 'node-necromancer',
    sourceHandle: 'bl',
    targetHandle: 'br',
    data: {
      label: 'The One Ring of Power',
      preset: 'Secret',
      color: '#8b5cf6',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      isHidden: true,
      dmNotes:
        "Bound to the Dark Lord's spirit; slipped off Gollum's finger seeking a way back into the world.",
      waypoints: [{ id: 'wp-ring-necro', x: 2050, y: 1455 }]
    }
  },
  {
    id: 'edge-gandalf-necromancer',
    type: 'dndEdge',
    source: 'node-gandalf',
    target: 'node-necromancer',
    sourceHandle: 'bl',
    targetHandle: 'b',
    data: {
      label: 'White Council Assault',
      preset: 'Enemies / Siege',
      color: '#ef4444',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      isHidden: true,
      dmNotes: 'Gandalf, Elrond, Galadriel, and Saruman drove the Necromancer out of Dol Guldur.',
      waypoints: [
        { id: 'wp-gandalf-necro-1', x: 2740, y: 1655 },
        { id: 'wp-gandalf-necro-2', x: 1760, y: 1655 }
      ],
      labelPos: { x: 60, y: 0 }
    }
  },

  // ============================================================================
  // D. LAKE-TOWN, SMAUG & THE DALE PARLEY
  // ============================================================================
  {
    id: 'edge-thranduil-elves',
    type: 'dndEdge',
    source: 'node-thranduil',
    target: 'node-wood-elves',
    sourceHandle: 'l',
    targetHandle: 'r',
    data: {
      label: 'Commands Army #1',
      preset: 'Commands',
      color: '#ef4444',
      lineStyle: 'solid',
      thickness: 3,
      direction: 'forward'
    }
  },
  {
    id: 'edge-thranduil-bard',
    type: 'dndEdge',
    source: 'node-thranduil',
    target: 'node-bard',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Allied in Dale camp',
      preset: 'Allied',
      color: '#10b981',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'none'
    }
  },
  {
    id: 'edge-bard-smaug',
    type: 'dndEdge',
    source: 'node-bard',
    target: 'node-smaug',
    sourceHandle: 'l',
    targetHandle: 'r',
    data: {
      label: 'Slew with Black Arrow',
      preset: 'Enemies / Siege',
      color: '#ef4444',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      publicNotes: "Guided by the old thrush to the hollow above Smaug's left breast."
    }
  },
  {
    id: 'edge-smaug-laketown',
    type: 'dndEdge',
    source: 'node-smaug',
    target: 'node-laketown',
    sourceHandle: 'br',
    targetHandle: 'tr',
    data: {
      label: 'Burned in Dragon-fire',
      preset: 'Enemies / Siege',
      color: '#ef4444',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      waypoints: [{ id: 'wp-smaug-lake', x: 2265, y: 755 }]
    }
  },
  {
    id: 'edge-bard-men',
    type: 'dndEdge',
    source: 'node-bard',
    target: 'node-men-laketown',
    sourceHandle: 'bl',
    targetHandle: 'tr',
    data: {
      label: 'Leads Army #2',
      preset: 'Commands',
      color: '#ef4444',
      lineStyle: 'solid',
      thickness: 3,
      direction: 'forward',
      waypoints: [{ id: 'wp-bard-men', x: 2275, y: 545 }]
    }
  },
  {
    id: 'edge-men-laketown-home',
    type: 'dndEdge',
    source: 'node-men-laketown',
    target: 'node-laketown',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Survivors of',
      preset: 'Possesses / Lore',
      color: '#64748b',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-master-laketown',
    type: 'dndEdge',
    source: 'node-master-laketown',
    target: 'node-laketown',
    sourceHandle: 't',
    targetHandle: 'b',
    data: {
      label: 'Clings to office in',
      preset: 'Commands',
      color: '#ef4444',
      lineStyle: 'solid',
      thickness: 3,
      direction: 'forward',
      partyNotes: 'Tried to row away with his gold while Bard defended the bridges!'
    }
  },
  {
    id: 'edge-bilbo-arkenstone',
    type: 'dndEdge',
    source: 'node-bilbo',
    target: 'node-arkenstone',
    sourceHandle: 't',
    targetHandle: 'b',
    data: {
      label: 'Midnight Handoff',
      preset: 'Secret',
      color: '#8b5cf6',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      publicNotes:
        'Slipped down a rope from the Front Gate invisible to offer his fourteenth share for peace.',
      partyNotes: 'Riskiest—and noblest—burglary of the entire campaign!',
      labelPos: { x: 0, y: 32 }
    }
  },
  {
    id: 'edge-arkenstone-bard',
    type: 'dndEdge',
    source: 'node-arkenstone',
    target: 'node-bard',
    sourceHandle: 't',
    targetHandle: 'b',
    data: {
      label: 'Held as Truce Lever',
      preset: 'Secret',
      color: '#8b5cf6',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-bilbo-ring',
    type: 'dndEdge',
    source: 'node-bilbo',
    target: 'node-ring',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Wears for invisibility',
      preset: 'Possesses / Lore',
      color: '#64748b',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-bilbo-sting',
    type: 'dndEdge',
    source: 'node-bilbo',
    target: 'node-sting',
    sourceHandle: 'br',
    targetHandle: 'tl',
    data: {
      label: 'Bears blade & Mithril',
      preset: 'Possesses / Lore',
      color: '#64748b',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-bilbo-gandalf',
    type: 'dndEdge',
    source: 'node-gandalf',
    target: 'node-bilbo',
    sourceHandle: 'l',
    targetHandle: 'r',
    data: {
      label: "'Well done, Mr. Baggins!'",
      preset: 'Allied',
      color: '#10b981',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'none'
    }
  },

  // ============================================================================
  // E. THE LONELY MOUNTAIN, SIEGE, IRON HILLS & EDGE-TO-LABEL SHOWCASE
  // ============================================================================
  {
    id: 'edge-thranduil-siege',
    type: 'dndEdge',
    source: 'node-thranduil',
    target: 'node-siege',
    sourceHandle: 'r',
    targetHandle: 'tl',
    data: {
      label: 'Encamped at Gate',
      preset: 'Enemies / Siege',
      color: '#ef4444',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      waypoints: [{ id: 'wp-thranduil-siege', x: 2770, y: 155 }]
    }
  },
  {
    id: 'edge-bard-siege',
    type: 'dndEdge',
    source: 'node-bard',
    target: 'node-siege',
    sourceHandle: 'r',
    targetHandle: 'l',
    data: {
      label: 'Demands 1/12th share',
      preset: 'Seeking / Claiming',
      color: '#3b82f6',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-siege-thorin',
    type: 'dndEdge',
    source: 'node-siege',
    target: 'node-thorin',
    sourceHandle: 'r',
    targetHandle: 'l',
    data: {
      label: 'Armed Parley Standoff',
      preset: 'Enemies / Siege',
      color: '#ef4444',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'bidirectional',
      publicNotes:
        'Thorin refuses to bargain while armed hosts camp at his gate; Bard refuses to withdraw while Lake-men starve.'
    }
  },
  {
    id: 'edge-thorin-erebor',
    type: 'dndEdge',
    source: 'node-thorin',
    target: 'node-erebor',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Fortified Front Gate',
      preset: 'Commands',
      color: '#ef4444',
      lineStyle: 'solid',
      thickness: 3,
      direction: 'forward'
    }
  },
  {
    id: 'edge-siege-proxy-gate',
    type: 'dndEdge',
    source: 'node-siege',
    target: 'proxy-edge-thorin-erebor',
    sourceHandle: 'br',
    targetHandle: 'target',
    data: {
      label: 'Blockading',
      preset: 'Enemies / Siege',
      color: '#ef4444',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      labelPos: { x: -22, y: 0 },
      publicNotes:
        "Edge-to-Label link: Men and Wood-elves have sealed the valley directly against Thorin's fortified gate."
    }
  },
  {
    id: 'edge-roac-erebor',
    type: 'dndEdge',
    source: 'node-roac',
    target: 'node-erebor',
    sourceHandle: 'r',
    targetHandle: 'l',
    data: {
      label: 'Ravenhill counselor to',
      preset: 'Allied',
      color: '#10b981',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-thorin-dain',
    type: 'dndEdge',
    source: 'node-thorin',
    target: 'node-dain',
    sourceHandle: 'r',
    targetHandle: 'l',
    data: {
      label: 'Summoned via Roäc',
      preset: 'Allied',
      color: '#10b981',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-dain-ironhills',
    type: 'dndEdge',
    source: 'node-dain',
    target: 'node-iron-hills',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Commands Army #3',
      preset: 'Commands',
      color: '#ef4444',
      lineStyle: 'solid',
      thickness: 3,
      direction: 'forward'
    }
  },
  {
    id: 'edge-ironhills-erebor',
    type: 'dndEdge',
    source: 'node-iron-hills',
    target: 'node-erebor',
    sourceHandle: 'l',
    targetHandle: 'r',
    data: {
      label: 'Forced march to relieve',
      preset: 'Seeking / Claiming',
      color: '#3b82f6',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-company-erebor',
    type: 'dndEdge',
    source: 'node-company',
    target: 'node-erebor',
    sourceHandle: 't',
    targetHandle: 'b',
    data: {
      label: 'Holding Gatehouse',
      preset: 'Allied',
      color: '#10b981',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-gandalf-company',
    type: 'dndEdge',
    source: 'node-gandalf',
    target: 'node-company',
    sourceHandle: 'r',
    targetHandle: 'l',
    data: {
      label: 'Patron & Guide',
      preset: 'Allied',
      color: '#10b981',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-company-sting',
    type: 'dndEdge',
    source: 'node-company',
    target: 'node-sting',
    sourceHandle: 'bl',
    targetHandle: 'tr',
    data: {
      label: 'Gifted Mithril coat',
      preset: 'Possesses / Lore',
      color: '#64748b',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'forward'
    }
  },
  {
    id: 'edge-balin-company',
    type: 'dndEdge',
    source: 'node-balin',
    target: 'node-company',
    sourceHandle: 't',
    targetHandle: 'b',
    data: {
      label: 'Elder watchman of',
      preset: 'Allied',
      color: '#10b981',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'none'
    }
  },
  {
    id: 'edge-filikili-company',
    type: 'dndEdge',
    source: 'node-fili-kili',
    target: 'node-company',
    sourceHandle: 'l',
    targetHandle: 'r',
    data: {
      label: 'Vanguard scouts of',
      preset: 'Allied',
      color: '#10b981',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'none'
    }
  },

  // ============================================================================
  // F. DM-HIDDEN NORTHERN AMBUSH (Armies #4 & #5 — Vanish in Player View!)
  // ============================================================================
  {
    id: 'edge-bolg-goblins',
    type: 'dndEdge',
    source: 'node-bolg',
    target: 'node-goblins-north',
    sourceHandle: 'r',
    targetHandle: 'l',
    data: {
      label: 'Commands Army #4',
      preset: 'Commands',
      color: '#ef4444',
      lineStyle: 'solid',
      thickness: 3,
      direction: 'forward',
      isHidden: true,
      dmNotes: 'Gundabad & Misty Mountain goblin legions marching forced-march by night.'
    }
  },
  {
    id: 'edge-goblins-wargs',
    type: 'dndEdge',
    source: 'node-goblins-north',
    target: 'node-wargs-north',
    sourceHandle: 'r',
    targetHandle: 'l',
    data: {
      label: 'Allied Pack (Army #5)',
      preset: 'Allied',
      color: '#10b981',
      lineStyle: 'solid',
      thickness: 2,
      direction: 'bidirectional',
      isHidden: true,
      dmNotes: 'Goblins and Wild Wargs form the fourth and fifth armies of the coming battle.'
    }
  },
  {
    id: 'edge-bolg-siege',
    type: 'dndEdge',
    source: 'node-bolg',
    target: 'node-siege',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Descending unseen upon',
      preset: 'Enemies / Siege',
      color: '#ef4444',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      isHidden: true,
      dmNotes: 'Will force Bard, Thranduil, and Dáin to unite at the last possible moment!'
    }
  },
  {
    id: 'edge-goblins-thorin',
    type: 'dndEdge',
    source: 'node-goblins-north',
    target: 'node-thorin',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Closing in under bat-cloud',
      preset: 'Enemies / Siege',
      color: '#ef4444',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      isHidden: true
    }
  },
  {
    id: 'edge-wargs-dain',
    type: 'dndEdge',
    source: 'node-wargs-north',
    target: 'node-dain',
    sourceHandle: 'b',
    targetHandle: 't',
    data: {
      label: 'Flanking from North',
      preset: 'Enemies / Siege',
      color: '#ef4444',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      isHidden: true
    }
  },
  {
    id: 'edge-eagles-bolg',
    type: 'dndEdge',
    source: 'node-eagles',
    target: 'node-bolg',
    sourceHandle: 'tr',
    targetHandle: 'tl',
    data: {
      label: 'Spotted northern muster',
      preset: 'Secret',
      color: '#8b5cf6',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      isHidden: true,
      dmNotes: "Eagles will arrive from the West alongside Beorn at the battle's darkest hour.",
      waypoints: [{ id: 'wp-eagles-bolg', x: 1960, y: -165 }]
    }
  },
  {
    id: 'edge-beorn-bolg',
    type: 'dndEdge',
    source: 'node-beorn',
    target: 'node-bolg',
    sourceHandle: 'tr',
    targetHandle: 'tl',
    data: {
      label: 'Tracking in bear-form',
      preset: 'Secret',
      color: '#8b5cf6',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'forward',
      isHidden: true,
      dmNotes: 'Beorn will carry the mortally wounded Thorin out of the fray and crush Bolg himself.',
      waypoints: [
        { id: 'wp-beorn-bolg-1', x: 1755, y: -70 },
        { id: 'wp-beorn-bolg-2', x: 2415, y: -90 }
      ]
    }
  }
]

// ============================================================================
// 4 CHRONOLOGICAL CAMPAIGN TIMELINE SNAPSHOTS ("TIME MACHINE")
// ============================================================================
function buildSnapshotSubset(
  allowedNodeIds: Set<string>,
  nodeOverrides: Record<string, (node: DndNode) => DndNode> = {},
  extraEdges: DndEdge[] = [],
  excludedEdgeIds: Set<string> = new Set()
): { nodes: DndNode[]; edges: DndEdge[] } {
  const nodes = STARTER_NODES.filter((n) => allowedNodeIds.has(n.id)).map((n) =>
    nodeOverrides[n.id] ? nodeOverrides[n.id](n) : n
  )

  const candidateEdges = [
    ...STARTER_EDGES.filter((e) => !excludedEdgeIds.has(e.id)),
    ...extraEdges
  ]
  const validIds = new Set<string>(allowedNodeIds)
  const keptEdges: DndEdge[] = []

  let added = true
  while (added) {
    added = false
    for (const e of candidateEdges) {
      if (validIds.has(`proxy-${e.id}`)) continue
      if (validIds.has(e.source) && validIds.has(e.target)) {
        keptEdges.push(e)
        validIds.add(`proxy-${e.id}`)
        added = true
      }
    }
  }

  return { nodes, edges: keptEdges }
}

const earlyThorinCompanyEdge: DndEdge = {
  id: 'edge-early-thorin-company',
  type: 'dndEdge',
  source: 'node-thorin',
  target: 'node-company',
  sourceHandle: 'b',
  targetHandle: 't',
  data: {
    label: 'Leads Expedition',
    preset: 'Commands',
    color: '#ef4444',
    lineStyle: 'solid',
    thickness: 3,
    direction: 'forward'
  }
}

const earlyRivendellCampEdge: DndEdge = {
  id: 'edge-early-rivendell-gandalf',
  type: 'dndEdge',
  source: 'node-rivendell',
  target: 'node-gandalf',
  sourceHandle: 'br',
  targetHandle: 'bl',
  data: {
    label: 'Council at Midsummer',
    preset: 'Allied',
    color: '#10b981',
    lineStyle: 'solid',
    thickness: 2,
    direction: 'none',
    waypoints: [{ id: 'wp-s1-riv-gan', x: 1750, y: 1180 }]
  }
}

const session1Ids = new Set([
  'node-bag-end',
  'node-map',
  'node-rivendell',
  'node-elrond',
  'node-bilbo',
  'node-gandalf',
  'node-thorin',
  'node-company',
  'node-balin',
  'node-fili-kili',
  'node-sting'
])

const session1 = buildSnapshotSubset(
  session1Ids,
  {
    'node-bilbo': (n) => ({
      ...n,
      data: {
        ...n.data,
        stats: 'AC 14 | HP 24',
        statusIcons: ['Footprints'],
        publicNotes:
          'Reluctant Hobbit of [[Bag End (The Shire)]] recruited as "Burglar" for [[Thorin & Company]]. Survived the Trollshaws and now rests in [[Rivendell (Last Homely House)]].',
        partyNotes:
          'Still misses his pocket-handkerchiefs, but found a fine elven dagger in the troll cave!'
      }
    }),
    'node-thorin': (n) => ({
      ...n,
      data: {
        ...n.data,
        statusIcons: ['Crown', 'Sword'],
        publicNotes:
          "Determined Dwarf-prince in exile leading [[Thorin & Company]] east with [[Thrór's Map & Silver Key]], newly aided by [[Elrond]]'s Moon-letter lore.",
        partyNotes: 'Stern and proud, yet deeply grateful to Elrond and Gandalf.',
        dndFields: { ...n.data.dndFields, disposition: 'Allied' }
      }
    }),
    'node-sting': (n) => ({
      ...n,
      data: {
        ...n.data,
        label: 'Sting (Troll-hoard Blade)',
        statusIcons: ['Sword'],
        publicNotes:
          "Elven short-blade recovered from the Three Trolls' hoard on the East Road and claimed by [[Bilbo Baggins]].",
        dndFields: { ...n.data.dndFields, rarity: 'Rare' }
      }
    }),
    'node-gandalf': (n) => ({
      ...n,
      data: {
        ...n.data,
        publicNotes:
          'Grey Wizard guiding [[Thorin & Company]] from [[Bag End (The Shire)]] to [[Rivendell (Last Homely House)]] after turning three stone-trolls to rock at dawn.'
      }
    })
  },
  [earlyThorinCompanyEdge, earlyRivendellCampEdge],
  new Set(['edge-company-sting'])
)

const session2Ids = new Set([
  ...session1Ids,
  'node-goblin-town',
  'node-great-goblin',
  'node-gollum',
  'node-ring',
  'node-eagles',
  'node-beorn',
  'node-necromancer'
])

const session2 = buildSnapshotSubset(
  session2Ids,
  {
    'node-bilbo': (n) => ({
      ...n,
      data: {
        ...n.data,
        stats: 'AC 15 | HP 28',
        publicNotes:
          'Escaped [[Gollum]]\'s subterranean lake using [[Bilbo\'s "Magic" Ring]] and earned the respect of [[Thorin & Company]] before [[The Great Eagles]] carried the party toward [[Beorn]]\'s hall.'
      }
    }),
    'node-thorin': (n) => ({
      ...n,
      data: {
        ...n.data,
        statusIcons: ['Crown', 'Sword'],
        dndFields: { ...n.data.dndFields, disposition: 'Allied' }
      }
    }),
    'node-sting': (n) => ({
      ...n,
      data: {
        ...n.data,
        label: 'Sting (Elven Blade)',
        statusIcons: ['Sword'],
        dndFields: { ...n.data.dndFields, rarity: 'Rare' }
      }
    }),
    'node-gandalf': (n) => ({
      ...n,
      data: {
        ...n.data,
        publicNotes:
          'Slew [[The Great Goblin]] beneath the Misty Mountains and introduced the Company to [[Beorn]], warning he must soon ride south on urgent business.'
      }
    })
  },
  [
    earlyThorinCompanyEdge,
    {
      id: 'edge-s2-beorn-gandalf',
      type: 'dndEdge',
      source: 'node-beorn',
      target: 'node-gandalf',
      sourceHandle: 'r',
      targetHandle: 'tl',
      data: {
        label: 'Hosted party at Oak Hall',
        preset: 'Allied',
        color: '#10b981',
        lineStyle: 'solid',
        thickness: 2,
        direction: 'forward',
        waypoints: [{ id: 'wp-s2-beorn-gan', x: 2300, y: 495 }]
      }
    }
  ],
  new Set(['edge-company-sting', 'edge-gandalf-necromancer'])
)

const session3Ids = new Set([
  ...session2Ids,
  'node-mirkwood',
  'node-theory-gandalf',
  'node-wood-elves',
  'node-thranduil',
  'node-laketown',
  'node-master-laketown',
  'node-bard',
  'node-erebor',
  'node-smaug'
])

const session3 = buildSnapshotSubset(
  session3Ids,
  {
    'node-smaug': (n) => ({
      ...n,
      data: {
        ...n.data,
        statusIcons: ['Flame', 'Eye'],
        publicNotes:
          'Colossal golden-red dragon brooding atop the treasure of [[The Lonely Mountain (Erebor)]]! Stirred to fury after [[Bilbo Baggins]] crept down the secret passage.',
        partyNotes:
          'Bilbo spotted a single unarmored hollow under his left breast—how do we ever reach it?!',
        dndFields: { ...n.data.dndFields, disposition: 'Hostile' }
      }
    }),
    'node-laketown': (n) => ({
      ...n,
      data: {
        ...n.data,
        label: 'Lake-town (Esgaroth)',
        statusIcons: ['Anchor', 'Coins'],
        publicNotes:
          'Prosperous wooden trading town upon the Long Lake that welcomed [[Thorin & Company]] with songs of the returning King under the Mountain.',
        dndFields: {
          ...n.data.dndFields,
          locationType: 'Stilt-built Lake Port',
          dangerTier: 'Low (Festive)'
        }
      }
    }),
    'node-bard': (n) => ({
      ...n,
      data: {
        ...n.data,
        statusIcons: ['Crosshair'],
        publicNotes:
          'Watchful captain of archers in [[Lake-town (Esgaroth)]] descended from Girion of Dale; wary of waking the dragon.'
      }
    }),
    'node-thorin': (n) => ({
      ...n,
      data: {
        ...n.data,
        statusIcons: ['Crown'],
        publicNotes:
          "Unlocked the secret western door of [[The Lonely Mountain (Erebor)]] on Durin's Day and sent [[Bilbo Baggins]] down into [[Smaug the Golden]]'s lair.",
        dndFields: { ...n.data.dndFields, disposition: 'Allied' }
      }
    }),
    'node-gandalf': (n) => ({
      ...n,
      data: {
        ...n.data,
        statusIcons: ['HelpCircle', 'Wand2'],
        publicNotes:
          "Still missing in the South since parting at the edge of [[Mirkwood & Elvenking's Halls]]."
      }
    })
  },
  [
    {
      id: 'edge-s3-bard-laketown',
      type: 'dndEdge',
      source: 'node-bard',
      target: 'node-laketown',
      sourceHandle: 'bl',
      targetHandle: 'tr',
      data: {
        label: 'Captain of Archers in',
        preset: 'Allied',
        color: '#10b981',
        lineStyle: 'solid',
        thickness: 2,
        direction: 'forward',
        waypoints: [{ id: 'wp-s3-bard-lake', x: 2265, y: 740 }]
      }
    },
    {
      id: 'edge-s3-smaug-erebor',
      type: 'dndEdge',
      source: 'node-smaug',
      target: 'node-erebor',
      sourceHandle: 'r',
      targetHandle: 'tl',
      data: {
        label: 'Brooding over hoard in',
        preset: 'Commands',
        color: '#ef4444',
        lineStyle: 'solid',
        thickness: 3,
        direction: 'forward',
        waypoints: [
          { id: 'wp-s3-smaug-erebor-1', x: 2415, y: 215 },
          { id: 'wp-s3-smaug-erebor-2', x: 3060, y: 470 }
        ]
      }
    }
  ],
  new Set([
    'edge-bard-smaug',
    'edge-smaug-laketown',
    'edge-thranduil-bard',
    'edge-company-sting',
    'edge-bilbo-gandalf'
  ])
)

const session4Ids = new Set([
  ...session3Ids,
  'node-men-laketown',
  'node-roac',
  'node-arkenstone'
])

const session4 = buildSnapshotSubset(
  session4Ids,
  {
    'node-arkenstone': (n) => ({
      ...n,
      data: {
        ...n.data,
        publicNotes:
          '*The Heart of the Mountain* — Discovered atop the dark treasure-mound by [[Bilbo Baggins]] and secretly tucked inside his rolled-up pillow.',
        partyNotes: "Bilbo hasn't dared tell [[Thorin Oakenshield]] he has it!",
        dndFields: { ...n.data.dndFields, holder: 'Bilbo Baggins (Hidden in Pocket)' }
      }
    }),
    'node-gandalf': (n) => ({
      ...n,
      data: {
        ...n.data,
        statusIcons: ['HelpCircle', 'Wand2'],
        publicNotes:
          'Whereabouts still unknown while [[Men of Lake-town]] and [[Wood-elves of Mirkwood]] march north toward Erebor.'
      }
    })
  },
  [],
  new Set(['edge-arkenstone-bard', 'edge-bilbo-gandalf'])
)

export const STARTER_SNAPSHOTS: CampaignSnapshot[] = [
  {
    id: 'snap-session-1',
    title: 'An Unexpected Party & Rivendell',
    sessionNumber: 1,
    createdAt: '2026-10-04T20:00:00.000Z',
    summary:
      "Gandalf and thirteen dwarves recruited Bilbo at Bag End, survived the Three Trolls with Sting, and learned the Moon-letter secret of Thrór's Map from Elrond in Rivendell.",
    playerVisible: true,
    nodes: session1.nodes,
    edges: session1.edges
  },
  {
    id: 'snap-session-2',
    title: 'Over Hill and Under Hill',
    sessionNumber: 2,
    createdAt: '2026-10-11T20:00:00.000Z',
    summary:
      "Captured in Goblin-town! Gandalf slew the Great Goblin, Bilbo won a riddle-game against Gollum and escaped with a mysterious golden ring, and the Great Eagles bore the party toward Beorn's hall.",
    playerVisible: true,
    nodes: session2.nodes,
    edges: session2.edges
  },
  {
    id: 'snap-session-3',
    title: 'Barrels Out of Bond & Doorstep of Erebor',
    sessionNumber: 3,
    createdAt: '2026-10-18T20:00:00.000Z',
    summary:
      "Gandalf rode south while Bilbo freed the dwarves from giant spiders and Thranduil's dungeons in barrels, reached Lake-town, unlocked Erebor's hidden door on Durin's Day, and woke Smaug the Golden!",
    playerVisible: true,
    nodes: session3.nodes,
    edges: session3.edges
  },
  {
    id: 'snap-session-4',
    title: 'Fire and Water — Fall of Smaug',
    sessionNumber: 4,
    createdAt: '2026-10-25T20:00:00.000Z',
    summary:
      "Smaug burned Lake-town in wrath before falling to Bard's Black Arrow! Roäc brought tidings to Erebor, Bilbo hid the Arkenstone, and dragon-sickness gripped Thorin as survivors marched on the Mountain.",
    playerVisible: true,
    nodes: session4.nodes,
    edges: session4.edges
  }
]
