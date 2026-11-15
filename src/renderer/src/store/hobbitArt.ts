function toSvgDataUri(svg: string): string {
  const clean = svg.trim().replace(/\s+/g, ' ')
  const bytes = new TextEncoder().encode(clean)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : (globalThis as any).Buffer.from(clean, 'utf8').toString('base64')
  return `data:image/svg+xml;base64,${b64}`
}

/**
 * Card Banner Art (360x150) — The Lonely Mountain (Erebor)
 * Inspired by J.R.R. Tolkien's woodcut & dust-jacket mountain illustrations.
 */
export const EREBOR_BANNER_ART = toSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 150">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b263b"/>
      <stop offset="58%" stop-color="#5c3d2e"/>
      <stop offset="100%" stop-color="#e09f3e"/>
    </linearGradient>
    <linearGradient id="mtn" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3d352e"/>
      <stop offset="100%" stop-color="#1d1916"/>
    </linearGradient>
    <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffd166"/>
      <stop offset="100%" stop-color="#b5651d"/>
    </linearGradient>
  </defs>
  <rect width="360" height="150" fill="url(#sky)"/>
  <!-- Crescent Moon & Stars -->
  <path d="M58 24a11 11 0 1 0 11 15 9 9 0 1 1-11-15z" fill="#f8edeb" opacity="0.9"/>
  <circle cx="98" cy="22" r="1.3" fill="#fff"/>
  <circle cx="288" cy="20" r="1.5" fill="#fff"/>
  <circle cx="316" cy="34" r="1.1" fill="#fff"/>
  <!-- Plume of Smoke from Peak -->
  <path d="M180 24c16-10 38-8 56-14 18-5 34 2 48-4-14 12-35 10-52 15-19 5-35 2-52 10z" fill="#2b211e" opacity="0.55"/>
  <!-- Distant Spurs -->
  <polygon points="15,132 95,68 155,132" fill="#2c2520"/>
  <polygon points="205,132 272,64 348,132" fill="#28211c"/>
  <!-- Central Peak of Erebor -->
  <polygon points="68,136 180,22 292,136" fill="url(#mtn)" stroke="#14110f" stroke-width="2"/>
  <!-- Snow & Illuminated Western Ridge -->
  <polygon points="180,22 146,57 166,64 180,46 196,63 212,55" fill="#f4ebd9" opacity="0.9"/>
  <path d="M180 22 L152 136" stroke="#c89f65" stroke-width="1.2" opacity="0.45"/>
  <!-- Fortified Great Gate & Glowing Arch -->
  <polygon points="160,136 168,104 192,104 200,136" fill="#4a3f35" stroke="#e09f3e" stroke-width="1.2"/>
  <path d="M173 136v-15a7 7 0 0 1 14 0v15z" fill="#ffb703"/>
  <!-- Foreground Valley & Running River -->
  <rect y="132" width="360" height="18" fill="#1b1612"/>
  <path d="M175 134c-6 5-24 8-30 16h34c4-6 14-10 10-16z" fill="url(#river)"/>
</svg>
`)

/**
 * Card Banner Art (360x150) — Smaug the Golden
 * Crimson-gold fire-drake coiled above the gleaming hoard of Erebor.
 */
export const SMAUG_BANNER_ART = toSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 150">
  <defs>
    <radialGradient id="hoardGlow" cx="50%" cy="78%" r="62%">
      <stop offset="0%" stop-color="#ffb703"/>
      <stop offset="48%" stop-color="#9b2226"/>
      <stop offset="100%" stop-color="#191110"/>
    </radialGradient>
    <linearGradient id="wyrm" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#780000"/>
      <stop offset="50%" stop-color="#c1121f"/>
      <stop offset="100%" stop-color="#ee9b00"/>
    </linearGradient>
  </defs>
  <rect width="360" height="150" fill="url(#hoardGlow)"/>
  <!-- Dwarven Hall Pillars -->
  <rect x="24" y="0" width="18" height="140" fill="#140d0c" opacity="0.7"/>
  <rect x="318" y="0" width="18" height="140" fill="#140d0c" opacity="0.7"/>
  <!-- Golden Treasure Mound -->
  <path d="M10 150 Q105 92 185 106 Q268 90 350 150 Z" fill="#e9c46a" stroke="#9c6615" stroke-width="1.5"/>
  <path d="M48 150 Q145 108 220 116 Q285 106 332 150 Z" fill="#ffb703" opacity="0.78"/>
  <!-- Dragon Wing Silhouette -->
  <path d="M115 96 L152 26 L186 58 L224 18 L256 64 L288 38 L266 104 Z" fill="#540b0e" stroke="#ee9b00" stroke-width="1.3"/>
  <!-- Coiled Serpentine Body & Head -->
  <path d="M74 122 C96 76, 170 72, 226 98 C258 112, 286 105, 302 92 C280 122, 232 128, 186 112 C148 98, 114 108, 96 126 Z" fill="url(#wyrm)" stroke="#ffdd99" stroke-width="1.2"/>
  <!-- Dragon Head & Slanted Eye -->
  <polygon points="62,118 92,102 106,114 88,126" fill="#ae2012" stroke="#ffd166" stroke-width="1.2"/>
  <polygon points="80,112 87,110 84,115" fill="#fff3b0"/>
  <!-- Floating Embers -->
  <circle cx="102" cy="52" r="2" fill="#ffd166"/>
  <circle cx="134" cy="38" r="1.5" fill="#ffb703"/>
  <circle cx="244" cy="42" r="1.8" fill="#ffd166"/>
  <circle cx="298" cy="68" r="1.4" fill="#ffb703"/>
</svg>
`)

/**
 * Circular Token Art (120x120) — Bilbo Baggins
 * Shire-green medallion with Sting's blue elven glow and the Golden Ring.
 */
export const BILBO_TOKEN_ART = toSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="bgB" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#2d6a4f"/>
      <stop offset="100%" stop-color="#143625"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#bgB)" stroke="#d4a373" stroke-width="4"/>
  <!-- Golden Magic Ring Halo -->
  <circle cx="60" cy="60" r="36" fill="none" stroke="#ffd166" stroke-width="5" opacity="0.92"/>
  <circle cx="60" cy="60" r="33" fill="none" stroke="#fff3b0" stroke-width="1.2"/>
  <!-- Glowing Blue Elven Blade (Sting) -->
  <polygon points="60,14 66,70 60,78 54,70" fill="#90e0ef" stroke="#caf0f8" stroke-width="1.5"/>
  <path d="M44 72 Q60 66 76 72 L73 77 Q60 72 47 77 Z" fill="#e9c46a"/>
  <rect x="57" y="75" width="6" height="19" rx="2" fill="#6f4518"/>
  <circle cx="60" cy="97" r="4.5" fill="#e9c46a"/>
</svg>
`)

/**
 * Circular Token Art (120x120) — Thorin Oakenshield
 * Royal Dwarven shield emblem with Durin's Crown and seven stars.
 */
export const THORIN_TOKEN_ART = toSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="bgT" cx="50%" cy="40%" r="58%">
      <stop offset="0%" stop-color="#1d3557"/>
      <stop offset="100%" stop-color="#0b162c"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#bgT)" stroke="#e9c46a" stroke-width="4"/>
  <!-- Dwarven Heater Shield -->
  <path d="M32 36 H88 V64 C88 84 60 100 60 100 C60 100 32 84 32 64 Z" fill="#2b2d42" stroke="#cbd5e1" stroke-width="2.5"/>
  <!-- Crown of Durin -->
  <polygon points="38,56 42,40 51,49 60,36 69,49 78,40 82,56" fill="#ffb703" stroke="#fff3b0" stroke-width="1.2"/>
  <!-- Anvil & Mountain Chevron -->
  <polygon points="44,82 60,62 76,82" fill="none" stroke="#94a3b8" stroke-width="3"/>
  <!-- Stars of Durin -->
  <circle cx="60" cy="22" r="2.2" fill="#fff3b0"/>
  <circle cx="45" cy="25" r="1.7" fill="#fff3b0"/>
  <circle cx="75" cy="25" r="1.7" fill="#fff3b0"/>
</svg>
`)

/**
 * Circular Token Art (120x120) — Gandalf the Grey
 * Starlit indigo medallion with the Grey Pilgrim's pointed hat & glowing staff.
 */
export const GANDALF_TOKEN_ART = toSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="bgG" cx="50%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#3c096c"/>
      <stop offset="100%" stop-color="#10002b"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#bgG)" stroke="#c7d2fe" stroke-width="3.5"/>
  <!-- Wizard Staff & Radiant Crystal -->
  <line x1="82" y1="24" x2="70" y2="102" stroke="#d4a373" stroke-width="4" stroke-linecap="round"/>
  <circle cx="83" cy="22" r="9" fill="#e0e7ff" opacity="0.35"/>
  <polygon points="83,14 88,22 83,30 78,22" fill="#ffffff"/>
  <!-- Iconic Pointed Grey Hat -->
  <polygon points="54,20 34,72 76,72" fill="#64748b" stroke="#cbd5e1" stroke-width="1.5"/>
  <ellipse cx="55" cy="73" rx="33" ry="8" fill="#475569" stroke="#cbd5e1" stroke-width="1.5"/>
  <!-- Beard Silhouette -->
  <polygon points="43,78 67,78 55,103" fill="#e2e8f0" opacity="0.9"/>
</svg>
`)

/**
 * Circular Token Art (120x120) — The Arkenstone of Thráin
 * Radiant Heart of the Mountain refracting white, cyan, and rose-gold fire.
 */
export const ARKENSTONE_TOKEN_ART = toSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="bgA" cx="50%" cy="50%" r="56%">
      <stop offset="0%" stop-color="#e0fbfc"/>
      <stop offset="45%" stop-color="#4cc9f0"/>
      <stop offset="100%" stop-color="#240046"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#bgA)" stroke="#f8edeb" stroke-width="3.5"/>
  <!-- Radiant Light Rays -->
  <g stroke="#ffffff" stroke-width="1.8" opacity="0.75">
    <line x1="60" y1="8" x2="60" y2="112"/>
    <line x1="8" y1="60" x2="112" y2="60"/>
    <line x1="23" y1="23" x2="97" y2="97"/>
    <line x1="97" y1="23" x2="23" y2="97"/>
  </g>
  <!-- Faceted Globe Jewel -->
  <polygon points="60,22 88,36 96,60 88,84 60,98 32,84 24,60 32,36" fill="#f8fafc" stroke="#90e0ef" stroke-width="2"/>
  <polygon points="60,22 76,44 60,60 44,44" fill="#ffffff"/>
  <polygon points="96,60 76,44 60,60 76,76" fill="#caf0f8"/>
  <polygon points="24,60 44,44 60,60 44,76" fill="#fbcfe8" opacity="0.8"/>
  <polygon points="60,98 76,76 60,60 44,76" fill="#fde68a" opacity="0.75"/>
</svg>
`)
